export const DATA_TYPES = {
  TEMPERATURE: 'temperature',
  HUMIDITY: 'humidity',
  LIGHT: 'light',
  PRESSURE: 'pressure',
  SOUND: 'sound',
  VIBRATION: 'vibration',
  OPENING: 'opening',
  AIR_QUALITY: 'air_quality',
  MULTI: 'multi',
  BATTERY: 'battery',
  CONNECTION: 'connection'
};

export const SENSOR_TYPES = [
  DATA_TYPES.TEMPERATURE,
  DATA_TYPES.HUMIDITY,
  DATA_TYPES.LIGHT,
  DATA_TYPES.PRESSURE,
  DATA_TYPES.SOUND,
  DATA_TYPES.VIBRATION,
  DATA_TYPES.OPENING,
  DATA_TYPES.AIR_QUALITY
];

export const DATA_VARIANTS = [
  ...SENSOR_TYPES,
  DATA_TYPES.BATTERY
];

export const DEVICE_TYPES = [
  ...SENSOR_TYPES,
  DATA_TYPES.MULTI
];

export const ALERT_TYPES = [
  ...DATA_VARIANTS,
  DATA_TYPES.CONNECTION
];
