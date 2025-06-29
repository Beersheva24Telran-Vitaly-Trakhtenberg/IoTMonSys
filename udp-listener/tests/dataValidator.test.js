const { validateDeviceData } = require('../src/utils/dataValidator');

describe('Data Validator', () => {
  test('Should validate correct device data', () => {
    const data = {
      deviceId: 'dev-123',
      type: 'temperature',
      value: 25.5,
      timestamp: new Date().toISOString()
    };

    const result = validateDeviceData(data);
    expect(result.isValid).toBe(true);
    expect(result.error).toBeNull();
  });

  test('Should reject data without deviceId', () => {
    const data = {
      type: 'temperature',
      value: 25.5,
      timestamp: new Date().toISOString()
    };

    const result = validateDeviceData(data);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('deviceId');
  });

  test('Should reject data without type', () => {
    const data = {
      deviceId: 'dev-123',
      value: 25.5,
      timestamp: new Date().toISOString()
    };

    const result = validateDeviceData(data);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('type');
  });

  test('Should reject data without value', () => {
    const data = {
      deviceId: 'dev-123',
      type: 'temperature',
      timestamp: new Date().toISOString()
    };

    const result = validateDeviceData(data);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('value');
  });

  test('Should reject data without timestamp', () => {
    const data = {
      deviceId: 'dev-123',
      type: 'temperature',
      value: 25.5
    };

    const result = validateDeviceData(data);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('timestamp');
  });

  test('Should reject data with invalid value type', () => {
    const data = {
      deviceId: 'dev-123',
      type: 'temperature',
      value: 'not-a-number',
      timestamp: new Date().toISOString()
    };

    const result = validateDeviceData(data);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('value');
  });

  test('Should reject data with invalid timestamp format', () => {
    const data = {
      deviceId: 'dev-123',
      type: 'temperature',
      value: 25.5,
      timestamp: 'Invalid Date String'
    };

    const result = validateDeviceData(data);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('timestamp');
  });
});