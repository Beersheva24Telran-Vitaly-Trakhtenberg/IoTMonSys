const express = require('express');
const { setDiscoveryMode, getDiscoveryMode } = require('../services/deviceDataService');
const { createLogger } = require('@iotmonsys/logger-node');

const router = express.Router();
const logger = createLogger('discovery-api', './logs');

router.get('/discovery', (req, res) => {
  try {
    const status = getDiscoveryMode();
    res.json(status);
  } catch (error) {
    logger.error(`Error when receiving the discovery status: ${error.message}. ${error.stack}`);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/discovery', (req, res) => {
  try {
    const { enabled, duration } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Incorrect type of status. Parametr enabled should be of type boolean.' });
    }

    const status = setDiscoveryMode(enabled, duration);
    res.json(status);
  } catch (error) {
    logger.error(`Error when changing the discovery mode: ${error.message}. ${error.stack}`);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;