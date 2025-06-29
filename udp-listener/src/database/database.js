const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '.env') });

const mongoose = require('mongoose');
const pkg = require('@vitaly-yosef/node-smart-logger');
const { createLogger, generateLoggerTraceId, setLoggerContext, clearLoggerContext } = pkg;

const logger = createLogger('database', './logs');

/**
 * Connection to MongoDB Atlas
 * @param {string} uri
 * @returns {Promise<Object>}
 */
async function connectDB(uri = process.env.MONGODB_URI) {
  try {
    const traceId = generateLoggerTraceId();
    setLoggerContext({ operation: 'db-connect', traceId });

    if (mongoose.connection.readyState === 1) {
        logger.debug('Using existing connection to MongoDB.');
        clearLoggerContext();
      return mongoose.connection;
    }

    logger.info('Connecting to MongoDB Atlas...');

    // Optimal working parameters for MongoDB Atlas
    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
    };

    await mongoose.connect(uri, options);
    logger.info('Connected to MongoDB Atlas successfully!');
    clearLoggerContext();
    return mongoose.connection;
  } catch (error) {
    logger.error(`Error connecting to MongoDB Atlas: ${error.message}`);
    clearLoggerContext();
    throw error;
  }
}

/**
 * Close DB connection
 * @returns {Promise<void>}
 */
async function closeMongo() {
  try {
    const traceId = generateLoggerTraceId();
    setLoggerContext({ operation: 'db-close', traceId });

    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed.');
    }
    clearLoggerContext();
  } catch (error) {
    logger.error(`Error closing MongoDB connection: ${error.message}`);
    clearLoggerContext();
    throw error;
  }
}

module.exports = {
  connectDB,
  closeMongo
};