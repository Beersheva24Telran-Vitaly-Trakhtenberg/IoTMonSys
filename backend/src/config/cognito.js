/**
 * AWS Cognito configuration
 * Contains settings for AWS Cognito User Pool and App Client
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import pkg from '@vitaly-yosef/node-smart-logger';
const { createLogger, generateLoggerTraceId, setLoggerContext, clearLoggerContext } = pkg;

const logger = createLogger('cognito', './logs');

// Default configuration (will be overridden by values from Secrets Manager in production)
let cognitoConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  clientId: process.env.COGNITO_CLIENT_ID,
  tokenUse: 'access', // Possible values: 'access' | 'id'
  tokenExpiration: 24 * 60 * 60, // 24 hours in seconds
  refreshTokenExpiration: 30 * 24 * 60 * 60, // 30 days in seconds
  jwtSecret: process.env.JWT_SECRET
};

/**
 * Ensure base64 string is properly padded
 * @param {string} base64 - Base64 string to pad
 * @returns {string} Properly padded base64 string
 */
function padBase64(base64) {
  // Add padding if needed
  const padding = base64.length % 4;
  if (padding) {
    return base64 + '='.repeat(4 - padding);
  }
  return base64;
}

/**
 * Load Cognito configuration from AWS Secrets Manager
 * Falls back to environment variables if Secrets Manager is not available
 */
export const loadCognitoConfig = async () => {
  // Skip if not in production
  if (process.env.NODE_ENV !== 'production') {
    logger.info('Not in production, using environment variables for Cognito config');
    return cognitoConfig;
  }
  
  const traceId = generateLoggerTraceId();
  
  setLoggerContext({
    traceId, 
    service: 'backend', 
    operation: 'loadCognitoConfig' 
  });
  
  try {
    logger.info('Loading Cognito configuration from AWS Secrets Manager');
    
    try {
      // Create Secrets Manager client
      const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
      
      // Get secret value
      const secretId = process.env.COGNITO_SECRET_ID || 'iotmonsys/cognito';
      const command = new GetSecretValueCommand({ SecretId: secretId });
      const response = await client.send(command);
      
      // Parse secret value
      const secretValue = JSON.parse(response.SecretString);
      
      // Update config with values from Secrets Manager
      cognitoConfig = {
        ...cognitoConfig,
        userPoolId: secretValue.userPoolId || cognitoConfig.userPoolId,
        clientId: secretValue.clientId || cognitoConfig.clientId,
        region: secretValue.region || cognitoConfig.region,
        jwtSecret: secretValue.jwtSecret || cognitoConfig.jwtSecret
      };
      
      // Ensure JWT secret is properly padded (if base64)
      if (cognitoConfig.jwtSecret) {
        cognitoConfig.jwtSecret = padBase64(cognitoConfig.jwtSecret);
      }
      
      logger.info('Cognito configuration loaded successfully from Secrets Manager');
      return cognitoConfig;
    } catch (error) {
      logger.error(`Failed to load Cognito config from Secrets Manager: ${error.message}`, { error });
      logger.warn('Falling back to environment variables for Cognito config');
      return cognitoConfig;
    }
  } finally {
    clearLoggerContext();
  }
};

/**
 * Get the current Cognito configuration
 * Loads from Secrets Manager if not already loaded
 */
export const getCognitoConfig = async () => {
  // If config is not loaded yet, load it
  if (!cognitoConfig.userPoolId || !cognitoConfig.clientId) {
    return await loadCognitoConfig();
  }
  
  return cognitoConfig;
};

export default {
  loadCognitoConfig,
  getCognitoConfig,
};
