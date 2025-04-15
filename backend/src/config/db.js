import mongoose from "mongoose";
import { createLogger } from "@iotmonsys/logger-node";
import dotenv from 'dotenv';

dotenv.config();

let logger = createLogger('backend', './logs');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI_LEGACY);
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;