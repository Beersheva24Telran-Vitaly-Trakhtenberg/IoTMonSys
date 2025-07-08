/**
 * Authentication routes
 * Handles login, logout, token refresh, and password management
 */

import express from 'express';
import { 
  CognitoIdentityProviderClient, 
  InitiateAuthCommand,
  AdminInitiateAuthCommand,
  RespondToAuthChallengeCommand,
  AdminRespondToAuthChallengeCommand,
  ForgotPasswordCommand, 
  ConfirmForgotPasswordCommand,
  AssociateSoftwareTokenCommand,
  VerifySoftwareTokenCommand,
  SetUserMFAPreferenceCommand,
  GetUserCommand,
  GlobalSignOutCommand 
} from '@aws-sdk/client-cognito-identity-provider';
import pkg from '@vitaly-yosef/node-smart-logger';
const { createLogger, generateLoggerTraceId, setLoggerContext, clearLoggerContext } = pkg;
import { getCognitoConfig } from '../config/cognito.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();
const logger = createLogger('authRoutes', './logs');

// Login route
router.post('/login', async (req, res) => {
  const traceId = generateLoggerTraceId();
  setLoggerContext({ traceId, route: '/api/auth/login' });

  try {
    const { username, password } = req.body;

    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }

    // If no password is specified, we use the username - COGNITO API does not support empty passwords
    // (and for users with FORCE_CHANGE_PASSWORD as well).
    const userPassword = password || username;

    const config = await getCognitoConfig();

    try {
      // Firstly try the administrative API for users with FORCE_CHANGE_PASSWORD.
      const client = new CognitoIdentityProviderClient({ region: config.region });
      let response;
      
      try {
        const adminCommand = new AdminInitiateAuthCommand({
          UserPoolId: config.userPoolId,
          ClientId: config.clientId,
          AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
          AuthParameters: {
            USERNAME: username,
            PASSWORD: userPassword
          }
        });
        
        response = await client.send(adminCommand);
        logger.info(`Admin auth successful for user ${username}`);
      } catch (adminError) {
        // If the administrative API does not work, try the standard client API.
        logger.info(`Admin auth failed for ${username}: ${adminError.message}, trying standard auth flow`);
        
        const clientCommand = new InitiateAuthCommand({
          ClientId: config.clientId,
          AuthFlow: 'USER_PASSWORD_AUTH',
          AuthParameters: {
            USERNAME: username,
            PASSWORD: userPassword
          }
        });
        
        response = await client.send(clientCommand);
        logger.info(`Standard auth successful for user ${username}`);
      }

      // Handle MFA challenge if required
      if (response.ChallengeName === 'SOFTWARE_TOKEN_MFA') {
        return res.status(200).json({
          message: 'MFA verification required',
          session: response.Session,
          challengeName: response.ChallengeName
        });
      }

      // Handle NEW_PASSWORD_REQUIRED challenge
      if (response.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
        return res.status(200).json({
          message: 'Password change required',
          session: response.Session,
          challengeName: response.ChallengeName
        });
      }

      // Set cookies with tokens
      if (response.AuthenticationResult) {
        const { AccessToken, RefreshToken, IdToken, ExpiresIn } = response.AuthenticationResult;

        // Set secure cookies
        res.cookie('accessToken', AccessToken, {
          maxAge: ExpiresIn * 1000,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict'
        });

        if (RefreshToken) {
          res.cookie('refreshToken', RefreshToken, {
            maxAge: config.refreshTokenExpiration * 1000,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/api/auth/refresh-token'
          });
        }

        logger.info(`User ${username} logged in successfully`);

        return res.status(200).json({
          message: 'Login successful',
          token: AccessToken,
          expiresIn: ExpiresIn
        });
      }

      return res.status(500).json({ message: 'Authentication error' });
    } catch (error) {
      logger.error(`Login failed: ${error.message}`, { error });
      
      if (error.name === 'NotAuthorizedException') {
        return res.status(401).json({ message: 'Incorrect username or password' });
      } else if (error.name === 'UserNotConfirmedException') {
        return res.status(403).json({ message: 'User not confirmed' });
      } else if (error.name === 'UserNotFoundException') {
        return res.status(401).json({ message: 'Incorrect username or password' });
      } else if (error.name === 'InvalidParameterException' && error.message.includes('PASSWORD_VERIFIER')) {
        return res.status(400).json({ message: 'Authentication method not supported. Please check Cognito client settings' });
      } else if (error.name === 'AccessDeniedException') {
        return res.status(403).json({ message: 'Access denied. Check IAM permissions for Cognito API' });
      }
      
      return res.status(500).json({ message: `Authentication error: ${error.message}` });
    }
  } catch (error) {
    logger.error(`Login failed: ${error.message}`, { error });
    return res.status(500).json({ message: 'Authentication error' });
  } finally {
    clearLoggerContext();
  }
});

