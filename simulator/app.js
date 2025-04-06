const { program } = require('commander');
const dotenv = require('dotenv');
const path = require('path');
const { createLogger } = require('./logger');
const DeviceGenerator = require('./deviceGenerator');
const UdpSender = require('./udpSender');
const CommandReceiver = require('./commandReceiver');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const logger = createLogger('simulator');

program
  .version('0.0.1')
  .option('-d, --devices <number>', 'Number of devices to generate', parseInt, 5)
  .option('-i, --interval <number>', 'Interval for sending data (ms)', parseInt, 5000)
  .option('-p, --udp-port <number>', 'UDP-port for sending data', parseInt, 41234)
  .option('-h, --udp-host <string>', 'Host UDP-listener', 'localhost')
  .option('-c, --command-port <number>', 'Port for receiving commands', parseInt, 41235)
  .option('-a, --anomaly-rate <number>', 'Frequency of anomalies (0-100%)', parseFloat, 5)
  .parse(process.argv);

const options = program.opts();

logger.info('Start of UDP-simulator of IoT devices');
logger.info(`Number of devices: ${options.devices}`);
logger.info(`Sending interval: ${options.interval} мс`);
logger.info(`UDP host: ${options.udpHost}:${options.udpPort}`);
logger.info(`Port for command: ${options.commandPort}`);
logger.info(`Frequency of anomalies: ${options.anomalyRate}%`);

const deviceGenerator = new DeviceGenerator(options.devices, options.anomalyRate);
const udpSender = new UdpSender(options.udpHost, options.udpPort);
const commandReceiver = new CommandReceiver(options.commandPort);

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

const interval = setInterval(sendDataPeriodically, options.interval);

process.on('SIGINT', () => {
  logger.info('Simulator is stopping...');
  clearInterval(interval);
  commandReceiver.stop();
  udpSender.close();
  process.exit(0);
});

sendDataPeriodically();
