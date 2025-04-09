const dgram = require('dgram');
const EventEmitter = require('events');
const loggerLibrary = require('@iotmonsys/logger-node');

class CommandReceiver extends EventEmitter {
  logger = loggerLibrary.createLogger('command-receiver', './logs');

  /**
   * @param {number} port
   */
  constructor(port ) {
    super();
    this.port = port;
    this.server = dgram.createSocket('udp4');

    this.server.on('error', (err) => {
      this.logger.error(`Server error: ${err.message}`);
      this.server.close();
    });

    this.server.on('message', (msg, rinfo) => {
      try {
        const command = JSON.parse(msg.toString());
        this.logger.debug(`Received command from ${rinfo.address}:${rinfo.port}: ${JSON.stringify(command)}`);
        this.emit('command', command);
      } catch (err) {
        this.logger.error(`Command processing error from ${rinfo.address}:${rinfo.port}: ${msg.toString()}: ${err.message}`);
      }
    });

    this.server.on('listening', () => {
      const address = this.server.address();
      this.logger.info(`Command server listening on ${address.address}:${address.port}.`);
    });
  }

  start() {
    this.server.bind(this.port);
    this.logger.info(`Started receiving of command on port ${this.port}`);
  }

  stop() {
    this.server.close();
    this.logger.info('Command server stopped.');
  }
}

module.exports = CommandReceiver;