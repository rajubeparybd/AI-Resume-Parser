const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");
const { parse } = require("json2csv");
const cliProgress = require("cli-progress");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const textract = require("textract");
const { promisify } = require("util");
require("dotenv").config();
const { OpenAI } = require("openai");

// Configuration
const CONFIG = {
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "your_api_key_here",
  BATCH_SIZE: parseInt(process.env.BATCH_SIZE) || 100,
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES) || 3,
  DELAY_BETWEEN_BATCHES: parseInt(process.env.DELAY_BETWEEN_BATCHES) || 2000,
  RESUME_DIR: process.env.RESUME_DIR || "./resumes",
  OUTPUT_CSV: process.env.OUTPUT_CSV || "./extracted_data.csv",
  SUCCESS_DIR: process.env.SUCCESS_DIR || "./resumes/success",
  FAILED_DIR: process.env.FAILED_DIR || "./resumes/failed",
  ORGANIZE_FILES: process.env.ORGANIZE_FILES !== "false",
  AI_MODEL: process.env.AI_MODEL || "deepseek/deepseek-chat-v3-0324",
  AI_BASE_URL: process.env.AI_BASE_URL || "https://openrouter.ai/api/v1",
  SUPPORTED_EXTENSIONS: [".pdf", ".doc", ".docx"],
};

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: CONFIG.OPENROUTER_API_KEY,
  baseURL: CONFIG.AI_BASE_URL,
});

// Promisify textract for better async handling
const textractFromFile = promisify(textract.fromFileWithPath);

/**
 * Create necessary directories for file organization
 */
async function createDirectories() {
  if (!CONFIG.ORGANIZE_FILES) return;

  try {
    if (!fs.existsSync(CONFIG.SUCCESS_DIR)) {
      await fsPromises.mkdir(CONFIG.SUCCESS_DIR, { recursive: true });
      console.log(`✅ Created success directory: ${CONFIG.SUCCESS_DIR}`);
    }

    if (!fs.existsSync(CONFIG.FAILED_DIR)) {
      await fsPromises.mkdir(CONFIG.FAILED_DIR, { recursive: true });
      console.log(`✅ Created failed directory: ${CONFIG.FAILED_DIR}`);
    }
  } catch (error) {
    console.error("Error creating directories:", error.message);
  }
}

/**
 * Move file to success or failed directory
 */
async function moveFile(filePath, isSuccess) {
  if (!CONFIG.ORGANIZE_FILES) return;

  try {
    const fileName = path.basename(filePath);
    const targetDir = isSuccess ? CONFIG.SUCCESS_DIR : CONFIG.FAILED_DIR;
    const targetPath = path.join(targetDir, fileName);

    // Check if target file already exists and create unique name if needed
    let finalTargetPath = targetPath;
    let counter = 1;

    while (fs.existsSync(finalTargetPath)) {
      const ext = path.extname(fileName);
      const nameWithoutExt = path.basename(fileName, ext);
      finalTargetPath = path.join(
        targetDir,
        `${nameWithoutExt}_${counter}${ext}`
      );
      counter++;
    }

    await fsPromises.rename(filePath, finalTargetPath);

    const status = isSuccess ? "✓ Success" : "✗ Failed";
    const targetDirName = isSuccess ? "success" : "failed";
    console.log(`${status}: Moved ${fileName} to ${targetDirName} folder`);
  } catch (error) {
    console.error(`Error moving file ${filePath}:`, error.message);
  }
}

/**
 * Extract text from different file formats
 */
async function extractTextFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  try {
    switch (ext) {
      case ".pdf":
        return await extractTextFromPDF(filePath);
      case ".docx":
        return await extractTextFromDOCX(filePath);
      case ".doc":
        return await extractTextFromDOC(filePath);
      default:
        throw new Error(`Unsupported file type: ${ext}`);
    }
  } catch (error) {
    console.error(`Error extracting text from ${filePath}:`, error.message);
    throw error;
  }
}

/**
 * Extract text from PDF files
 */
