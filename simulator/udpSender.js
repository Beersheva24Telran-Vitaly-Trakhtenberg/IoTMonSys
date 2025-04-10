const dgram = require('dgram');
const { createLogger } = require('@iotmonsys/logger-node');

class UdpSender {
  logger = createLogger('udp-sender', './logs');

  /**
   * @param {number} host
   * @param {number} port
   */
  constructor(host, port) {
    this.host = host;
    this.port = port;
    this.client = dgram.createSocket('udp4');

    this.client.on('error', (err) => {
      this.logger.error(`UDP client error: ${err.message}`);
      this.client.close();
    });

    this.logger.info(`UDP sender initialized for ${host}:${port}`);
  }

  send(data) {
    return new Promise((resolve, reject) => {
      const message = Buffer.from(JSON.stringify(data));

      this.client.send(message, 0, message.length, this.port, this.host, (err) => {
        if (err) {
          this.logger.error(`Error in data sent: ${JSON.stringify(data)} : ${err.message}`);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  close() {
    this.client.close();
    this.logger.info('UDP client closed');
  }
}

module.exports = UdpSender;