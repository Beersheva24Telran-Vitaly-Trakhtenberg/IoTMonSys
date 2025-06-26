const Device = require('../models/Device');
const { createLogger } = require('@iotmonsys/logger-node');

const logger = createLogger('device-repository', './logs');

/**
 * Find a device by its ID.
 * @param {string} deviceId
 * @returns {Promise<Object|null>}
 */
async function findDeviceById(deviceId) {
  try {
    return await Device.findOne({ deviceId });
  } catch (error) {
    logger.error(`Repo: Error finding device by ID ${deviceId}: ${error.message}`);
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
    const newDevice = new Device(deviceDetails);
    const savedDevice = await newDevice.save();
    logger.debug(`Repo: Device ${savedDevice.deviceId} created with ID: ${savedDevice._id}`);
    return savedDevice;
  } catch (error) {
    logger.error(`Repo: Error creating device: ${error.message}`);
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
    Object.assign(device, updateDetails);
    device.updatedAt = new Date();
    const updatedDevice = await device.save();
    logger.debug(`Repo: Device ${updatedDevice.deviceId} updated.`);
    return updatedDevice;
  } catch (error) {
    logger.error(`Repo: Error updating device ${device.deviceId}: ${error.message}`);
    throw error;
  }
}

module.exports = {
  findDeviceById,
  createDevice,
  updateDevice
};