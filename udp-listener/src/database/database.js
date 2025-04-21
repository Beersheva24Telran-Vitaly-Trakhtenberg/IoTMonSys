const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '.env') });

const mongoose = require('mongoose');
const { createLogger } = require('@iotmonsys/logger-node');

const logger = createLogger('database', './logs');

/**
 * Connection to MongoDB Atlas
 * @param {string} uri
 * @returns {Promise<Object>}
 */
async function connectDB(uri = process.env.MONGODB_URI) {
  try {
    if (mongoose.connection.readyState === 1) {
        logger.debug('Using existing connection to MongoDB.');
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

    logger.info('Connection to MongoDB Atlas successfully established.');

    return mongoose.connection;
  } catch (error) {
    logger.error(`Cannot connect to MongoDB Atlas: ${error.message}`);
    throw error;
  }
}

/**
 * Close DB connection
 * @returns {Promise<void>}
 */
async function closeMongo() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    logger.info('Connection to MongoDB closed');
  }
}

module.exports = {
  connectDB,
  closeMongo
};