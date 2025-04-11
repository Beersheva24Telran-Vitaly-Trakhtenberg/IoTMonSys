const AWS = require('aws-sdk');
const { createLogger } = require('@iotmonsys/logger-node');

const logger = createLogger('kinesis-service', './logs');

AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1'
});

const kinesis = new AWS.Kinesis();

const sendToKinesis = async (data) => {
  try {
    const params = {
      Data: Buffer.from(JSON.stringify(data)),
      PartitionKey: data.deviceId,
      StreamName: process.env.KINESIS_STREAM_NAME
    };

    const result = await kinesis.putRecord(params).promise();
    logger.debug(`Data has been sent to Kinesis. ShardId: ${result.ShardId}`);
    return result;
  } catch (error) {
    logger.error(`Error(s) when sending data to Kinesis: ${error.message}. ${error.stack}`);
    throw error;
  }
};

module.exports = {
  sendToKinesis
};