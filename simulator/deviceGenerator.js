const { v4: uuidv4 } = require('uuid');
const { createLogger, generateLoggerTraceId, setLoggerContext } = require('@vitaly-yosef/node-smart-logger');

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

const POWER_TYPES = {
    BATTERY:'battery',
    SOLAR: 'solar',
    ELECTRICITY: 'electricity',
    WITHOUT_POWER:'without',
    OTHER_POWER_TYPES: 'other'
};

const ETALON_BATARY_LEVELS = {
  1_5: 1.5,
  1_8: 1.8,
  3_0: 3.0,
  3_6: 3.6,
  4_5: 4.5,
  9_0: 9.0,
  12_0: 12.0,
  18_0: 18.0,
  24_0: 24.0
}

class DeviceGenerator {
  /**
   * @param {number} deviceCount
   * @param {number} interval
   * @param {number} anomalyRate
   * @param {Object} logger
   */
  constructor(
    deviceCount = 5,
    interval = 5000,
    anomalyRate = 5,
    logger = null
  ) {
    this.deviceCount = deviceCount;
    this.interval = interval;
    this.anomalyRate = anomalyRate;
    
    // Инициализируем логгер без явного указания формата, используя настройки из .env
    this.logger = logger || createLogger('device-generator', './logs');
    
    // Создаем уникальный идентификатор для симулятора
    this.simulatorId = `sim-${uuidv4().substring(0, 8)}`;
    
    // Создаем уникальный идентификатор для трассировки логгера
    const loggerTraceId = generateLoggerTraceId();
    
    // Устанавливаем контекст логгера для симулятора
    setLoggerContext({ 
      simulatorId: this.simulatorId,
      deviceCount: this.deviceCount,
      traceId: loggerTraceId
    });
    
    // Инициализируем устройства после настройки логгера
    this.devices = this._initializeDevices(deviceCount);
    
    this.logger.info(`Initialized ${deviceCount} devices`);
  }

