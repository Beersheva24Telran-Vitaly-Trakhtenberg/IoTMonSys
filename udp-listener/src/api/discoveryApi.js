const express = require('express');
const { setDiscoveryMode, getDiscoveryMode } = require('../services/deviceDataService');
const pkg = require('@vitaly-yosef/node-smart-logger');
const { createLogger, generateLoggerTraceId, setLoggerContext, clearLoggerContext } = pkg;

const router = express.Router();
const logger = createLogger('discovery-api', './logs');

router.get('/discovery', (req, res) => {
  try {
    const traceId = generateLoggerTraceId();
    setLoggerContext({ operation: 'get-discovery-status', traceId });

    const status = getDiscoveryMode();

    logger.debug('Discovery mode status requested', { status });
    clearLoggerContext();
    res.json(status);
  } catch (error) {
    logger.error(`Error when receiving the discovery status: ${error.message}. ${error.stack}`);
    clearLoggerContext();
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/discovery', (req, res) => {
  try {
    const traceId = generateLoggerTraceId();
    setLoggerContext({ operation: 'set-discovery-mode', traceId });

    const { enabled, duration } = req.body;
    logger.debug('Discovery mode change requested', { enabled, duration });

    if (typeof enabled !== 'boolean') {
      logger.warn('Invalid discovery mode request: enabled parameter is not boolean', { enabled });
      clearLoggerContext();
      return res.status(400).json({ error: 'Incorrect type of status. Parametr enabled should be of type boolean.' });
    }

    const status = setDiscoveryMode(enabled, duration);
    logger.info('Discovery mode changed', { status });

    clearLoggerContext();
    res.json(status);
  } catch (error) {
    logger.error(`Error when changing the discovery mode: ${error.message}. ${error.stack}`);
    clearLoggerContext();
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;