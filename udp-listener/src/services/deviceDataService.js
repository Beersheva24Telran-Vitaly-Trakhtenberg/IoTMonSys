const deviceData = require('../models/deviceData');
const Device = require('../models/Device');
const { findDeviceById, createDevice, updateDevice } = require('../repositories/deviceRepository');
const { createDeviceData } = require('../repositories/deviceDataRepository');

const { createLogger } = require('@iotmonsys/logger-node');
const logger = createLogger('device-data-service', './logs');

// Discovery mode (auto-search/adding new devices)
let discoveryMode = process.env.DISCOVERY_MODE_ENABLED === 'true';
let discoveryModeTimeout = null;

/**
 * On/off discovery mode.
 * @param {boolean} isEnabled
 * @param {number} duration
 * @returns {Object}
 */
const setDiscoveryMode = (isEnabled, duration = process.env.DISCOVERY_MODE_DURATION || 60000) => {
  discoveryMode = isEnabled;

  if (discoveryModeTimeout) {
    clearTimeout(discoveryModeTimeout);
    discoveryModeTimeout = null;
  }

  if (isEnabled) {
    logger.info(`Discovery mode enabled. Max time of duration: ${duration/1000} sec`);

    discoveryModeTimeout = setTimeout(() => {
      discoveryMode = false;
      logger.info('Discovery mode disabled automatically.');
    }, duration);
  } else {
    logger.info('Discovery mode disabled.');
  }

  return { enabled: discoveryMode, duration };
};

/**
 * @returns {Object}
 */
const getDiscoveryMode = () => {
  return { enabled: discoveryMode };
};

/**
 * Stores device data in the database.
 * @param {Object} data
 * @returns {Promise<Object>}
 */
const saveDeviceData = async (data) => {
  logger.debug(`saveDeviceData: Data received from device: ${JSON.stringify(data)}`);
  try {
    const device = await Device.findOne({ deviceId: data.deviceId });
    const timestamp = data.timestamp instanceof Date ? data.timestamp : new Date(data.timestamp);

    if (!device) {
      if (discoveryMode) {
        const newDeviceDetails = new Device({
          deviceId: data.deviceId,
          name: `New ${data.type.charAt(0).toUpperCase() + data.type.slice(1)} Device`,
          type: data.type,
          status: 'pending',
          lastDataReceived: new Date(data.timestamp)
        });

        await createDevice(newDeviceDetails);
        logger.info(`A new device has been discovered: ${data.deviceId} (needs a manual improvement).`);

        const newDeviceDataInstance = new deviceData({
          ...data,
          timestamp
        });

        const savedData = await createDeviceData(data);
        logger.debug(`Data saved into MongoDB with ID: ${savedData._id}.`);

        return savedData;
      } else {
        logger.warn(`Received data from an unregistered device: ${data.deviceId}. Data rejected.`);
        return null;
      }
    }

    if (device.status === 'pending') {
      logger.debug(`Received data from an 'pending device: ${data.deviceId}.`);
    } else if (device.status === 'inactive') {
      logger.debug(`Service: Received data from 'inactive' device: ${data.deviceId}. Saving data and updating status.`);
      device.status = 'active';
    }
    const newDeviceDataInstance = new deviceData({
      ...data,
      timestamp
    });

    const savedData = await createDeviceData(data);
    logger.debug(`Data saved into MongoDB with ID: ${savedData._id}.`);

    await updateDeviceInfo(device, data);

    return savedData;
  } catch (error) {
    logger.error(`Error(s) saving device's data: ${error.message}. `);
    throw error;
  }
};

/**
 * Update device information in the database
 * @param {Object} device
 * @param {Object} data
 * @returns {Promise<Object>}
 */
const updateDeviceInfo = async (device, data) => {
  logger.debug(`updateDeviceInfo: Data received from device: ${JSON.stringify(data)}`);
  try {
    const timestamp = data.timestamp instanceof Date ? data.timestamp : new Date(data.timestamp);
    const updateDetails = {
      lastDataReceived: timestamp
    };

    if (device.status === 'inactive' || device.status === 'pending') {
      if (device.status !== 'pending') {
        updateDetails.status = 'active';
        logger.info(`Service: Device ${device.deviceId} status changed to active.`);
      }
    }

    const updatedDevice = await updateDevice(device, updateDetails); // Используем функцию из deviceRepository
    logger.debug(`Service: Device info updated for device: ${data.deviceId}`);
    return updatedDevice;
  } catch (error) {
    logger.error(`Service: Error during updateDeviceInfo for ${device.deviceId}: ${error.message}`);
    throw error;
  }
};

module.exports = {
  saveDeviceData,
  updateDeviceInfo,
  setDiscoveryMode,
  getDiscoveryMode
};