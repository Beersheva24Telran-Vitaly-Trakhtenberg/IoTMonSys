import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import { createLogger } from "@iotmonsys/logger-node";

dotenv.config();

let logger = createLogger('backend', './logs');

const dbConfig = {
  database: process.env.POSTGRES_DB_NAME || 'postgres',
  username: process.env.POSTGRES_DB_USER,
  password: process.env.POSTGRES_DB_PASSWORD,
  host: process.env.POSTGRES_DB_HOST,
  port: process.env.POSTGRES_DB_PORT || 5432,
  dialect: 'postgres'
};

if (!dbConfig.username || !dbConfig.password || !dbConfig.host) {
  logger.alert('Missing required database configuration parameters. Check your .env file.');
  logger.info('Required parameters: POSTGRES_DB_USER, POSTGRES_DB_PASSWORD, POSTGRES_DB_HOST');
  logger.info('Optional parameters: POSTGRES_DB_NAME (default: postgres), POSTGRES_DB_PORT (default: 5432)');
}

const customLogger = (msg) => {
  logger.debug(msg);
};

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: 'postgres',
    logging: customLogger,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

export const testConnection = async () => {
  const maskedConnectionString = `postgresql://${dbConfig.username}:********@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;
  logger.info('Trying to connect to PostgreSQL, using ' + maskedConnectionString);
  
  try {
    await sequelize.authenticate();
    logger.info('PostgreSQL connection has been established successfully.');
    return true;
  } catch (error) {
    logger.alert('Unable to connect to PostgreSQL database:', error);
    return false;
  }
};

export default sequelize;