const dgram = require('dgram');
const EventEmitter = require('events');
const { createLogger, generateLoggerTraceId, setLoggerContext } = require('@vitaly-yosef/node-smart-logger');

class CommandReceiver extends EventEmitter {
  logger = createLogger('command-receiver', './logs');

  /**
   * @param {number} port
   */
  constructor(port) {
    super();
    this.port = port;
    this.server = dgram.createSocket('udp4');
    
    // Создаем уникальный идентификатор для устройства
    this.deviceId = `dev-${Math.random().toString(16).substring(2, 10)}`;
    
    // Устанавливаем контекст логирования
    setLoggerContext({ 
      deviceId: this.deviceId, 
      port: this.port,
      traceId: generateLoggerTraceId()
    });

    this.server.on('error', (err) => {
      this.logger.error(`Command server error: ${err.message}`);
      this.server.close();
    });

    this.server.on('message', (msg, rinfo) => {
      try {
        const command = JSON.parse(msg.toString());
        
        // Добавляем контекст для каждой команды
        const commandTraceId = generateLoggerTraceId();
        this.logger.withOperationContext({ 
          commandId: command.id || 'unknown',
          commandType: command.type || 'unknown',
          sourceIp: rinfo.address,
          sourcePort: rinfo.port,
          traceId: commandTraceId
        }, () => {
          this.logger.info(`Received command: ${command.type || 'unknown'}`);
          this.emit('command', command);
        });
      } catch (e) {
        this.logger.error(`Failed to parse command: ${e.message}`);
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