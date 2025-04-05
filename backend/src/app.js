import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerDocument from 'swagger.json';
import swaggerUi from 'swagger-ui-express';
import connectDB from './config/db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from "./utils/logger.js";

dotenv.config();

const app = express();
const indexRouter = require('./routes/index');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors());
app.use(helmet());
app.use(morgan('combined'));

const PORT = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use('/', indexRouter);
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to IoTMonSys API' });
});

import deviceRoutes from './routes/deviceRoutes.js';
import userRoutes from './routes/userRoutes.js';
import alertRoutes from './routes/alertRoutes.js';

app.use('/api/devices', deviceRoutes);
app.use('/api/users', userRoutes);
app.use('/api/alerts', alertRoutes);

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
        url: 'http://localhost:' + process.env.PORT,
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
      },
      schemas: {
        ...movieSchemaSwagger,
        ...accountSchemasSwagger,
        ...generateSwaggerSchema,
        ...favoriteSchemasSwagger,
      }
    },
    security: [{
      bearerAuth: []
    }]
  },
  apis: ['./routes/*.js'],
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

connectDB().then(() => {
  const server = app.listen(PORT, () => {
    logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });

  process.on('unhandledRejection', (err) => {
    console.error(`Unhandled Rejection: ${err.message}`);
    logger.alert(`Unhandled Rejection: ${err.message}`);
    server.close(() => process.exit(1));
  });
}).catch(err => {
  logger.error(`Failed to connect to MongoDB: ${err.message}`);
  process.exit(1);
});
