const dgram = require('dgram');
const UdpListener = require('../src/udpListener');
const { validateDeviceData } = require('../src/utils/dataValidator');
const { saveDeviceData } = require('../src/services/deviceDataService');
const { sendToKinesis } = require('../src/services/kinesisService');

jest.mock('dgram');
jest.mock('../src/utils/dataValidator');
jest.mock('../src/database/database', () => ({
  saveDeviceData: jest.fn().mockResolvedValue({ _id: 'mock-id' })
}));
jest.mock('../src/services/kinesisService', () => ({
  sendToKinesis: jest.fn().mockResolvedValue({ ShardId: 'mock-shard-id' })
}));

describe('UDP Listener Core', () => {
  let listener;
  let mockServer;

  beforeEach(() => {
    jest.clearAllMocks();

    mockServer = {
      on: jest.fn(),
      bind: jest.fn(),
      close: jest.fn(),
      address: jest.fn().mockReturnValue({ address: '0.0.0.0', port: 41234 })
    };

    dgram.createSocket = jest.fn().mockReturnValue(mockServer);

    listener = new UdpListener('0.0.0.0', 41234);
  });

  test('Should setup event handlers on construction', () => {
    expect(dgram.createSocket).toHaveBeenCalledWith('udp4');
    expect(mockServer.on).toHaveBeenCalledWith('message', expect.any(Function));
    expect(mockServer.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockServer.on).toHaveBeenCalledWith('listening', expect.any(Function));
  });

  test('Should start the server on the specified host and port', () => {
    listener.start();
    expect(mockServer.bind).toHaveBeenCalledWith(41234, '0.0.0.0');
  });

  test('Should close the server when stop is called', () => {
    listener.stop();
    expect(mockServer.close).toHaveBeenCalled();
  });

  test('Should handle message events and process valid data', () => {
    const messageHandler = mockServer.on.mock.calls.find(call => call[0] === 'message')[1];

    const testData = {
      deviceId: 'dev-123',
      type: 'temperature',
      value: 25.5,
      timestamp: new Date().toISOString()
    };

    const message = Buffer.from(JSON.stringify(testData));
    const remote = { address: '192.168.1.100', port: 12345 };

    validateDeviceData.mockReturnValue({ isValid: true });

    messageHandler(message, remote);

    expect(validateDeviceData).toHaveBeenCalledWith(testData);
    expect(saveDeviceData).toHaveBeenCalled();
  });

  test('Should not process invalid data', () => {
    const messageHandler = mockServer.on.mock.calls.find(call => call[0] === 'message')[1];

    const testData = {
      type: 'temperature',
      value: 25.5,
      timestamp: new Date().toISOString()
    };

    const message = Buffer.from(JSON.stringify(testData));
    const remote = { address: '192.168.1.100', port: 12345 };

    validateDeviceData.mockReturnValue({ isValid: false, error: 'Missing deviceId' });

    messageHandler(message, remote);

    expect(validateDeviceData).toHaveBeenCalledWith(testData);
    expect(saveDeviceData).not.toHaveBeenCalled();
  });
});
