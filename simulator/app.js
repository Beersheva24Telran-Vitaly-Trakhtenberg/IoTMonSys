const { program } = require('commander'); // CLI library
const dotenv = require('dotenv');
const path = require('path');
const DeviceGenerator = require('./deviceGenerator');
const UdpSender = require('./udpSender');
const CommandReceiver = require('./commandReceiver');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const { createLogger } = require('@iotmonsys/logger-node');
const logger = createLogger('simulator', './logs');

const parseIntValue = (value) => {
  const parsedValue = parseInt(value, 10);
  if (isNaN(parsedValue)) {
    throw new Error('Value must be a number');
  }
  return parsedValue;
};

const parseFloatValue = (value) => {
  const parsedValue = parseFloat(value);
  if (isNaN(parsedValue)) {
    throw new Error('Value must be a number(float)');
  }
  return parsedValue;
};

const DEFAULT_DEVICES = process.env.DEVICE_COUNT || 5;
const DEFAULT_INTERVAL = process.env.SEND_INTERVAL || 5000;
const DEFAULT_UDP_PORT = process.env.UDP_PORT || 41234;
const DEFAULT_UDP_HOST = process.env.UDP_HOST || 'localhost';
const DEFAULT_COMMAND_PORT = process.env.COMMAND_PORT || 41235;
const DEFAULT_ANOMALY_RATE = process.env.ANOMALY_RATE || 5;

program
  .version('0.0.1')
  .description('IoT Device UDP Simulator for testing IoT monitoring systems')
  .option('-D, --devices <number>', 'Number of devices to generate', parseIntValue, DEFAULT_DEVICES)
  .option('-I, --interval <number>', 'Interval for sending data (ms)', parseIntValue, DEFAULT_INTERVAL)
  .option('-P, --udp-port <number>', 'UDP-port for sending data', parseIntValue, DEFAULT_UDP_PORT)
  .option('-H, --udp-host <string>', 'Host UDP-listener', DEFAULT_UDP_HOST)
  .option('-C, --command-port <number>', 'Port for receiving commands', parseIntValue, DEFAULT_COMMAND_PORT)
  .option('-A, --anomaly-rate <number>', 'Frequency of anomalies (0-100%)', parseFloatValue, DEFAULT_ANOMALY_RATE);

program.parse(process.argv);

const options = program.opts();

const deviceCount = options.devices || DEFAULT_DEVICES;
const sendInterval = options.interval || DEFAULT_INTERVAL;
const udpPort = options.udpPort || DEFAULT_UDP_PORT;
const udpHost = options.udpHost || DEFAULT_UDP_HOST;
const commandPort = options.commandPort || DEFAULT_COMMAND_PORT;
const anomalyRate = options.anomalyRate || DEFAULT_ANOMALY_RATE;

logger.info('Start of UDP-simulator of IoT devices');
logger.info(`Number of devices: ${options.devices}`);
logger.info(`Sending interval: ${options.interval} ms`);
logger.info(`UDP host: ${options.udpHost}:${options.udpPort}`);
logger.info(`Port for command: ${options.commandPort}`);
logger.info(`Frequency of anomalies: ${options.anomalyRate}%`);

const deviceGenerator = new DeviceGenerator(deviceCount, anomalyRate);
const udpSender = new UdpSender(udpHost, udpPort);
const commandReceiver = new CommandReceiver(commandPort);

commandReceiver.on('command', (command) => {
  logger.info(`Received command: ${JSON.stringify(command)}`);

  if (command.type === 'reset') {
    deviceGenerator.resetDevices();
    logger.info('Devices have been reset');
  } else if (command.type === 'setAnomaly') {
    deviceGenerator.setAnomalyRate(command.value);
    logger.info(`Frequency of anomalies has been set to ${command.value}%`);
  } else if (command.type === 'deviceCommand' && command.deviceId) {
    deviceGenerator.handleDeviceCommand(command.deviceId, command.action);
    logger.info(`Command ${command.action} has been sent to device ${command.deviceId}`);
  }
});

commandReceiver.start();

function sendDataPeriodically() {
  const devices = deviceGenerator.generateData();

  devices.forEach(device => {
    udpSender.send(device)
      .then(() => {
        logger.debug(`Data sent: ${JSON.stringify(device)}`);
      })
      .catch(err => {
        logger.error(`Errors in data sent: ${JSON.stringify(device)} : ${err.message}`);
      });
  });
}

const interval = setInterval(sendDataPeriodically, sendInterval);

process.on('SIGINT', () => {
  logger.info('Simulator is stopping...');
  clearInterval(interval);
  commandReceiver.stop();
  udpSender.close();
  process.exit(0);
});

sendDataPeriodically();
