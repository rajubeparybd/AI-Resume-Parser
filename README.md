# AI Resume Parser

A powerful Node.js application that extracts structured data from resumes using AI. Supports PDF, DOC, and DOCX files and processes them in configurable batches.

## Features

✨ **Multi-format Support**: Parses PDF, DOC, and DOCX files  
🤖 **AI-Powered**: Uses OpenRouter to access various LLMs (default: `deepseek/deepseek-chat-v3-0324`) for intelligent data extraction  
⚡ **Batch Processing**: Processes 10-20 files simultaneously  
🔄 **Retry Logic**: Automatic retries for failed requests  
📊 **CSV Export**: Exports results to CSV format  
📈 **Progress Tracking**: Real-time progress bar  
🛡️ **Error Handling**: Comprehensive error reporting  
📁 **File Organization**: Automatically moves processed files to success/failed folders

## Extracted Data

The parser extracts the following information from each resume:

- **Name**: Full name of the candidate
- **Email**: Email address
- **Phone**: Phone number
- **Address**: Full address

## Installation

1. **Clone or download** this repository

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Set up your environment and API key**:
   Run the interactive setup script:

   ```bash
   npm run setup
   ```

   This script will help you create a `.env` file and input your OpenRouter API Key.

   Alternatively, you can manually create a `.env` file in the root directory with the following content:

   ```env
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   BATCH_SIZE=10
   MAX_RETRIES=3
   DELAY_BETWEEN_BATCHES=2000
   # Add other configurations as needed (see Configuration section)
   ```

4. **Get an OpenRouter API Key**:
   - Visit [OpenRouter.ai](https://openrouter.ai/)
   - Sign up and get your API key. This key provides access to models like DeepSeek, GPT-4o, and others.

## Usage

1. **Add resume files** to the `./resumes` directory

   - Supported formats: PDF, DOC, DOCX
   - Can handle 100+ files

2. **Run the parser**:

   ```bash
   npm start
   # or
   node index.js
   ```

3. **Test single file extraction** (optional):
   If you want to test text extraction for a specific file before running the full parser, you can use:

   ```bash
   npm run test-extraction
   ```

   Make sure the file path in `package.json` under `scripts.test-extraction` points to an existing resume file in your `resumes` directory.

4. **View results**:
   - Progress will be shown in real-time
   - Results saved to `extracted_data.csv`
   - Summary report displayed at completion
   - Processed files automatically organized into folders

## File Organization

The system automatically organizes processed files:

- **Success folder** (`./resumes/success/`): Files that were successfully processed and had data extracted
- **Failed folder** (`./resumes/failed/`): Files that failed to process or had no extractable data

This helps you:

- ✅ Keep track of processing status
- 🔄 Easily reprocess failed files after fixing issues
- 📁 Maintain organized file structure
- 🚫 Avoid reprocessing the same files

To disable file organization, set `ORGANIZE_FILES=false` in your `.env` file.

## Configuration

You can customize the processing behavior by setting these environment variables:

| Variable                | Default                          | Description                                                                  |
| ----------------------- | -------------------------------- | ---------------------------------------------------------------------------- |
| `OPENROUTER_API_KEY`    | `your_openrouter_api_key_here`   | Your OpenRouter API key.                                                     |
| `BATCH_SIZE`            | 100                              | Number of files to process simultaneously.                                   |
| `MAX_RETRIES`           | 3                                | Maximum retry attempts for failed AI requests.                               |
| `DELAY_BETWEEN_BATCHES` | 2000                             | Delay between processing batches (milliseconds).                             |
| `RESUME_DIR`            | `./resumes`                      | Directory containing resume files.                                           |
| `OUTPUT_CSV`            | `./extracted_data.csv`           | Output CSV file path.                                                        |
| `SUCCESS_DIR`           | `./resumes/success`              | Directory for successfully processed files.                                  |
| `FAILED_DIR`            | `./resumes/failed`               | Directory for failed files.                                                  |
| `ORGANIZE_FILES`        | `true`                           | Enable/disable automatic file organization (`true` or `false`).              |
| `AI_MODEL`              | `deepseek/deepseek-chat-v3-0324` | AI model to use via OpenRouter (e.g., `openai/gpt-4o`, `google/gemini-pro`). |
| `AI_BASE_URL`           | `https://openrouter.ai/api/v1`   | Base URL for the AI API provider.                                            |

**Note**: `SUPPORTED_EXTENSIONS` (internally `['.pdf', '.doc', '.docx']`) are hardcoded in `index.js` and not configurable via `.env`.

## Example Output

The CSV file will contain columns:

```csv
fileName,name,email,phone,address
"john_doe_resume.pdf","John Doe","john.doe@email.com","555-123-4567","123 Main St, City, State 12345"
"jane_smith_resume.docx","Jane Smith","jane.smith@email.com","555-987-6543","456 Oak Ave, Town, State 67890"
```

## Troubleshooting

### Common Issues

**"Please set your OPENROUTER_API_KEY"**

- Run `npm run setup` to create/update your `.env` file.
- Or ensure your `.env` file exists in the root directory and contains your `OPENROUTER_API_KEY`.
- Or set the environment variable directly in your terminal (less common for this app): `export OPENROUTER_API_KEY=your_key` (Linux/macOS) or `set OPENROUTER_API_KEY=your_key` (Windows).

**"No resume files found"**

- Check that files are in the `./resumes` directory
- Ensure files have `.pdf`, `.doc`, or `.docx` extensions

**"Insufficient text content extracted"**

- The file might be corrupted or image-based
- Try using a different file format

**Rate limit errors**

- Increase `DELAY_BETWEEN_BATCHES` in configuration
- Reduce `BATCH_SIZE` to process fewer files simultaneously

### Performance Tips

- **For 100+ files**: Use `BATCH_SIZE=5-10` to avoid rate limits
- **For faster processing**: Increase `BATCH_SIZE` but monitor for errors
- **For rate-limited APIs**: Increase `DELAY_BETWEEN_BATCHES`

## Technical Details

### Dependencies

- `pdf-parse`: PDF text extraction
- `mammoth`: DOCX text extraction
- `textract`: DOC text extraction
- `openai`: AI processing
- `json2csv`: CSV generation
- `cli-progress`: Progress tracking
- `dotenv`: Loads environment variables from `.env` file
- `openai`: OpenAI Node.js library (used for OpenRouter compatibility)

### Processing Flow

1. **File Discovery**: Scans resume directory for supported files
2. **Text Extraction**: Extracts raw text from documents
3. **Text Cleaning**: Normalizes whitespace and limits length
4. **AI Processing**: Sends text to AI for data extraction
5. **Result Validation**: Ensures proper JSON format
6. **CSV Export**: Saves results to spreadsheet

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Verify your API key and file formats
3. Review the console output for specific error messages

Made with ❤️ by [Raju](https://x.com/rajubeparybd)
