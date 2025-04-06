const { v4: uuidv4 } = require('uuid');
const { createLogger } = require('./logger');

const DATA_TYPES = {
  TEMPERATURE: 'temperature',
  HUMIDITY: 'humidity',
  LIGHT: 'light',
  PRESSURE: 'pressure',
  SOUND: 'sound',
  VIBRATION: 'vibration',
  OPENING: 'opening',
  AIR_QUALITY: 'air_quality',
  BATTERY: 'battery'
};

class DeviceGenerator {
  constructor(deviceCount = 5, anomalyRate = 5) {
    this.logger = createLogger('device-generator');
    this.deviceCount = deviceCount;
    this.anomalyRate = anomalyRate;
    this.devices = this._initializeDevices(deviceCount);
    this.logger.info(`Initialized ${deviceCount} devices`);
  }

  _initializeDevices(count) {
    const devices = [];
    const types = Object.values(DATA_TYPES);

    for (let i = 0; i < count; i++) {
      // Note: Определяем тип устройства (для простоты используем первые 3 типа чаще)
      let deviceType;
      if (i < count * 0.4) {
        deviceType = DATA_TYPES.TEMPERATURE;
      } else if (i < count * 0.7) {
        deviceType = DATA_TYPES.HUMIDITY;
      } else if (i < count * 0.9) {
        deviceType = DATA_TYPES.LIGHT;
      } else {
        deviceType = types[Math.floor(Math.random() * types.length)];
      }

      const device = {
        deviceId: `dev-${uuidv4().substring(0, 8)}`,
        type: deviceType,
        name: `${deviceType.charAt(0).toUpperCase() + deviceType.slice(1)} Sensor ${i + 1}`,
        location: ['Kitchen', 'Guest Room', 'Sleep Room', 'Bathroom', 'Cabinet'][Math.floor(Math.random() * 5)],
        status: 'active',
        batteryLevel: Math.floor(Math.random() * 100),
        lastValue: this._generateInitialValue(deviceType),
        anomalyMode: false
      };

      devices.push(device);
      this.logger.debug(`Created device: ${JSON.stringify(device)}`);
    }

    return devices;
  }

  _generateInitialValue(type) {
    switch (type) {
      case DATA_TYPES.TEMPERATURE:
        return 20 + (Math.random() * 5); // 20-25°C
      case DATA_TYPES.HUMIDITY:
        return 40 + (Math.random() * 20); // 40-60%
      case DATA_TYPES.LIGHT:
        return 200 + (Math.random() * 300); // 200-500 люкс
      case DATA_TYPES.PRESSURE:
        return 1000 + (Math.random() * 20); // 1000-1020 гПа
      case DATA_TYPES.SOUND:
        return 30 + (Math.random() * 20); // 30-50 дБ
      case DATA_TYPES.VIBRATION:
        return Math.random() * 1; // 0-1 g
      case DATA_TYPES.OPENING:
        return Math.random() > 0.8 ? 1 : 0; // 1 (открыто) или 0 (закрыто)
      case DATA_TYPES.AIR_QUALITY:
        return 50 + (Math.random() * 100); // 50-150 AQI
      case DATA_TYPES.BATTERY:
        return 50 + (Math.random() * 50); // 50-100%
      default:
        return Math.random() * 100;
    }
  }

  _updateValue(device) {
    const type = device.type;
    let newValue = device.lastValue;
    let isAnomaly = false;
    let anomalyDetails = null;

    if (device.anomalyMode || Math.random() * 100 < this.anomalyRate) {
      isAnomaly = true;

      // Генерация аномального значения
      switch (type) {
        case DATA_TYPES.TEMPERATURE:
          newValue = Math.random() > 0.5 ? -10 + (Math.random() * 10) : 40 + (Math.random() * 20);
          anomalyDetails = newValue < 0 ? 'Temperature critically low' : 'Temperature critically high';
          break;
        case DATA_TYPES.HUMIDITY:
          newValue = Math.random() > 0.5 ? Math.random() * 10 : 90 + (Math.random() * 15);
          anomalyDetails = newValue < 10 ? 'Humidity critically low' : 'Humidity critically high';
          break;
        case DATA_TYPES.LIGHT:
          newValue = Math.random() > 0.7 ? 5000 + (Math.random() * 5000) : 0;
          anomalyDetails = newValue > 5000 ? 'Too bright lighting' : 'No lighting';
          break;
        case DATA_TYPES.PRESSURE:
          newValue = Math.random() > 0.5 ? 950 + (Math.random() * 10) : 1050 + (Math.random() * 10);
          anomalyDetails = newValue < 970 ? 'Abnormally low pressure' : 'Abnormally high pressure';
          break;
        case DATA_TYPES.SOUND:
          newValue = 80 + (Math.random() * 40);
          anomalyDetails = 'High noise level';
          break;
        case DATA_TYPES.VIBRATION:
          newValue = 5 + (Math.random() * 5);
          anomalyDetails = 'High vibration level';
          break;
        case DATA_TYPES.OPENING:
          // Для бинарных датчиков аномалия - частое изменение состояния
          newValue = device.lastValue === 1 ? 0 : 1;
          anomalyDetails = 'Frequent change of state';
          break;
        case DATA_TYPES.AIR_QUALITY:
          newValue = 200 + (Math.random() * 300);
          anomalyDetails = 'Low quality of air';
          break;
        case DATA_TYPES.BATTERY:
          newValue = Math.random() * 10;
          anomalyDetails = 'Critical low battery charge';
          break;
        default:
          newValue = Math.random() * 1000;
          anomalyDetails = 'Anomaly value';
      }

      this.logger.debug(`Anomaly detected for device ${device.deviceId}: ${anomalyDetails}`);
    } else {
      // Генерация нормального значения с небольшим отклонением
      const deviation = this._getDeviation(type);
      newValue = device.lastValue + (Math.random() * 2 - 1) * deviation;

      // Ограничение значений в нормальном диапазоне
      newValue = this._normalizeValue(type, newValue);
    }

    // Обновление заряда батареи
    device.batteryLevel = Math.max(0, device.batteryLevel - Math.random() * 0.2);

    // Обновление последнего значения
    device.lastValue = newValue;

    return {
      deviceId: device.deviceId,
      type,
      value: newValue,
      timestamp: new Date().toISOString(),
      batteryLevel: device.batteryLevel,
      isAnomaly,
      anomalyDetails
    };
  }