// MFA verification route
router.post('/mfa-verify', async (req, res) => {
  const traceId = generateLoggerTraceId();
  setLoggerContext({ traceId, route: '/api/auth/mfa-verify' });

  try {
    const { username, code, session } = req.body;

    if (!username || !code || !session) {
      return res.status(400).json({ message: 'Username, code, and session are required' });
    }

    const config = await getCognitoConfig();

    try {
      const client = new CognitoIdentityProviderClient({ region: config.region });
      let response;
      
      try {
        const clientCommand = new RespondToAuthChallengeCommand({
          ClientId: config.clientId,
          ChallengeName: 'SOFTWARE_TOKEN_MFA',
          ChallengeResponses: {
            USERNAME: username,
            SOFTWARE_TOKEN_MFA_CODE: code
          },
          Session: session
        });
        
        response = await client.send(clientCommand);
      } catch (clientError) {
        // If you received an authorization error, the session may have been created via the administrative API.
        if (clientError.name === 'NotAuthorizedException') {
          logger.info(`Standard MFA verification failed for ${username}, trying admin flow`);
          
          const adminCommand = new AdminRespondToAuthChallengeCommand({
            UserPoolId: config.userPoolId,
            ClientId: config.clientId,
            ChallengeName: 'SOFTWARE_TOKEN_MFA',
            ChallengeResponses: {
              USERNAME: username,
              SOFTWARE_TOKEN_MFA_CODE: code
            },
            Session: session
          });
          
          response = await client.send(adminCommand);
        } else {
          throw clientError;
        }
      }

      // Set cookies with tokens
      if (response.AuthenticationResult) {
        const { AccessToken, RefreshToken, IdToken, ExpiresIn } = response.AuthenticationResult;

        // Set secure cookies
        res.cookie('accessToken', AccessToken, {
          maxAge: ExpiresIn * 1000,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict'
        });

        if (RefreshToken) {
          res.cookie('refreshToken', RefreshToken, {
            maxAge: config.refreshTokenExpiration * 1000,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/api/auth/refresh-token'
          });
        }

        logger.info(`MFA verification successful for user ${username}`);

        return res.status(200).json({
          message: 'MFA verification successful',
          token: AccessToken,
          expiresIn: ExpiresIn
        });
      }

      return res.status(500).json({ message: 'Authentication error' });
    } catch (error) {
      logger.error(`MFA verification failed: ${error.message}`, { error });
      
      if (error.name === 'CodeMismatchException') {
        return res.status(400).json({ message: 'Invalid MFA code' });
      } else if (error.name === 'NotAuthorizedException') {
        return res.status(401).json({ message: 'Invalid session' });
      }
      
      return res.status(500).json({ message: 'MFA verification failed' });
    }
  } catch (error) {
    logger.error(`MFA verification failed: ${error.message}`, { error });
    return res.status(500).json({ message: 'Authentication error' });
  } finally {
    clearLoggerContext();
  }
});

