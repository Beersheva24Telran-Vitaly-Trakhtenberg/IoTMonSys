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

/**
 * Отправляет данные устройства в Kinesis Data Stream
 * @param {Object} data - Данные устройства для отправки
 * @param {string} [partitionKey] - Ключ партиции для Kinesis (по умолчанию deviceId)
 * @returns {Promise<Object|null>} - Результат отправки или null в случае ошибки
 */
const sendToKinesis = async (data, partitionKey) => {
  if (!streamName) {
    logger.error('Cannot send to Kinesis: stream name is not configured.');
    return null;
  }

  // Используем deviceId как ключ партиции для равномерного распределения данных
  if (!partitionKey) {
    partitionKey = data?.deviceId || data?.device_id || Date.now().toString();
    logger.warn(`Partition key was missing for Kinesis record. Using generated key: ${partitionKey}`);
  }

  // Подготовка данных для отправки, включая информацию о батарее
  const dataToSend = {
    ...data,
    timestamp: data.timestamp || new Date().toISOString(),
    receivedAt: new Date().toISOString()
  };

  // Добавляем метаданные для трассировки
  if (logger.getContext && logger.getContext()) {
    dataToSend.traceId = logger.getContext().traceId;
  }

  const params = {
    StreamName: streamName,
    Data: Buffer.from(JSON.stringify(dataToSend)),
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
    
    // Повторная попытка отправки с задержкой при определенных ошибках
    if (error.name === 'ProvisionedThroughputExceededException') {
      logger.info('Throughput exceeded. Will retry after delay.');
      await new Promise(resolve => setTimeout(resolve, 1000));
      return sendToKinesis(data, partitionKey); // Рекурсивный вызов для повторной попытки
    }
    
    return null;
  }
};

module.exports = {
  sendToKinesis
};