async function extractTextFromPDF(filePath) {
  const dataBuffer = await fsPromises.readFile(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
}

/**
 * Extract text from DOCX files
 */
async function extractTextFromDOCX(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

/**
 * Extract text from DOC files
 */
async function extractTextFromDOC(filePath) {
  const text = await textractFromFile(filePath);
  return text;
}

/**
 * Clean and prepare text for AI processing
 */
function cleanText(text) {
  return text
    .replace(/\s+/g, " ") // Replace multiple whitespace with single space
    .replace(/\n+/g, "\n") // Replace multiple newlines with single newline
    .trim()
    .substring(0, 8000); // Limit text length to avoid token limits
}

/**
 * Extract resume data using AI with retry mechanism
 */
async function extractResumeDataWithAI(text, fileName, retryCount = 0) {
  const prompt = `You are a resume parser. Extract the following information from the resume text and respond ONLY with valid JSON in this exact format:
{
  "name": "Full name of the person",
  "email": "email@example.com", 
  "phone": "phone number",
  "address": "full address"
}

If any information is not found, use an empty string "". Do not include any other text in your response, only the JSON object.

Resume text:
${text}`;

  try {
    const response = await openai.chat.completions.create({
      model: CONFIG.AI_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a precise resume parser that responds only with valid JSON. Never include explanatory text.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const content = response.choices[0].message.content.trim();

    // Try to extract JSON from response if it contains extra text
    let jsonString = content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonString = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonString);

    // Validate that required fields exist
    const result = {
      fileName,
      name: (parsed.name || "").toString().trim(),
      email: (parsed.email || "").toString().trim(),
      phone: (parsed.phone || "").toString().trim(),
      address: (parsed.address || "").toString().trim(),
    };

    return result;
  } catch (error) {
    console.error(
      `AI parsing error for ${fileName} (attempt ${retryCount + 1}):`,
      error.message
    );

    if (retryCount < CONFIG.MAX_RETRIES - 1) {
      console.log(`Retrying ${fileName}...`);
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * (retryCount + 1))
      );
      return extractResumeDataWithAI(text, fileName, retryCount + 1);
    }

    // Return empty result if all retries failed
    return {
      fileName,
      name: "",
      email: "",
      phone: "",
      address: "",
      error: error.message,
    };
  }
}

/**
 * Process a single resume file
 */
async function processResume(filePath) {
  const fileName = path.basename(filePath);
  let isSuccess = false;

  try {
    console.log(`Processing: ${fileName}`);

    // Extract text from file
    const rawText = await extractTextFromFile(filePath);
    const cleanedText = cleanText(rawText);

    if (!cleanedText || cleanedText.length < 50) {
      throw new Error("Insufficient text content extracted");
    }

    // Extract data using AI
    const result = await extractResumeDataWithAI(cleanedText, fileName);

    // Check if extraction was successful (has meaningful data and no error)
    const hasData =
      result.name || result.email || result.phone || result.address;
    isSuccess = hasData && !result.error;

    if (isSuccess) {
      console.log(`✓ Completed: ${fileName}`);
    } else {
      console.log(
        `⚠ Partially completed: ${fileName} (limited data extracted)`
      );
    }

    // Move file to appropriate directory
    await moveFile(filePath, isSuccess);

    return result;
  } catch (error) {
    console.error(`✗ Failed: ${fileName} - ${error.message}`);

    // Move file to failed directory
    await moveFile(filePath, false);

    return {
      fileName,
      name: "",
      email: "",
      phone: "",
      address: "",
      error: error.message,
    };
  }
}

/**
 * Create batches from an array
 */
function createBatches(items, batchSize) {
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Process all resumes in batches with progress tracking
 */
async function processAllResumes() {
  console.log("🚀 Starting resume processing...\n");

  // Validate configuration
  if (CONFIG.OPENROUTER_API_KEY === "your_api_key_here") {
    console.error("❌ Please set your OPENROUTER_API_KEY in the .env file");
    process.exit(1);
  }

  // Create directories for file organization
  await createDirectories();

  // Get all resume files
  const files = fs
    .readdirSync(CONFIG.RESUME_DIR)
    .filter((file) =>
      CONFIG.SUPPORTED_EXTENSIONS.includes(path.extname(file).toLowerCase())
    )
    .map((file) => path.join(CONFIG.RESUME_DIR, file));

  if (files.length === 0) {
    console.log("No resume files found in the directory.");
    return;
  }

  console.log(`Found ${files.length} resume files`);
  console.log(`Processing in batches of ${CONFIG.BATCH_SIZE}\n`);

  const totalFiles = files.length;
  const batches = createBatches(files, CONFIG.BATCH_SIZE);
  const allData = [];
  const errors = [];

  // Initialize progress bar
  const progressBar = new cliProgress.SingleBar(
    {
      format:
        "Progress |{bar}| {percentage}% | {value}/{total} Files | ETA: {eta}s",
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      hideCursor: true,
    },
    cliProgress.Presets.shades_classic
  );

  progressBar.start(totalFiles, 0);

  // Process batches
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`\nProcessing batch ${i + 1}/${batches.length}`);

    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map((filePath) => processResume(filePath))
    );

    // Collect results
    for (const result of batchResults) {
      if (result) {
        allData.push(result);
        if (result.error) {
          errors.push({ file: result.fileName, error: result.error });
        }
      }
      progressBar.increment();
    }

    // Delay between batches to respect rate limits
    if (i < batches.length - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, CONFIG.DELAY_BETWEEN_BATCHES)
      );
    }
  }

  progressBar.stop();

  // Generate CSV output
  if (allData.length > 0) {
    try {
      const csvFields = ["fileName", "name", "email", "phone", "address"];
      const csv = parse(allData, { fields: csvFields });

      await fsPromises.writeFile(CONFIG.OUTPUT_CSV, csv);
      console.log(`\n✅ Successfully processed ${allData.length} resumes`);
      console.log(`📄 Data saved to: ${CONFIG.OUTPUT_CSV}`);

      // Show summary
      const successCount = allData.filter((item) => !item.error).length;
      const errorCount = errors.length;

      console.log(`\n📊 Summary:`);
      console.log(`   ✓ Successful: ${successCount}`);
      console.log(`   ✗ Failed: ${errorCount}`);

      if (errors.length > 0) {
        console.log(`\n❌ Failed files:`);
        errors.forEach(({ file, error }) => {
          console.log(`   • ${file}: ${error}`);
        });
      }
    } catch (error) {
      console.error("Error writing CSV file:", error);
    }
  } else {
    console.log("No data was successfully extracted.");
  }
}

// Handle process interruption
process.on("SIGINT", () => {
  console.log("\n\n⚠️ Process interrupted by user");
  process.exit(0);
});

// Main execution
if (require.main === module) {
  processAllResumes().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

module.exports = {
  processAllResumes,
  processResume,
  extractTextFromFile,
  CONFIG,
};
