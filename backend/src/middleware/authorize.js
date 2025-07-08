/**
 * Authorization middleware
 * Verifies user roles and permissions for accessing resources
 */

import pkg from '@vitaly-yosef/node-smart-logger';
const { createLogger, generateLoggerTraceId, setLoggerContext, clearLoggerContext } = pkg;

const logger = createLogger('authorize', './logs');

/**
 * Maps Cognito groups to internal roles
 * This ensures consistent role naming across the application
 */
export const COGNITO_GROUP_TO_ROLE_MAP = {
  'Administrators': 'admin',
  'Operators': 'operator',
  'Users': 'user'
};

/**
 * Middleware to authorize requests based on user roles
 * @param {string|string[]} allowedRoles - Role or array of roles allowed to access the resource
 * @returns {Function} Express middleware function
 */
const authorize = (allowedRoles) => {
  // Convert single role to array for consistent handling
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return async (req, res, next) => {
    const traceId = generateLoggerTraceId();

    try {
      setLoggerContext({
        traceId, 
        service: 'backend', 
        operation: 'authorize' 
      });
      
      try {
        // Check if user exists in request (set by authenticate middleware)
        if (!req.user) {
          logger.warn('Authorization failed: No authenticated user');
          return res.status(401).json({ message: 'Authentication required' });
        }

        // Get user role from token claims or map from Cognito groups
        let userRole = req.user.role;

        // If no explicit role, try to derive from Cognito groups
        if (!userRole && req.user.groups && req.user.groups.length > 0) {
          // Find the highest privilege role (admin > operator > user)
          if (req.user.groups.includes('Administrators')) {
            userRole = 'admin';
          } else if (req.user.groups.includes('Operators')) {
            userRole = 'operator';
          } else if (req.user.groups.includes('Users')) {
            userRole = 'user';
          }
        }

        // Default to 'user' if no role is found
        if (!userRole) {
          userRole = 'user';
        }

        // Store the resolved role in the request for later use
        req.user.resolvedRole = userRole;

        // Special case for device action tokens which set admin role directly
        if (req.deviceAction && req.user.role === 'admin') {
          logger.info('Authorized via device action token with admin privileges');
          return next();
        }

        // Check if user has one of the allowed roles
        if (roles.includes(userRole) || roles.includes('*')) {
          logger.debug(`User authorized with role: ${userRole}`, {
            userId: req.user.sub,
            username: req.user.username,
            role: userRole
          });
          return next();
        }

        // Special case: allow users to access their own resources
        if (roles.includes('self') && req.params && req.params.id) {
          // This assumes that the route parameter 'id' matches the user's ID
          // Adjust this logic based on your specific requirements
          if (req.params.id === req.user.sub || req.params.userId === req.user.sub) {
            logger.debug('User authorized to access own resource', {
              userId: req.user.sub,
              resourceId: req.params.id
            });
            return next();
          }
        }

        // If we get here, the user is not authorized
        logger.warn(`Authorization failed: User role ${userRole} not allowed`, {
          userId: req.user.sub,
          username: req.user.username,
          role: userRole,
          allowedRoles: roles
        });

        return res.status(403).json({ message: 'Access denied' });
      } catch (error) {
        logger.error(`Authorization error: ${error.message}`, { error });
        return res.status(500).json({ message: 'Authorization error' });
      }
    } finally {
      clearLoggerContext();
    }
  };
};

/**
 * Middleware to check if user is an admin
 */
export const isAdmin = authorize('admin');

/**
 * Middleware to check if user is an operator or admin
 */
export const isOperatorOrAdmin = authorize(['admin', 'operator']);

/**
 * Middleware to check if user is accessing their own resource or is an admin
 */
export const isSelfOrAdmin = authorize(['admin', 'self']);

export default authorize;
