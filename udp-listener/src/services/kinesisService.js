const { KinesisClient, PutRecordCommand } = require('@aws-sdk/client-kinesis');
const { createLogger } = require('@iotmonsys/logger-node');
const dotenv = require('dotenv');

dotenv.config();

const logger = createLogger('kinesis-service', '../logs');

const kinesisClient = new KinesisClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const streamName = process.env.KINESIS_STREAM_NAME;

if (!streamName) {
  logger.error('Kinesis stream name (KINESIS_STREAM_NAME) is not defined in environment variables. Kinesis service cannot function.');
}

const sendToKinesis = async (data, partitionKey) => {
  if (!streamName) {
    logger.error('Cannot send to Kinesis: stream name is not configured.');
    return null;
  }

  if (!partitionKey) {
    partitionKey = data?.deviceId || data?.device_id || Date.now().toString();
    logger.warn(`Partition key was missing for Kinesis record. Using generated key: ${partitionKey}`);
  }

  const params = {
    StreamName: streamName,
    Data: Buffer.from(JSON.stringify(data)),
    PartitionKey: partitionKey,
  };

  const command = new PutRecordCommand(params);

  try {
    logger.debug(`Attempting to send data to Kinesis stream: ${streamName}`);
    const result = await kinesisClient.send(command);
    logger.info(`Successfully sent data to Kinesis. ShardId: ${result.ShardId}, SequenceNumber: ${result.SequenceNumber?.substring(0, 10)}...`);
    return result;
  } catch (error) {
    logger.error(`Error sending data to Kinesis: ${error.message}`, {
      streamName: streamName,
      partitionKey: partitionKey,
      errorCode: error.name,
      errorMessage: error.message,
      requestId: error.$metadata?.requestId,
    });
    return null;
  }
};

module.exports = {
  sendToKinesis
};