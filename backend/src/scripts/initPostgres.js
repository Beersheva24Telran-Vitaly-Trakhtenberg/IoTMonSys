import { syncDatabase, initializePermissions, createDefaultAdmin } from '../models/sql/index.js';
import { testConnection } from '../config/sequelize.js';
import { createLogger } from "@iotmonsys/logger-node";

let logger = createLogger('backend', './logs');

const initializeDatabase = async () => {
  try {
    logger.info('Testing PostgreSQL connection...');
    const connectionOk = await testConnection();

    if (!connectionOk) {
      logger.alert('Failed to connect to PostgreSQL. Check your connection string and credentials.');
      process.exit(1);
    }

    logger.info('Synchronizing database schema...');
    await syncDatabase(false); // Note: value 'true' recreates the tables with drop all data

    logger.info('Initializing permissions...');
    await initializePermissions();

    logger.info('Creating default admin user...');
    await createDefaultAdmin();

    logger.info('Database initialization completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error during database initialization:', error);
    process.exit(1);
  }
};

initializeDatabase();