  _getDeviation(type) {
    switch (type) {
      case DATA_TYPES.TEMPERATURE:
        return 0.5; // ±0.5°C
      case DATA_TYPES.HUMIDITY:
        return 2; // ±2%
      case DATA_TYPES.LIGHT:
        return 50; // ±50 люкс
      case DATA_TYPES.PRESSURE:
        return 1; // ±1 гПа
      case DATA_TYPES.SOUND:
        return 3; // ±3 дБ
      case DATA_TYPES.VIBRATION:
        return 0.1; // ±0.1 g
      case DATA_TYPES.OPENING:
        return 0; // Бинарное значение, нет отклонения
      case DATA_TYPES.AIR_QUALITY:
        return 10; // ±10 AQI
      case DATA_TYPES.BATTERY:
        return 0.5; // ±0.5%
      default:
        return 5;
    }
  }

  _normalizeValue(type, value) {
    switch (type) {
      case DATA_TYPES.TEMPERATURE:
        return Math.max(-10, Math.min(40, value));
      case DATA_TYPES.HUMIDITY:
        return Math.max(0, Math.min(100, value));
      case DATA_TYPES.LIGHT:
        return Math.max(0, Math.min(2000, value));
      case DATA_TYPES.PRESSURE:
        return Math.max(970, Math.min(1040, value));
      case DATA_TYPES.SOUND:
        return Math.max(0, Math.min(80, value));
      case DATA_TYPES.VIBRATION:
        return Math.max(0, Math.min(2, value));
      case DATA_TYPES.OPENING:
        return value > 0.5 ? 1 : 0;
      case DATA_TYPES.AIR_QUALITY:
        return Math.max(0, Math.min(200, value));
      case DATA_TYPES.BATTERY:
        return Math.max(0, Math.min(100, value));
      default:
        return value;
    }
  }

  generateData() {
    return this.devices.map(device => this._updateValue(device));
  }

  resetDevices() {
    this.devices = this._initializeDevices(this.deviceCount);
    return this.devices;
  }

  setAnomalyRate(rate) {
    this.anomalyRate = parseFloat(rate);
    this.logger.info(`Frequency of anomalies set to ${this.anomalyRate}%`);
  }

  handleDeviceCommand(deviceId, action) {
    const device = this.devices.find(d => d.deviceId === deviceId);
    if (!device) {
      this.logger.warn(`Device ID ${deviceId} not found`);
      return false;
    }

    switch (action) {
      case 'toggleAnomaly':
        device.anomalyMode = !device.anomalyMode;
        this.logger.info(`Anomaly mode for device ${deviceId} has been ${device.anomalyMode ? 'enabled' : 'disabled'}. `);
        break;
      case 'reset':
        const deviceIndex = this.devices.findIndex(d => d.deviceId === deviceId);
        if (deviceIndex !== -1) {
          const type = device.type;
          this.devices[deviceIndex].lastValue = this._generateInitialValue(type);
          this.devices[deviceIndex].batteryLevel = Math.floor(Math.random() * 100);
          this.devices[deviceIndex].anomalyMode = false;
          this.logger.info(`Device ${deviceId} has been reset.`);
        }
        break;
      case 'toggleStatus':
        device.status = device.status === 'active' ? 'inactive' : 'active';
        this.logger.info(`Status device ${deviceId} changed to ${device.status}`);
        break;
      default:
        this.logger.warn(`Unknown command: ${action}`);
        return false;
    }

    return true;
  }
}

module.exports = DeviceGenerator;