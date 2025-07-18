/**
 * Error Service
 * 
 * This service provides centralized error handling for the entire application.
 * It categorizes errors, provides user-friendly messages, and ensures
 * consistent error logging and reporting.
 * 
 * Benefits:
 * - Consistent error handling across the app
 * - User-friendly error messages
 * - Proper error logging and monitoring
 * - Error categorization for better debugging
 */

import { logger } from '../logs/logger.js';

/**
 * Custom Error Classes
 * 
 * These classes help us categorize different types of errors
 * and handle them appropriately.
 */

// Base application error class
export class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational; // Whether this is an expected error
    this.timestamp = new Date().toISOString();
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

// Validation errors (user input issues)
export class ValidationError extends AppError {
  constructor(message, field = null) {
    super(message, 400);
    this.field = field;
    this.type = 'VALIDATION_ERROR';
  }
}

// Download-related errors
export class DownloadError extends AppError {
  constructor(message, fileUrl = null, fileSize = null) {
    super(message, 500);
    this.fileUrl = fileUrl;
    this.fileSize = fileSize;
    this.type = 'DOWNLOAD_ERROR';
  }
}

// Hugging Face API errors
export class HuggingFaceError extends AppError {
  constructor(message, statusCode = 500) {
    super(message, statusCode);
    this.type = 'HUGGINGFACE_ERROR';
  }
}

// Database errors
export class DatabaseError extends AppError {
  constructor(message, operation = null) {
    super(message, 500);
    this.operation = operation;
    this.type = 'DATABASE_ERROR';
  }
}

// Authorization errors
export class AuthorizationError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(message, 403);
    this.type = 'AUTHORIZATION_ERROR';
  }
}

/**
 * Error Handler Class
 * 
 * This class provides methods for handling different types of errors
 * and converting them into appropriate responses for users.
 */
class ErrorHandler {
  /**
   * Handle Telegram Bot Errors
   * 
   * This method handles errors that occur during Telegram bot operations
   * and sends appropriate messages to users.
   */
  async handleTelegramError(ctx, error, operation = 'unknown') {
    // Log the error with context
    logger.error('Telegram operation failed', {
      operation,
      error: error.message,
      stack: error.stack,
      userId: ctx?.from?.id,
      chatId: ctx?.chat?.id,
      timestamp: new Date().toISOString()
    });

    // Determine user-friendly message based on error type
    let userMessage = 'Sorry, something went wrong. Please try again later.';
    let showRetryButton = false;

    if (error instanceof ValidationError) {
      userMessage = `❌ ${error.message}`;
    } else if (error instanceof DownloadError) {
      userMessage = '📥 Download failed. The file might be too large or temporarily unavailable.';
      showRetryButton = true;
    } else if (error instanceof HuggingFaceError) {
      userMessage = '📚 Book service is temporarily unavailable. Please try again later.';
      showRetryButton = true;
    } else if (error instanceof DatabaseError) {
      userMessage = '🗄️ Database error. Please try again in a few moments.';
      showRetryButton = true;
    } else if (error instanceof AuthorizationError) {
      userMessage = '🔒 You are not authorized to perform this action.';
    } else if (error.code === 'ENOTFOUND') {
      userMessage = '🌐 Network error. Please check your connection and try again.';
      showRetryButton = true;
    } else if (error.code === 'ETIMEDOUT') {
      userMessage = '⏱️ Request timed out. Please try again.';
      showRetryButton = true;
    }

    // Send error message to user
    try {
      if (ctx && ctx.reply) {
        await ctx.reply(userMessage);
      }
    } catch (replyError) {
      // If we can't even send an error message, log it
      logger.error('Failed to send error message to user', {
        originalError: error.message,
        replyError: replyError.message,
        userId: ctx?.from?.id
      });
    }

    return {
      handled: true,
      userMessage,
      showRetryButton
    };
  }

  /**
   * Handle Express Route Errors
   * 
   * This method handles errors in Express routes and sends
   * appropriate HTTP responses.
   */
  handleExpressError(error, req, res, next) {
    // Log the error
    logger.error('Express route error', {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });

    // Determine response based on error type
    let statusCode = 500;
    let message = 'Internal server error';

    if (error instanceof AppError) {
      statusCode = error.statusCode;
      message = error.message;
    }

    // Send error response
    res.status(statusCode).json({
      success: false,
      error: {
        message,
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      }
    });
  }

  /**
   * Handle Unhandled Promise Rejections
   * 
   * This method handles promise rejections that weren't caught
   * by application code.
   */
  handleUnhandledRejection(reason, promise) {
    logger.error('Unhandled Promise Rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise: promise.toString(),
      timestamp: new Date().toISOString()
    });

    // In production, you might want to restart the process
    if (process.env.NODE_ENV === 'production') {
      console.log('🔄 Gracefully shutting down due to unhandled promise rejection');
      process.exit(1);
    }
  }

  /**
   * Handle Uncaught Exceptions
   * 
   * This method handles exceptions that weren't caught
   * by application code.
   */
  handleUncaughtException(error) {
    logger.error('Uncaught Exception', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // Always exit on uncaught exceptions
    console.log('💥 Uncaught exception occurred. Shutting down...');
    process.exit(1);
  }

  /**
   * Wrap Async Functions
   * 
   * This utility function wraps async functions to automatically
   * catch and handle errors.
   */
  wrapAsync(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Wrap Telegram Handlers
   * 
   * This utility function wraps Telegram handlers to automatically
   * catch and handle errors.
   */
  wrapTelegramHandler(handler, operation = 'telegram_operation') {
    return async (ctx, next) => {
      try {
        await handler(ctx, next);
      } catch (error) {
        await this.handleTelegramError(ctx, error, operation);
      }
    };
  }
}

// Create and export a singleton instance
const errorHandler = new ErrorHandler();

// Set up global error handlers
process.on('unhandledRejection', (reason, promise) => {
  errorHandler.handleUnhandledRejection(reason, promise);
});

process.on('uncaughtException', (error) => {
  errorHandler.handleUncaughtException(error);
});

export default errorHandler;
