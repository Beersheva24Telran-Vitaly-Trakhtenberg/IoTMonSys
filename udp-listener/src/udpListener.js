const dgram = require('dgram');
const { createLogger } = require('@iotmonsys/logger-node');
const { validateDeviceData } = require('./utils/dataValidator');
const { saveDeviceData } = require('./database/database');
const { sendToKinesis } = require('./services/kinesisService');

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
      try {
        const data = JSON.parse(message.toString());
        this.logger.debug(`Data received from ${remote.address}:${remote.port}: ${JSON.stringify(data)}`);

        const validationResult = validateDeviceData(data);
        if (!validationResult.isValid) {
          this.logger.warn(`Incorrect data from ${remote.address}:${remote.port}: ${validationResult.error}`);
          return;
        }

        await saveDeviceData(this.db, data);

        if (process.env.USE_KINESIS === 'true') {
          try {
            await sendToKinesis(data);
            this.logger.debug(`Data of device ${data.deviceId} sent to Kinesis sucessfully: ${JSON.stringify(data)}`);
          } catch (kinesisError) {
            this.logger.error(`Error sending data to Kinesis: ${kinesisError.message}`);
          }
        }
      } catch (error) {
        this.logger.error(`Error processing message: ${error.message}`);
      }
    });

    this.server.on('error', (err) => {
      this.logger.error(`UDP-server error: ${err.message}`);
      this.server.close();
    });

    this.server.on('listening', () => {
      const address = this.server.address();
      this.logger.info(`UDP-server listening on ${address.address}:${address.port}`);
    });
  }

  start() {
    this.server.bind(this.port, this.host);
    this.logger.info(`Running UDP-listener on ${this.host}:${this.port}`);
  }

  stop() {
    this.server.close();
    this.logger.info('UDP-listener stopped.');
  }
}

module.exports = UdpListener;