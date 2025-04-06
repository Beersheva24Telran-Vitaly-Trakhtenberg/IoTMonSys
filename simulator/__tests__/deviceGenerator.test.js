const DeviceGenerator = require('../deviceGenerator');

describe('DeviceGenerator', () => {
  test('should initialize with correct number of devices', () => {
    const generator = new DeviceGenerator(10, 5);
    const data = generator.generateData();
    expect(data.length).toBe(10);
  });

  test('should generate valid data for each device', () => {
    const generator = new DeviceGenerator(5, 0);
    const data = generator.generateData();

    data.forEach(device => {
      expect(device).toHaveProperty('deviceId');
      expect(device).toHaveProperty('type');
      expect(device).toHaveProperty('value');
      expect(device).toHaveProperty('timestamp');
      expect(device).toHaveProperty('batteryLevel');
    });
  });

  test('should handle device commands correctly', () => {
    const generator = new DeviceGenerator(1, 0);
    const data = generator.generateData();
    const deviceId = data[0].deviceId;

    // Проверка команды toggleAnomaly
    expect(generator.handleDeviceCommand(deviceId, 'toggleAnomaly')).toBe(true);

    // Проверка команды для несуществующего устройства
    expect(generator.handleDeviceCommand('non-existent', 'toggleAnomaly')).toBe(false);
  });
});