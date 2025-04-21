const DeviceData = require('../models/deviceData');
const { createLogger } = require('@iotmonsys/logger-node');

const logger = createLogger('device-data-repository', './logs');

/**
 * Save device sensor data.
 * @param {Object} dataDetails - Object matching the deviceData schema
 * @returns {Promise<Object>} - The saved data document
 */
async function createDeviceData(dataDetails) {
  try {
    const timestamp = dataDetails.timestamp instanceof Date ? dataDetails.timestamp : new Date(dataDetails.timestamp);
    const dataToSave = new DeviceData({
      ...dataDetails,
      timestamp
    });
    const savedData = await dataToSave.save();
    logger.debug(`Repo: Device data saved for ${dataDetails.deviceId} with ID: ${savedData._id}`);
    return savedData;
  } catch (error) {
    logger.error(`Repo: Error saving device data for ${dataDetails.deviceId}: ${error.message}`);
    throw error;
  }
}

module.exports = {
  createDeviceData
};