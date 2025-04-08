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
  });

  // Другие тесты...
});