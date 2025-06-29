const DeviceData = require('../models/deviceData');
const pkg = require('@vitaly-yosef/node-smart-logger');
const { createLogger, generateLoggerTraceId, setLoggerContext, clearLoggerContext } = pkg;

const logger = createLogger('device-data-repository', './logs');

/**
 * Save device sensor data.
 * @param {Object} dataDetails - Object matching the deviceData schema
 * @returns {Promise<Object>} - The saved data document
 */
async function createDeviceData(dataDetails) {
  try {
    const traceId = dataDetails.traceId || generateLoggerTraceId();
    const deviceId = dataDetails.deviceId;
    setLoggerContext({ operation: 'save-device-data', deviceId, traceId });
    
    const timestamp = dataDetails.timestamp instanceof Date ? dataDetails.timestamp : new Date(dataDetails.timestamp);
    const dataToSave = new DeviceData({
      ...dataDetails,
      timestamp
    });
    const savedData = await dataToSave.save();
    logger.debug(`Repo: Device data saved for ${dataDetails.deviceId} with ID: ${savedData._id}`);
    
    clearLoggerContext();
    return savedData;
  } catch (error) {
    logger.error(`Repo: Error saving device data for ${dataDetails.deviceId}: ${error.message}`);
    clearLoggerContext();
    throw error;
  }
}

module.exports = {
  createDeviceData
};