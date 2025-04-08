const { MongoClient } = require('mongodb');
const { createLogger } = require('../utils/logger');
const { mongoose } = require('mongoose');
const { dotenv } = require('dotenv');

const logger = createLogger('database');

dotenv.config();

let client = null;
let db = null;

/**
 * Connection to MongoDB Atlas
 * @param {string} uri
 * @returns {Promise<Object>}
 */
async function connectToMongo(uri) {
  try {
    if (client && db) {
      logger.debug('Using existed connection to MongoDB. ');
      return db;
    }

    logger.info('Connection to MongoDB Atlas...');

    // Optimal working parameters for MongoDB Atlas
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      retryWrites: true,
      w: 'majority',
    };

    client = new MongoClient(uri, options);
    await client.connect();

    const dbName = uri.split('/').pop().split('?')[0];
    db = client.db(dbName);

    logger.info('Connect to MongoDB Atlas successful established.');

    await createIndexes(db);

    return db;
  } catch (error) {
    logger.error(`Cannot connect to MongoDB Atlas: ${error.message}`);
    throw error;
  }
}

/**
 * @param {Object} db
 */
async function createIndexes(db) {
  try {
    await db.collection('device_data').createIndex(
      { deviceId: 1, timestamp: -1 },
      { background: true }
    );

    await db.collection('devices').createIndex(
      { deviceId: 1 },
      { unique: true, background: true }
    );

    logger.info('Индексы MongoDB успешно созданы/обновлены');
  } catch (error) {
    logger.warn(`Ошибка при создании индексов MongoDB: ${error.message}`);
  }
}

/**
 * Закрытие подключения к MongoDB
 */
async function closeMongo() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    logger.info('Подключение к MongoDB закрыто');
  }
}

/**
 * Сохранение данных устройства в MongoDB Atlas
 * @param {Object} db - Подключение к базе данных MongoDB
 * @param {Object} data - Данные устройства для сохранения
 * @returns {Promise<Object>} - Сохраненный документ
 */
async function saveDeviceData(db, data) {
  try {
    // Преобразование строкового timestamp в объект Date
    const dataToSave = {
      ...data,
      timestamp: new Date(data.timestamp),
      receivedAt: new Date()
    };

    // Сохранение данных в коллекцию 'device_data'
    const result = await db.collection('device_data').insertOne(dataToSave);

    logger.debug(`Данные сохранены в MongoDB с ID: ${result.insertedId}`);

    // Обновление информации об устройстве в коллекции 'devices'
    await updateDeviceInfo(db, data);

    return result;
  } catch (error) {
    logger.error(`Ошибка сохранения данных устройства: ${error.message}`);
    throw error;
  }
}

/**
 * Обновление или создание информации об устройстве в коллекции devices
 * @param {Object} db - Подключение к базе данных MongoDB
 * @param {Object} data - Данные устройства
 * @returns {Promise<void>}
 */
async function updateDeviceInfo(db, data) {
  try {
    const now = new Date();
    const timestamp = new Date(data.timestamp);

    const deviceInfo = {
      $set: {
        deviceId: data.deviceId,
        type: data.type,
        lastValue: data.value,
        lastUpdated: timestamp,
        batteryLevel: data.batteryLevel,
        lastReceivedAt: now,
      },
      $inc: {
        dataPointsCount: 1
      },
      $setOnInsert: {
        firstSeenAt: now
      }
    };

    await db.collection('devices').updateOne(
      { deviceId: data.deviceId },
      deviceInfo,
      { upsert: true }
    );

    logger.debug(`Информация об устройстве обновлена для устройства: ${data.deviceId}`);
  } catch (error) {
    logger.error(`Ошибка обновления информации об устройстве: ${error.message}`);
    throw error;
  }
}

module.exports = {
  connectToMongo,
  closeMongo,
  saveDeviceData,
  updateDeviceInfo
};