// New password route for users with FORCE_CHANGE_PASSWORD status
router.post('/new-password', async (req, res) => {
  const traceId = generateLoggerTraceId();
  setLoggerContext({ traceId, route: '/api/auth/new-password' });

  try {
    const { username, newPassword, session } = req.body;

    if (!username || !newPassword || !session) {
      return res.status(400).json({ message: 'Username, new password, and session are required' });
    }

    const config = await getCognitoConfig();

    try {
      const client = new CognitoIdentityProviderClient({ region: config.region });
      
      // We use the administrative API to change the password, as this is required for users with FORCE_CHANGE_PASSWORD.
      const command = new AdminRespondToAuthChallengeCommand({
        UserPoolId: config.userPoolId,
        ClientId: config.clientId,
        ChallengeName: 'NEW_PASSWORD_REQUIRED',
        ChallengeResponses: {
          USERNAME: username,
          NEW_PASSWORD: newPassword
        },
        Session: session
      });
      
      const response = await client.send(command);

      // Handle MFA challenge if required after password change
      if (response.ChallengeName === 'SOFTWARE_TOKEN_MFA') {
        return res.status(200).json({
          message: 'Password changed, MFA required',
          session: response.Session,
          challengeName: response.ChallengeName
        });
      }

      // Set cookies with tokens
      if (response.AuthenticationResult) {
        const { AccessToken, RefreshToken, IdToken, ExpiresIn } = response.AuthenticationResult;

        // Set secure cookies
        res.cookie('accessToken', AccessToken, {
          maxAge: ExpiresIn * 1000,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict'
        });

        if (RefreshToken) {
          res.cookie('refreshToken', RefreshToken, {
            maxAge: config.refreshTokenExpiration * 1000,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/api/auth/refresh-token'
          });
        }

        logger.info(`User ${username} password changed successfully`);

        return res.status(200).json({
          message: 'Password changed successfully',
          token: AccessToken,
          expiresIn: ExpiresIn
        });
      }

      return res.status(500).json({ message: 'Authentication error after password change' });
    } catch (error) {
      logger.error(`Password change failed: ${error.message}`, { error });
      
      if (error.name === 'NotAuthorizedException') {
        return res.status(401).json({ message: 'Invalid credentials' });
      } else if (error.name === 'InvalidPasswordException') {
        return res.status(400).json({ message: 'Password does not meet security requirements' });
      }
      
      return res.status(500).json({ message: 'Password change failed' });
    }
  } catch (error) {
    logger.error(`Password change failed: ${error.message}`, { error });
    return res.status(500).json({ message: 'Authentication error' });
  } finally {
    clearLoggerContext();
  }
});

// Refresh token route
router.post('/refresh-token', async (req, res) => {
  const traceId = generateLoggerTraceId();
  setLoggerContext({ traceId, route: '/api/auth/refresh-token' });

  try {
    // Get refresh token from cookie
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token is required' });
    }

    const config = await getCognitoConfig();

    // Refresh tokens using Cognito
    const command = new InitiateAuthCommand({
      ClientId: config.clientId,
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      AuthParameters: {
        REFRESH_TOKEN: refreshToken
      }
    });

    const client = new CognitoIdentityProviderClient({ region: config.region });
    const response = await client.send(command);

    // Set new cookies
    if (response.AuthenticationResult) {
      const { AccessToken, IdToken, ExpiresIn } = response.AuthenticationResult;

      // Set secure cookies
      res.cookie('accessToken', AccessToken, {
        maxAge: ExpiresIn * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });

      logger.info('Token refreshed successfully');

      return res.status(200).json({
        message: 'Token refreshed successfully',
        token: AccessToken,
        expiresIn: ExpiresIn
      });
    }

    return res.status(500).json({ message: 'Token refresh failed' });
  } catch (error) {
    logger.error(`Token refresh failed: ${error.message}`, { error });

    if (error.name === 'NotAuthorizedException') {
      // Clear cookies on invalid refresh token
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken', { path: '/api/auth/refresh-token' });
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    return res.status(500).json({ message: 'Token refresh failed' });
  } finally {
    clearLoggerContext();
  }
});

