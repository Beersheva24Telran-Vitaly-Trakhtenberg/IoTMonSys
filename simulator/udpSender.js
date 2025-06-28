const dgram = require('dgram');

const { createLogger, generateLoggerTraceId, setLoggerContext } = require('@vitaly-yosef/node-smart-logger');

class UdpSender {
  logger = createLogger('udp-sender', './logs');

  /**
   * @param {string} host
   * @param {number} port
   */
  constructor(host, port) {
    this.host = host;
    this.port = port;
    this.client = dgram.createSocket('udp4');
    
    // Создаем уникальный идентификатор для UDP-отправителя
    this.senderId = `sender-${Math.random().toString(36).substring(2, 10)}`;
    
    // Устанавливаем контекст логирования
    setLoggerContext({ 
      senderId: this.senderId, 
      host: this.host, 
      port: this.port,
      traceId: generateLoggerTraceId()
    });
    
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