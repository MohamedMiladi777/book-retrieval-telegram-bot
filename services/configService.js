/**
 * Configuration Service
 * 
 * This service centralizes all environment variable management and validation.
 * It uses Joi for schema validation to ensure all required variables are present
 * and have valid values before the application starts.
 * 
 * Benefits:
 * - Fail fast if configuration is invalid
 * - Type conversion (strings to numbers, etc.)
 * - Default values for optional settings
 * - Single source of truth for all config
 */

import Joi from 'joi';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Configuration Schema Definition
 * 
 * This schema defines what environment variables we expect,
 * their types, default values, and validation rules.
 */
const configSchema = Joi.object({
  // Bot Configuration
  BOT_TOKEN: Joi.string().required()
    .description('Telegram Bot Token from BotFather'),
  
  PORT: Joi.number().default(3001)
    .description('Port for Express server'),
  
  WEBHOOK_URL: Joi.string().required()
    .description('Public URL for Telegram webhooks'),

  // Database Configuration
  MONGODB_URI: Joi.string().required()
    .description('MongoDB connection string'),

  // Hugging Face Configuration
  HF_API_TOKEN: Joi.string().required()
    .description('Hugging Face API token for dataset access'),
  
  HF_DATASET_OWNER: Joi.string().default('ieasybooks-org')
    .description('Hugging Face dataset owner'),
  
  HF_DATASET_NAME: Joi.string().default('waqfeya-library')
    .description('Hugging Face dataset name'),
  
  MAX_DATASET_FILES: Joi.number().default(1000)
    .description('Maximum files to process from dataset'),

  // Performance Settings
  DOWNLOAD_TIMEOUT_MS: Joi.number().default(300000)
    .description('Download timeout in milliseconds'),
  
  MAX_FILE_SIZE_MB: Joi.number().default(100)
    .description('Maximum file size in megabytes'),
  
  MAX_RETRIES: Joi.number().default(3)
    .description('Maximum retry attempts for failed operations'),
  
  MAX_CONCURRENT_DOWNLOADS: Joi.number().default(2)
    .description('Maximum simultaneous downloads'),

  // Security Settings
  ADMIN_TELEGRAM_IDS: Joi.string().required()
    .description('Comma-separated list of admin Telegram IDs'),
  
  JWT_SECRET: Joi.string().min(32).required()
    .description('JWT secret for admin authentication'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(3600000)
    .description('Rate limit window in milliseconds'),
  
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(10)
    .description('Maximum requests per window'),

  // Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info')
    .description('Logging level'),
  
  LOG_FILE_PATH: Joi.string().default('./logs/app.log')
    .description('Path to log file'),

}).unknown(true); // Allow other environment variables

/**
 * Validate and Parse Configuration
 * 
 * This function validates all environment variables against our schema
 * and returns a clean configuration object with proper types.
 */
function validateConfig() {
  // Validate environment variables against schema
  const { error, value } = configSchema.validate(process.env);
  
  if (error) {
    // If validation fails, log the error and exit
    console.error('❌ Configuration validation failed:');
    console.error(error.details.map(detail => `  - ${detail.message}`).join('\n'));
    process.exit(1);
  }

  // Parse admin IDs from comma-separated string to array of numbers
  const adminIds = value.ADMIN_TELEGRAM_IDS
    .split(',')
    .map(id => parseInt(id.trim()))
    .filter(id => !isNaN(id)); // Remove invalid IDs

  if (adminIds.length === 0) {
    console.error('❌ No valid admin Telegram IDs found');
    process.exit(1);
  }

  // Return clean configuration object
  return {
    // Bot settings
    bot: {
      token: value.BOT_TOKEN,
      webhookUrl: value.WEBHOOK_URL,
      adminIds: adminIds
    },

    // Server settings
    server: {
      port: value.PORT
    },

    // Database settings
    database: {
      uri: value.MONGODB_URI
    },

    // Hugging Face settings
    huggingFace: {
      apiToken: value.HF_API_TOKEN,
      datasetOwner: value.HF_DATASET_OWNER,
      datasetName: value.HF_DATASET_NAME,
      maxFiles: value.MAX_DATASET_FILES
    },

    // Performance settings
    performance: {
      downloadTimeoutMs: value.DOWNLOAD_TIMEOUT_MS,
      maxFileSizeMB: value.MAX_FILE_SIZE_MB,
      maxRetries: value.MAX_RETRIES,
      maxConcurrentDownloads: value.MAX_CONCURRENT_DOWNLOADS
    },

    // Security settings
    security: {
      jwtSecret: value.JWT_SECRET
    },

    // Rate limiting settings
    rateLimit: {
      windowMs: value.RATE_LIMIT_WINDOW_MS,
      maxRequests: value.RATE_LIMIT_MAX_REQUESTS
    },

    // Logging settings
    logging: {
      level: value.LOG_LEVEL,
      filePath: value.LOG_FILE_PATH
    }
  };
}

// Validate configuration on module load
const config = validateConfig();

// Log successful configuration load
console.log('✅ Configuration loaded successfully');
console.log(`📱 Bot configured for ${config.bot.adminIds.length} admin(s)`);
console.log(`🗄️ Database: ${config.database.uri.includes('localhost') ? 'Local' : 'Cloud'}`);
console.log(`🤗 Hugging Face: ${config.huggingFace.datasetOwner}/${config.huggingFace.datasetName}`);

// Export the validated configuration
export default config;
