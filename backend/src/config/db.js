import mongoose from "mongoose";
import pkg from "@vitaly-yosef/node-smart-logger";
const { createLogger, generateLoggerTraceId, setLoggerContext, clearLoggerContext } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const logger = createLogger('backend', './logs');

const connectDB = async () => {
  const dbConnectTraceId = generateLoggerTraceId();
  
  try {
    setLoggerContext({ operation: 'db-connect', traceId: dbConnectTraceId });
    const conn = await mongoose.connect(process.env.MONGODB_URI_LEGACY);
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    clearLoggerContext();
    return true;
  } catch (error) {
    logger.error(`Error: ${error.message}`);
    clearLoggerContext();
    process.exit(1);
  }
};

export default connectDB;