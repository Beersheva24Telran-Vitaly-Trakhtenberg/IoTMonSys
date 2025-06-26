const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '.env') });

const UdpListener = require('./src/udpListener');
const { createLogger } = require('@iotmonsys/logger-node');
const { connectDB } = require('./src/database/database');
const express = require('express');
const bodyParser = require('body-parser');
const discoveryApi = require('./src/api/discoveryApi');

const logger = createLogger('udp-listener-main', './logs');

const UDP_PORT = process.env.UDP_PORT || 41234;
const UDP_HOST = process.env.UDP_HOST || '0.0.0.0';
const API_PORT = process.env.API_PORT || 3001;

const app = express();
app.use(bodyParser.json());

app.use('/api', discoveryApi);

connectDB().then(() => {
  const listener = new UdpListener(UDP_HOST, UDP_PORT);
  listener.start();

  try {
    logger.info(`UDP-listener started on ${UDP_HOST}:${UDP_PORT}`);
  } catch (error) {
    logger.error(`Error when logging start of UDP-listener: ${error.message}. ${error.stack}`);
  }

  const server = app.listen(API_PORT, () => {
    logger.info(`API-server started on ${API_PORT}`);
  });

  process.on('SIGINT', async () => {
    logger.info('Stopping work...');
    listener.stop();

    server.close(() => {
      logger.info('HTTP-server stopped.');
    });

    process.exit(0);
  });

  process.on('unhandledRejection', (err) => {
    logger.alert(`Unhandled Rejection: ${err.message}`);
    listener.stop();
    server.close();
    process.exit(1);
  });
}).catch(err => {
  logger.error(`Can't connect to MongoDB database: ${err.message}`);
  process.exit(1);
});
