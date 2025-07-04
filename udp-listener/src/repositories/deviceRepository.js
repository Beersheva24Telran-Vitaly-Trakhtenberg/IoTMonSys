const Device = require('../models/Device');
const pkg = require('@vitaly-yosef/node-smart-logger');
const { createLogger, generateLoggerTraceId, setLoggerContext, clearLoggerContext } = pkg;

const logger = createLogger('device-repository', './logs');

/**
 * Find a device by its ID.
 * @param {string} deviceId
 * @returns {Promise<Object|null>}
 */
async function findDeviceById(deviceId) {
  try {
    const traceId = generateLoggerTraceId();
    setLoggerContext({ operation: 'find-device', deviceId, traceId });
    
    const device = await Device.findOne({ deviceId });
    
    clearLoggerContext();
    return device;
  } catch (error) {
    logger.error(`Repo: Error finding device by ID ${deviceId}: ${error.message}`);
    clearLoggerContext();
    throw error;
  }
}

/**
 * Create a new device document.
 * @param {Object} deviceDetails - Object matching the Device schema
 * @returns {Promise<Object>} - The saved device document
 */
async function createDevice(deviceDetails) {
  try {
    const traceId = generateLoggerTraceId();
    const deviceId = deviceDetails.deviceId;
    setLoggerContext({ operation: 'create-device', deviceId, traceId });
    
    const newDevice = new Device(deviceDetails);
    const savedDevice = await newDevice.save();
    logger.debug(`Repo: Device ${savedDevice.deviceId} created with ID: ${savedDevice._id}`);
    
    clearLoggerContext();
    return savedDevice;
  } catch (error) {
    logger.error(`Repo: Error creating device: ${error.message}`);
    clearLoggerContext();
    throw error;
  }
}

/**
 * Update an existing device document.
 * @param {Object} device - The Mongoose device document to update
 * @param {Object} updateDetails - Fields to update
 * @returns {Promise<Object>} - The updated device document
 */
async function updateDevice(device, updateDetails) {
  try {
    const traceId = generateLoggerTraceId();
    const deviceId = device.deviceId;
    setLoggerContext({ operation: 'update-device', deviceId, traceId });
    
    Object.assign(device, updateDetails);
    device.updatedAt = new Date();
    const updatedDevice = await device.save();
    logger.debug(`Repo: Device ${updatedDevice.deviceId} updated.`);
    
    clearLoggerContext();
    return updatedDevice;
  } catch (error) {
    logger.error(`Repo: Error updating device ${device.deviceId}: ${error.message}`);
    clearLoggerContext();
    throw error;
  }
}

module.exports = {
  findDeviceById,
  createDevice,
  updateDevice
};