  _initializeDevices(count) {
    const devices = [];
    const dataTypes = Object.values(DATA_TYPES);
    const powerTypes = Object.values(POWER_TYPES);
    const etalonPowerValues = Object.values(ETALON_BATARY_LEVELS);

    for (let i = 0; i < count; i++) {
      // Note: Определяем тип устройства (для простоты используем первые 3 типа чаще)
      let deviceType;
      if (i < count * 0.4) {
        deviceType = DATA_TYPES.TEMPERATURE;
      } else if (i < count * 0.7) {
        deviceType = DATA_TYPES.HUMIDITY;
      } else if (i < count * 0.8) {
        deviceType = DATA_TYPES.LIGHT;
      } else if (i < count * 0.9) {
        deviceType = DATA_TYPES.OPENING;
      } else {
        deviceType = dataTypes[Math.floor(Math.random() * dataTypes.length)];
      }

      let powerType;
      if (i < count * 0.4) {
        powerType = POWER_TYPES.WITHOUT_POWER;
      } else if (i < count * 0.6) {
        powerType = POWER_TYPES.BATTERY;
      } else if (i < count * 0.8) {
        powerType = POWER_TYPES.ELECTRICITY;
      } else if (i < count * 0.9) {
        powerType = POWER_TYPES.SOLAR;
      } else {
        powerType = powerTypes[Math.floor(Math.random() * powerTypes.length)];
      }

      const deviceId = `dev-${uuidv4().substring(0, 8)}`;
      
      // Генерируем уникальный trace ID для каждого устройства
      const deviceTraceId = generateLoggerTraceId();
      
      const device = {
        deviceId: deviceId,
        type: deviceType,
        powerType: powerType,
        name: `${deviceType.charAt(0).toUpperCase() + deviceType.slice(1)} Sensor ${i + 1}`,
        location: ['Kitchen', 'Guest Room', 'Sleep Room', 'Bathroom', 'Cabinet'][Math.floor(Math.random() * 5)],
        status: 'active',
        lastValue: this._generateInitialValue(deviceType),
        anomalyMode: false,
        traceId: deviceTraceId // Сохраняем trace ID в объекте устройства
      };

      // Добавляем свойства для устройств с батарейным питанием
      if (device.powerType === POWER_TYPES.BATTERY) {
        device.referenceVoltage = etalonPowerValues[Math.floor(Math.random() * etalonPowerValues.length)];
        device.batteryLevel = Math.floor(Math.random() * 100); // Уровень заряда в процентах (0-100%)
      }

      // Добавляем устройство в список
      devices.push(device);
      
      // Логируем создание устройства с контекстом
      this.logger.withOperationContext({ 
        device: deviceId, 
        traceId: deviceTraceId 
      }, () => {
        this.logger.debug(`Created device: ${JSON.stringify(device)}`);
      });
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
    // Используем trace ID устройства или генерируем новый
    const traceId = device.traceId || generateLoggerTraceId();
    
    // Создаем контекст для текущей операции обновления
    const operationContext = {
      deviceId: device.deviceId,
      deviceType: device.type,
      powerType: device.powerType,
      traceId: traceId
    };
    
    // Создаем копию устройства для обновления
    const updatedDevice = { ...device };
    const type = updatedDevice.type;
    let newValue = updatedDevice.lastValue;
    let isAnomaly = false;
    let anomalyDetails = null;

    // Выполняем обновление значения в контексте логгера
    return this.logger.withOperationContext(operationContext, () => {
      if (updatedDevice.anomalyMode || Math.random() * 100 < this.anomalyRate) {
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
            newValue = updatedDevice.lastValue === 1 ? 0 : 1;
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

        this.logger.debug(`Anomaly detected for device ${updatedDevice.deviceId}: ${anomalyDetails}`);
      } else {
        // Генерация нормального значения с небольшим отклонением
        const deviation = this._getDeviation(type);
        newValue = updatedDevice.lastValue + (Math.random() * 2 - 1) * deviation;

        // Ограничение значений в нормальном диапазоне
        newValue = this._normalizeValue(type, newValue);
      }

      // Обновление заряда батареи только для устройств с батарейным питанием
      if (updatedDevice.powerType === POWER_TYPES.BATTERY) {
        // Разная скорость разрядки в зависимости от типа устройства и наличия аномалий
        let dischargeRate = Math.random() * 0.2; // Базовая скорость разрядки
        
        // Увеличиваем скорость разрядки при аномалиях
        if (isAnomaly) {
          dischargeRate *= 5;
        }
        
        // Разные типы устройств потребляют разное количество энергии
        switch (type) {
          case DATA_TYPES.TEMPERATURE:
            dischargeRate *= 0.8;
            break;
          case DATA_TYPES.HUMIDITY:
            dischargeRate *= 0.9;
            break;
          case DATA_TYPES.LIGHT:
            dischargeRate *= 1.2;
            break;
          case DATA_TYPES.VIBRATION:
            dischargeRate *= 1.5;
            break;
          default:
            dischargeRate *= 1;
        }
        
        // Обновляем заряд батареи
        updatedDevice.batteryLevel = Math.max(0, updatedDevice.batteryLevel - dischargeRate);
        
        // Логируем низкий заряд батареи
        if (updatedDevice.batteryLevel < 20) {
          this.logger.warn(`Low battery for device ${updatedDevice.deviceId}: ${updatedDevice.batteryLevel.toFixed(1)}%`);
        }
      }

      // Обновляем значение в устройстве
      updatedDevice.lastValue = newValue;
      
      // Формируем объект данных для отправки
      const data = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        deviceId: updatedDevice.deviceId,
        type: updatedDevice.type,
        value: updatedDevice.lastValue,
        status: updatedDevice.status,
        location: updatedDevice.location,
        traceId: traceId // Добавляем trace ID в данные для отправки
      };
      
      // Добавляем информацию о питании
      if (updatedDevice.powerType === POWER_TYPES.BATTERY) {
        data.batteryLevel = updatedDevice.batteryLevel;
        data.referenceVoltage = updatedDevice.referenceVoltage;
      } else if (updatedDevice.powerType === POWER_TYPES.ELECTRICITY) {
        data.powerConsumption = Math.random() * 5; // Случайное потребление энергии в Вт
      } else if (updatedDevice.powerType === POWER_TYPES.SOLAR) {
        // Для солнечных батарей добавляем уровень освещенности
        const dayTime = new Date().getHours();
        const isDaylight = dayTime >= 6 && dayTime <= 20;
        data.solarCharge = isDaylight ? 50 + Math.random() * 50 : Math.random() * 10;
      }
      
      // Добавляем информацию об аномалии, если она есть
      if (isAnomaly) {
        data.anomaly = {
          detected: true,
          details: anomalyDetails
        };
      }
      
      // Обновляем устройство в массиве устройств
      const deviceIndex = this.devices.findIndex(d => d.deviceId === updatedDevice.deviceId);
      if (deviceIndex !== -1) {
        this.devices[deviceIndex] = updatedDevice;
      }
      
      return data;
    });
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
    
    // Устанавливаем контекст логгера для текущего устройства и операции
    if (this.logger && typeof this.logger.withOperationContext === 'function') {
      this.logger.withOperationContext({
        deviceId: deviceId,
        operationType: action
      });
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
          const powerType = device.powerType;
          const referenceVoltage = device.referenceVoltage;
          
          this.logger.info(`Resetting device ${deviceId} (type: ${type}, powerType: ${powerType})`);
          
          this.devices[deviceIndex].lastValue = this._generateInitialValue(type);
          this.devices[deviceIndex].anomalyMode = false;
          
          // Сохраняем тип питания и обрабатываем батарейное питание
          if (powerType === POWER_TYPES.BATTERY) {
            const oldBatteryLevel = this.devices[deviceIndex].batteryLevel;
            this.devices[deviceIndex].batteryLevel = Math.floor(Math.random() * 100);
            
            this.logger.debug(`Battery level reset from ${oldBatteryLevel.toFixed(2)}% to ${this.devices[deviceIndex].batteryLevel}% for device ${deviceId}`);
            
            // Сохраняем эталонное напряжение, если оно было
            if (referenceVoltage) {
              this.devices[deviceIndex].referenceVoltage = referenceVoltage;
              this.logger.debug(`Reference voltage preserved at ${referenceVoltage}V for device ${deviceId}`);
            }
          }
          
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

    // Очищаем контекст после обработки команды
    if (this.logger && typeof this.logger.clearContext === 'function') {
      this.logger.clearContext();
      // Восстанавливаем контекст симулятора
      this.logger.setContext({
        simulatorId: this.simulatorId,
        deviceCount: this.deviceCount
      });
    }

    return true;
  }
}

module.exports = DeviceGenerator;