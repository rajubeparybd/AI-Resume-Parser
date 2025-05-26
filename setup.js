#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("🚀 Resume Parser Setup\n");

async function setupEnvironment() {
  try {
    // Check if .env exists
    if (fs.existsSync(".env")) {
      console.log("✅ .env file already exists");
    } else {
      console.log("📝 Setting up environment configuration...\n");

      const apiKey = await askQuestion(
        "Enter your OpenRouter API Key (get one at https://openrouter.ai/): "
      );

      if (!apiKey || apiKey.trim() === "") {
        console.log(
          "⚠️  No API key provided. You can set it later in the .env file."
        );
        console.log(
          "⚠️  The application will not work without a valid API key.\n"
        );
      }

      const envContent = `# OpenRouter API Configuration
OPENROUTER_API_KEY=${apiKey || "your_openrouter_api_key_here"}

# Processing Configuration
BATCH_SIZE=10
MAX_RETRIES=3
DELAY_BETWEEN_BATCHES=2000

# File Paths
RESUME_DIR=./resumes
OUTPUT_CSV=./extracted_data.csv
SUCCESS_DIR=./resumes/success
FAILED_DIR=./resumes/failed

# File Organization (set to false to disable automatic file moving)
ORGANIZE_FILES=true

# AI Model Configuration
AI_MODEL=openai/gpt-4o
AI_BASE_URL=https://openrouter.ai/api/v1
`;

      fs.writeFileSync(".env", envContent);
      console.log("✅ Created .env file");
    }

    // Check resumes directory
    if (!fs.existsSync("./resumes")) {
      fs.mkdirSync("./resumes");
      console.log("✅ Created resumes directory");
    } else {
      const files = fs.readdirSync("./resumes");
      const resumeFiles = files.filter((file) =>
        [".pdf", ".doc", ".docx"].includes(path.extname(file).toLowerCase())
      );
      console.log(
        `✅ Found ${resumeFiles.length} resume files in ./resumes directory`
      );
    }

    console.log("\n🎉 Setup complete!");
    console.log("\nNext steps:");
    console.log("1. Add your resume files to the ./resumes directory");
    console.log("2. Run: npm start");
    console.log("3. Check the results in extracted_data.csv\n");
  } catch (error) {
    console.error("Error during setup:", error);
  } finally {
    rl.close();
  }
}

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

if (require.main === module) {
  setupEnvironment();
}
