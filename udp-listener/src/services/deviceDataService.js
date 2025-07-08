const deviceData = require('../models/deviceData');
const Device = require('../models/Device');
const { POWER_TYPES, POWER_TYPES_ARRAY } = require('../constants/deviceTypes');
const { findDeviceById, createDevice, updateDevice } = require('../repositories/deviceRepository');
const { createDeviceData } = require('../repositories/deviceDataRepository');
const { sendToKinesis } = require('./kinesisService');

const pkg = require('@vitaly-yosef/node-smart-logger');
const { createLogger, generateLoggerTraceId, setLoggerContext, clearLoggerContext } = pkg;


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
  const traceId = data.traceId || generateLoggerTraceId();
  setLoggerContext({ deviceId: data.deviceId, traceId });
  logger.info(`Processing data from device ${data.deviceId}`);
  
  try {
    const device = await Device.findOne({ deviceId: data.deviceId });
    const timestamp = data.timestamp instanceof Date ? data.timestamp : new Date(data.timestamp);

    let res = null;
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
        logger.debug(`Data from new device ${data.deviceId} in 'pending' status will not be saved.`);
      } else {
        logger.warn(`Received data from an unregistered device: ${data.deviceId}. Data rejected.`);
      }
    } else {
      if (device.status === 'pending') {
        logger.debug(`Received data from an 'pending device: ${data.deviceId}. Data will not be saved.`);
      } else {
        if (device.status === 'inactive') {
          logger.debug(`Service: Received data from 'inactive' device: ${data.deviceId}. Saving data and updating status.`);
          device.status = 'active';
        }
        
        // Добавляем информацию о типе питания и эталонном напряжении из устройства, если она отсутствует в данных
        const dataToSave = { ...data, timestamp };
        
        if (data.powerType === undefined && device.powerType) {
          dataToSave.powerType = device.powerType;
          logger.debug(`Added powerType from device record: ${device.powerType}`);
        }
        
        if (data.referenceVoltage === undefined && device.referenceVoltage) {
          dataToSave.referenceVoltage = device.referenceVoltage;
          logger.debug(`Added referenceVoltage from device record: ${device.referenceVoltage}`);
        }
        
        const newDeviceDataInstance = new deviceData(dataToSave);

        const savedData = await createDeviceData(dataToSave);
        logger.debug(`Data saved into MongoDB with ID: ${savedData._id}.`);

        if (process.env.USE_KINESIS === 'true') {
          try {
            await sendToKinesis(dataToSave);
            logger.debug(`Data of device ${dataToSave.deviceId} sent to Kinesis successfully`);
          } catch (kinesisError) {
            logger.error(`Error sending data to Kinesis: ${kinesisError.message}`);
          }
        }

        await updateDeviceInfo(device, data);
        res = savedData;
      }
    }

    clearLoggerContext();
    return res;
  } catch (error) {
    logger.error(`Error(s) saving device's data: ${error.message}. `);
    clearLoggerContext();
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

    if (data.powerType !== undefined) {
      updateDetails.powerType = data.powerType;
    }
    if (data.powerType === POWER_TYPES.BATTERY || device.powerType === POWER_TYPES.BATTERY) {
      if (data.batteryLevel !== undefined) {
        updateDetails.batteryLevel = data.batteryLevel;
      }
      if (data.referenceVoltage !== undefined) {
        updateDetails.referenceVoltage = data.referenceVoltage;
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