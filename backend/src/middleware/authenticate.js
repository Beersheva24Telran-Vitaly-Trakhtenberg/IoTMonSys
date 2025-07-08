/**
 * Authentication middleware
 * Verifies JWT tokens from AWS Cognito and extracts user information
 */

import { CognitoJwtVerifier } from 'aws-jwt-verify';
import pkg from '@vitaly-yosef/node-smart-logger';
const { createLogger, generateLoggerTraceId, setLoggerContext, clearLoggerContext } = pkg;
import { getCognitoConfig } from '../config/cognito.js';
import jwt from 'jsonwebtoken';

const logger = createLogger('authenticate', './logs');

// Create a verifier that expects valid access tokens
let verifier;

/**
 * Initialize the Cognito JWT verifier
 * Must be called before using the authenticate middleware
 */
export const initializeVerifier = async () => {
  const traceId = generateLoggerTraceId();
  
  setLoggerContext({
    traceId, 
    service: 'backend', 
    operation: 'initializeVerifier' 
  });
  
  try {
    logger.info('Initializing Cognito JWT verifier');
    
    const config = await getCognitoConfig();
    verifier = CognitoJwtVerifier.create({
      userPoolId: config.userPoolId,
      tokenUse: 'access',
      clientId: config.clientId
    });
    
    logger.info('Cognito JWT verifier initialized successfully');
    return verifier;
  } catch (error) {
    logger.error(`Failed to initialize Cognito JWT verifier: ${error.message}`, { error });
    throw error;
  } finally {
    clearLoggerContext();
  }
};

/**
 * Middleware to authenticate requests using JWT tokens
 * Verifies the token and adds user information to the request object
 */
export const authenticate = async (req, res, next) => {
  const traceId = generateLoggerTraceId();
  
  setLoggerContext({
    traceId, 
    service: 'backend', 
    operation: 'authenticate' 
  });
  
  try {
    // Check if verifier is initialized
    if (!verifier) {
      logger.error('Cognito JWT verifier not initialized');
      return res.status(500).json({ message: 'Authentication service not initialized' });
    }
    
    // Get token from Authorization header or cookie
    const token = extractToken(req);
    
    if (!token) {
      logger.warn('No authentication token provided');
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Verify token
    try {
      const payload = await verifier.verify(token);
      
      // Add user info to request
      req.user = payload;
      req.user.role = determineUserRole(payload);
      
      logger.debug('User authenticated successfully', {
        userId: payload.sub,
        username: payload.username,
        role: req.user.role
      });
      
      next();
    } catch (error) {
      logger.warn(`Invalid authentication token: ${error.message}`, { error });
      return res.status(401).json({ message: 'Invalid authentication token' });
    }
  } catch (error) {
    logger.error(`Authentication error: ${error.message}`, { error });
    return res.status(500).json({ message: 'Authentication error' });
  } finally {
    clearLoggerContext();
  }
};

/**
 * Middleware to authenticate device action tokens
 * These are short-lived JWT tokens for device actions
 */
export const deviceActionToken = async (req, res, next) => {
  const traceId = generateLoggerTraceId();
  
  setLoggerContext({
    traceId, 
    service: 'backend', 
    operation: 'deviceActionToken' 
  });
  
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('DeviceAction ')) {
      logger.debug('No device action token provided');
      return next(); // Continue to next middleware (regular auth)
    }
    
    const token = authHeader.split(' ')[1];
    
    // Get JWT secret from Cognito config
    const config = await getCognitoConfig();
    if (!config.deviceActionJwtSecret) {
      logger.error('Device action JWT secret not configured');
      return res.status(500).json({ message: 'Device authentication not configured' });
    }
    
    try {
      // Verify token with specific secret
      const payload = jwt.verify(token, config.deviceActionJwtSecret, {
        algorithms: ['HS256'],
        clockTolerance: 30 // 30 seconds tolerance for clock skew
      });
      
      // Check if token is for device actions
      if (payload.type !== 'device_action') {
        logger.warn('Invalid device action token type', { type: payload.type });
        return res.status(401).json({ message: 'Invalid device action token' });
      }
      
      // Add device info to request
      req.user = {
        sub: payload.deviceId,
        deviceId: payload.deviceId,
        role: 'admin', // Device actions are performed as admin
        isDeviceAction: true,
        actions: payload.actions || []
      };
      
      req.deviceAction = true;
      
      logger.info('Device action token authenticated successfully', {
        deviceId: payload.deviceId,
        actions: payload.actions
      });
      
      next();
    } catch (error) {
      logger.warn(`Invalid device action token: ${error.message}`, { error });
      return res.status(401).json({ message: 'Invalid device action token' });
    }
  } catch (error) {
    logger.error(`Device authentication error: ${error.message}`, { error });
    return res.status(500).json({ message: 'Device authentication error' });
  } finally {
    clearLoggerContext();
  }
};

/**
 * Extract JWT token from request
 * Checks Authorization header and cookies
 */
function extractToken(req) {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const tokenFromCookie = req.cookies?.accessToken;

  let token = tokenFromHeader || tokenFromCookie;

  if (!token) {
    token = null;
    logger.warn('Invalid or Missing authentication token');
  } else {
    req.token = token;
    logger.debug('Authentication token extracted successfully');
  }

  return token;

/*
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  
  // Check cookies
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  
  return null;
*/
}

/**
 * Determine user role from JWT claims
 */
function determineUserRole(payload) {
  // Check for explicit role claim
  if (payload.role) {
    return payload.role;
  }
  
  // Check cognito:groups claim
  if (payload['cognito:groups'] && Array.isArray(payload['cognito:groups'])) {
    const groups = payload['cognito:groups'];
    
    // Map Cognito groups to roles (highest privilege wins)
    if (groups.includes('Administrators')) {
      return 'admin';
    } else if (groups.includes('Operators')) {
      return 'operator';
    } else if (groups.includes('Users')) {
      return 'user';
    }
  }
  
  // Default role
  return 'user';
}
