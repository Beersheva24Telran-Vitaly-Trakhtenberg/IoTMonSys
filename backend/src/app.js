import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import connectDB from './config/db.js';
import logger from "./utils/logger.js";
import loggerLibrary from "@iotmonsys/logger-node";
import { createLogger } from "@iotmonsys/logger-node";

dotenv.config();

const app = express();

// Logger
console.log("loggerLibrary: ", loggerLibrary, typeof loggerLibrary);
console.log("createLogger: ", createLogger, typeof createLogger);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors());
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

app.use('/api/devices', deviceRoutes);
app.use('/api/users', userRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/admin', adminRoutes);

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
        }
      }
    },
    security: [{
      bearerAuth: []
    }]
  },
  apis: ['./src/routes/*.js', './src/models/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Connect to database and start server
connectDB().then(() => {
  const server = app.listen(PORT, () => {
    logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    logger.info(`API Documentation available at http://localhost:${PORT}/api-docs`);
  });

  process.on('unhandledRejection', (err) => {
    logger.alert(`Unhandled Rejection: ${err.message}`);
    server.close(() => process.exit(1));
  });
}).catch(err => {
  logger.error(`Failed to connect to MongoDB: ${err.message}`);
  process.exit(1);
});
