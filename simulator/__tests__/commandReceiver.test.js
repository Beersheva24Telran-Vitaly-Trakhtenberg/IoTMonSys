const dgram = require('dgram');
const CommandReceiver = require('../commandReceiver');
const host = '127.0.0.1';
const port = 41235;

jest.mock('dgram', () => {
  const eventHandlers = {}; // mock for events

  const mockSocket = {
    on: jest.fn((event, handler) => {
      eventHandlers[event] = handler;
      return mockSocket;
    }),
    bind: jest.fn(),
    address: jest.fn(() => ({ address: host, port: port })),
    close: jest.fn()
  };

  // emulate message receiving
  mockSocket.emitMessage = (msg, rinfo) => {
    if (eventHandlers.message) {
      const buffer = Buffer.isBuffer(msg) ? msg : Buffer.from(JSON.stringify(msg));
      eventHandlers.message(buffer, rinfo);
    }
  };

  // emulate raw message
  mockSocket.emitRawMessage = (msg, rinfo) => {
    if (eventHandlers.message) {
      eventHandlers.message(Buffer.from(msg), rinfo);
    }
  };

  // emulate error
  mockSocket.emitError = (error) => {
    if (eventHandlers.error) {
      eventHandlers.error(error);
    }
  };

  // emulate listening
  mockSocket.emitListening = () => {
    if (eventHandlers.listening) {
      eventHandlers.listening();
    }
  };

  mockSocket.getEventHandler = (event) => eventHandlers[event];

  return {
    createSocket: jest.fn(() => mockSocket)
  };
});

// Mock logger - prevent problem with its creation in tests
jest.mock('logger-node', () => {
  // Creating mock-functions for logger's methods
  const errorMock = jest.fn();
  const infoMock = jest.fn();
  const debugMock = jest.fn();
  const warnMock = jest.fn();

  return {
    createLogger: jest.fn(() => ({
      debug: debugMock,
      info: infoMock,
      error: errorMock,
      warn: warnMock
    }))
  };
});

describe('CommandReceiver', () => {
  let receiver;
  let mockSocket;

  beforeEach(() => {
    jest.clearAllMocks();

    receiver = new CommandReceiver(port);

    mockSocket = dgram.createSocket();
  });

  test('should initialize correctly', () => {
    expect(dgram.createSocket).toHaveBeenCalledWith('udp4');

    expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('message', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('listening', expect.any(Function));
  });

  test('should start listening on specified port', () => {
    receiver.start();

    expect(mockSocket.bind).toHaveBeenCalledWith(port);
  });

  test('should emit command event when message is received', (done) => {
    receiver.on('command', (command) => {
      expect(command).toEqual({ type: 'reset' });
      done();
    });

    mockSocket.emitMessage({ type: 'reset' }, { address: host, port: port });
  });

  test('should handle JSON parse errors', () => {
    const messageHandler = mockSocket.getEventHandler('message');

    const originalError = receiver.logger.error;
    receiver.logger.error = jest.fn();

    messageHandler(Buffer.from('{invalid json}'), { address: host, port: port });

    expect(receiver.logger.error).toHaveBeenCalled();

    receiver.logger.error = originalError;
  });

  test('should stop listening when stop is called', () => {
    receiver.stop();

    expect(mockSocket.close).toHaveBeenCalled();
  });

  test('should log when server is listening', () => {
    mockSocket.emitListening();

    expect(receiver.logger.info).toHaveBeenCalled();
  });

  test('should log errors', () => {
    mockSocket.emitError(new Error('Test error'));

    expect(receiver.logger.error).toHaveBeenCalled();
  });
});
