jest.mock('dgram', () => {
  return {
    createSocket: jest.fn().mockReturnValue({
      on: jest.fn(),
      send: jest.fn((msg, offset, length, port, host, callback) => callback()),
      close: jest.fn()
    })
  };
});

const UdpSender = require('../udpSender');

describe('UdpSender', () => {
  test('should send data correctly', async () => {
    const sender = new UdpSender('localhost', 41234);
    const data = { deviceId: 'test', value: 10 };

    await expect(sender.send(data)).resolves.not.toThrow();
  });
});