// Logout route
router.post('/logout', authenticate, async (req, res) => {
  const traceId = generateLoggerTraceId();
  setLoggerContext({ traceId, route: '/api/auth/logout' });

  try {
    // Get access token from cookie or authorization header
    const accessToken = req.token || req.headers.authorization?.split(' ')[1];

    if (accessToken) {
      // Sign out from Cognito
      const command = new GlobalSignOutCommand({
        AccessToken: accessToken
      });

      const config = await getCognitoConfig();
      const client = new CognitoIdentityProviderClient({ region: config.region });
      await client.send(command);
    }

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken', { path: '/api/auth/refresh-token' });

    logger.info('User logged out successfully');

    return res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    logger.error(`Logout failed: ${error.message}`, { error });

    // Clear cookies even if logout fails
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken', { path: '/api/auth/refresh-token' });

    return res.status(200).json({ message: 'Logout successful' });
  } finally {
    clearLoggerContext();
  }
});

// Forgot password route
router.post('/forgot-password', async (req, res) => {
  const traceId = generateLoggerTraceId();
  setLoggerContext({ traceId, route: '/api/auth/forgot-password' });

  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }

    const config = await getCognitoConfig();

    // Request password reset
    const command = new ForgotPasswordCommand({
      ClientId: config.clientId,
      Username: username
    });

    const client = new CognitoIdentityProviderClient({ region: config.region });
    await client.send(command);

    logger.info(`Password reset requested for user ${username}`);

    return res.status(200).json({ message: 'Password reset code sent' });
  } catch (error) {
    logger.error(`Password reset request failed: ${error.message}`, { error });

    if (error.name === 'UserNotFoundException') {
      // Don't reveal if user exists or not
      return res.status(200).json({ message: 'Password reset code sent if user exists' });
    } else if (error.name === 'LimitExceededException') {
      return res.status(429).json({ message: 'Too many requests, please try again later' });
    }

    return res.status(500).json({ message: 'Password reset request failed' });
  } finally {
    clearLoggerContext();
  }
});

// Reset password route
router.post('/reset-password', async (req, res) => {
  const traceId = generateLoggerTraceId();
  setLoggerContext({ traceId, route: '/api/auth/reset-password' });

  try {
    const { username, password, code } = req.body;

    if (!username || !password || !code) {
      return res.status(400).json({ message: 'Username, password, and code are required' });
    }

    const config = await getCognitoConfig();

    // Reset password
    const command = new ConfirmForgotPasswordCommand({
      ClientId: config.clientId,
      Username: username,
      Password: password,
      ConfirmationCode: code
    });

    const client = new CognitoIdentityProviderClient({ region: config.region });
    await client.send(command);

    logger.info(`Password reset successful for user ${username}`);

    return res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    logger.error(`Password reset failed: ${error.message}`, { error });

    if (error.name === 'CodeMismatchException') {
      return res.status(400).json({ message: 'Invalid verification code' });
    } else if (error.name === 'ExpiredCodeException') {
      return res.status(400).json({ message: 'Verification code has expired' });
    } else if (error.name === 'InvalidPasswordException') {
      return res.status(400).json({ message: 'Password does not meet security requirements' });
    }

    return res.status(500).json({ message: 'Password reset failed' });
  } finally {
    clearLoggerContext();
  }
});

// Get current user info
router.get('/me', authenticate, (req, res) => {
  const traceId = generateLoggerTraceId();
  setLoggerContext({ traceId, route: '/api/auth/me' });

  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    logger.info(`User info retrieved for ${user.username}`);

    return res.status(200).json({ user });
  } catch (error) {
    logger.error(`Failed to get user info: ${error.message}`, { error });
    return res.status(500).json({ message: 'Failed to get user info' });
  } finally {
    clearLoggerContext();
  }
});

