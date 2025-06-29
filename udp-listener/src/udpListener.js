const dgram = require('dgram');
const pkg = require('@vitaly-yosef/node-smart-logger');
const { createLogger, generateLoggerTraceId, setLoggerContext, clearLoggerContext } = pkg;
const { validateDeviceData } = require('./utils/dataValidator');
const { saveDeviceData } = require('./services/deviceDataService');

class UdpListener {
  constructor(host, port, db) {
    this.host = host;
    this.port = port;
    this.db = db;
    this.server = dgram.createSocket('udp4');
    this.logger = createLogger('udp-listener', './logs');

    this._setupEventHandlers();
  }

  _setupEventHandlers() {
    this.server.on('message', async (message, remote) => {
      const traceId = generateLoggerTraceId();
      setLoggerContext({ operation: 'udp-message', remote: `${remote.address}:${remote.port}`, traceId });
      
      try {
        const data = JSON.parse(message.toString());
        this.logger.debug(`Data received from ${remote.address}:${remote.port}: ${JSON.stringify(data)}`);

        const validationResult = validateDeviceData(data);
        if (!validationResult.isValid) {
          this.logger.warn(`Incorrect data from ${remote.address}:${remote.port}: ${validationResult.error}`);
          clearLoggerContext();
          return;
        }

        // Передаем traceId в данные для сквозной трассировки
        data.traceId = traceId;
        await saveDeviceData(data);
      } catch (error) {
        this.logger.error(`Error processing message: ${error.message}`, { stack: error.stack });
        clearLoggerContext();
      }
    });

    this.server.on('error', (err) => {
      const traceId = generateLoggerTraceId();
      setLoggerContext({ operation: 'udp-server-error', traceId });
      this.logger.error(`UDP-server error: ${err.message}`, { stack: err.stack });
      clearLoggerContext();
      this.server.close();
    });

    this.server.on('listening', () => {
      const traceId = generateLoggerTraceId();
      const address = this.server.address();
      setLoggerContext({ operation: 'udp-server-start', address: `${address.address}:${address.port}`, traceId });
      this.logger.info(`UDP-server listening on ${address.address}:${address.port}`);
      clearLoggerContext();
    });
  }

  start() {
    const traceId = generateLoggerTraceId();
    setLoggerContext({ operation: 'udp-server-bind', address: `${this.host}:${this.port}`, traceId });
    this.server.bind(this.port, this.host);
    this.logger.info(`Running UDP-listener on ${this.host}:${this.port}`);
    clearLoggerContext();
  }

  stop() {
    const traceId = generateLoggerTraceId();
    setLoggerContext({ operation: 'udp-server-stop', traceId });
    if (this.server) {
      this.server.close(() => {
        this.logger.info('UDP-server stopped');
        clearLoggerContext();
      });
    }
  }
}

module.exports = UdpListener;