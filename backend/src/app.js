import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import connectDB from './config/db.js';
import pkg from "@vitaly-yosef/node-smart-logger";
const { createLogger, generateLoggerTraceId, setLoggerContext, clearLoggerContext } = pkg;

import { loadCognitoConfig } from './config/cognito.js';
import { initializeVerifier } from './middleware/authenticate.js';

dotenv.config();

const app = express();

const appTraceId = generateLoggerTraceId();
const logger = createLogger('backend', './logs');

setLoggerContext({
  traceId: appTraceId,
  service: 'backend',
  operation: 'app-startup'
});

logger.info('Starting IoTMonSys backend application');

clearLoggerContext();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : true,
  credentials: true
}));
app.use(helmet());
app.use(morgan('combined'));

const PORT = process.env.PORT || 5000;

// API Root route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to IoTMonSys API' });
});

// API Routes
import deviceRoutes from './routes/deviceRoutes.js';
import userRoutes from './routes/userRoutes.js';
import alertRoutes from './routes/alertRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import authRoutes from './routes/authRoutes.js';

// AUTH-routes do not require authentication
app.use('/api/auth', authRoutes);

// Rest API-routes need authentication middleware protection
import { authenticate } from './middleware/authenticate.js';
import { isAdmin, isOperatorOrAdmin } from './middleware/authorize.js';

// Standard device routes protected by authentication
// These routes are only used via the web interface
app.use('/api/devices', authenticate, deviceRoutes);

// Rest protected routes
app.use('/api/users', authenticate, userRoutes);
app.use('/api/alerts', authenticate, alertRoutes);
app.use('/api/admin', authenticate, isAdmin, adminRoutes);

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'IoTMonSys API',
      author: 'Vitaly Trakhtenberg',
      version: '1.0.0',
      description: 'IoT Monitoring System API',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'accessToken'
        }
      }
    },
    security: [
      { bearerAuth: [] },
      { cookieAuth: [] }
    ]
  },
  apis: ['./src/routes/*.js', './src/models/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec,
    {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'IoTMonSys API Documentation',
      customfavIcon: '/favicon.ico',
    }
  )
);

// Initialization of Cognito configuration and JWT verifier
const initializeApp = async () => {
  try {
    // Loading Cognito configuration from AWS Secrets Manager
    await loadCognitoConfig();
    
    // Initialization of the JWT verifier
    await initializeVerifier();
    
    try {
      setLoggerContext({
        traceId: appTraceId,
        service: 'backend',
        operation: 'cognito-init'
      });
      logger.info('Cognito configuration and JWT verifier initialized successfully');
      clearLoggerContext();
    } catch (error) {
      console.error('Error with setLoggerContext/clearLoggerContext:', error);
      logger.info('Cognito configuration and JWT verifier initialized successfully (fallback)');
    }
  } catch (error) {
    try {
      setLoggerContext({
        traceId: appTraceId,
        service: 'backend',
        operation: 'cognito-init-error'
      });
      logger.error(`Failed to initialize Cognito configuration: ${error.message}`, { error });
      clearLoggerContext();
    } catch (error) {
      console.error('Error with setLoggerContext/clearLoggerContext:', error);
      logger.error(`Failed to initialize Cognito configuration: ${error.message}`, { error });
    }
    process.exit(1);
  }
};

// Connect to database and start server
connectDB().then(async () => {
  await initializeApp();
  
  app.listen(PORT, () => {
    try {
      setLoggerContext({
        traceId: appTraceId,
        service: 'backend',
        operation: 'server-start'
      });
      logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
      clearLoggerContext();
    } catch (error) {
      console.error('Error with setLoggerContext/clearLoggerContext:', error);
      logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    }
  });
}).catch(err => {
  try {
    setLoggerContext({
      traceId: appTraceId,
      service: 'backend',
      operation: 'db-connect-error'
    });
    logger.error(`Failed to connect to database: ${err.message}`, { error: err });
    clearLoggerContext();
  } catch (error) {
    console.error('Error with setLoggerContext/clearLoggerContext:', error);
    logger.error(`Failed to connect to database: ${err.message}`, { error: err });
  }
  process.exit(1);
});