// MFA setup - Step 1: Get MFA setup information (QR code)
router.post('/mfa-setup', authenticate, async (req, res) => {
  const traceId = generateLoggerTraceId();
  setLoggerContext({ traceId, route: '/api/auth/mfa-setup' });

  try {
    const username = req.user.username;
    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }

    const config = await getCognitoConfig();
    const client = new CognitoIdentityProviderClient({ region: config.region });

    const command = new AssociateSoftwareTokenCommand({
      AccessToken: req.token
    });

    const response = await client.send(command);
    
    logger.info(`MFA setup initiated for user ${username}`);

    // Return the secret code for generating the QR code on the client
    return res.status(200).json({
      message: 'MFA setup initiated',
      secretCode: response.SecretCode
    });
  } catch (error) {
    logger.error(`MFA setup failed: ${error.message}`, { error });
    
    if (error.name === 'NotAuthorizedException') {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    return res.status(500).json({ message: `MFA setup failed: ${error.message}` });
  } finally {
    clearLoggerContext();
  }
});

// MFA setup - Step 2: Verify and activate MFA
router.post('/mfa-setup-verify', authenticate, async (req, res) => {
  const traceId = generateLoggerTraceId();
  setLoggerContext({ traceId, route: '/api/auth/mfa-setup-verify' });

  try {
    const { code } = req.body;
    const username = req.user.username;

    if (!code) {
      return res.status(400).json({ message: 'MFA code is required' });
    }

    const config = await getCognitoConfig();
    const client = new CognitoIdentityProviderClient({ region: config.region });

    // Верифицируем MFA-код
    const verifyCommand = new VerifySoftwareTokenCommand({
      AccessToken: req.token,
      UserCode: code
    });

    const verifyResponse = await client.send(verifyCommand);

    if (verifyResponse.Status === 'SUCCESS') {
      // Enable MFA for the user
      const setMfaCommand = new SetUserMFAPreferenceCommand({
        AccessToken: req.token,
        SoftwareTokenMfaSettings: {
          Enabled: true,
          PreferredMfa: true
        }
      });

      await client.send(setMfaCommand);
      
      logger.info(`MFA successfully setup for user ${username}`);
      
      return res.status(200).json({
        message: 'MFA setup successful',
        status: verifyResponse.Status
      });
    } else {
      return res.status(400).json({
        message: 'MFA verification failed',
        status: verifyResponse.Status
      });
    }
  } catch (error) {
    logger.error(`MFA setup verification failed: ${error.message}`, { error });
    
    if (error.name === 'CodeMismatchException') {
      return res.status(400).json({ message: 'Invalid MFA code' });
    } else if (error.name === 'NotAuthorizedException') {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    return res.status(500).json({ message: `MFA setup verification failed: ${error.message}` });
  } finally {
    clearLoggerContext();
  }
});

// Get MFA status
router.get('/mfa-status', authenticate, async (req, res) => {
  const traceId = generateLoggerTraceId();
  setLoggerContext({ traceId, route: '/api/auth/mfa-status' });

  try {
    const username = req.user.username;
    const config = await getCognitoConfig();
    const client = new CognitoIdentityProviderClient({ region: config.region });

    const command = new GetUserCommand({
      AccessToken: req.token
    });

    const response = await client.send(command);
    
    // Check if MFA is configured
    const mfaOptions = response.UserMFASettingList || [];
    const isMfaEnabled = mfaOptions.includes('SOFTWARE_TOKEN_MFA');
    
    logger.info(`MFA status checked for user ${username}: ${isMfaEnabled ? 'enabled' : 'disabled'}`);
    
    return res.status(200).json({
      mfaEnabled: isMfaEnabled
    });
  } catch (error) {
    logger.error(`MFA status check failed: ${error.message}`, { error });
    
    if (error.name === 'NotAuthorizedException') {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    return res.status(500).json({ message: `MFA status check failed: ${error.message}` });
  } finally {
    clearLoggerContext();
  }
});

export default router;
