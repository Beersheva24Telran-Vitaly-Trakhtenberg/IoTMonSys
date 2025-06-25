const { KinesisClient, PutRecordCommand } = require('@aws-sdk/client-kinesis');
const { createLogger, generateLoggerTraceId } = require('@iotmonsys/logger-node');
const dotenv = require('dotenv');

dotenv.config();

const logger = createLogger('kinesis-service', '../logs');

const kinesisClient = new KinesisClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const streamName = process.env.KINESIS_STREAM_NAME;

if (!streamName) {
  logger.error('Kinesis stream name (KINESIS_STREAM_NAME) is not defined in environment variables. Kinesis service cannot function.');
}

/**
 * Отправляет данные устройства в Kinesis Data Stream
 * @param {Object} data - данные устройства для отправки
 * @param {string} partitionKey - ключ партиции (обычно deviceId)
 * @returns {Promise<Object>} - результат отправки
 */
const sendToKinesis = async (data, partitionKey) => {
  // Генерируем или используем существующий traceId для трассировки
  const traceId = data.traceId || generateLoggerTraceId();
  const deviceId = data.deviceId || data.device_id;
  logger.withOperationContext({ deviceId, traceId, service: 'kinesis' });
  
  if (!streamName) {
    logger.error('Cannot send to Kinesis: stream name is not configured.');
    logger.clearContext();
    return null;
  }

  // Используем deviceId как ключ партиции для равномерного распределения данных
  if (!partitionKey) {
    partitionKey = data?.deviceId || data?.device_id || Date.now().toString();
    logger.warn(`Partition key was missing for Kinesis record. Using generated key: ${partitionKey}`);
  }

  const dataToSend = {
    ...data,
    timestamp: data.timestamp || new Date().toISOString(),
    receivedAt: new Date().toISOString()
  };

  // Добавляем traceId в данные для сквозной трассировки
  dataToSend.traceId = traceId;

  const params = {
    StreamName: streamName,
    Data: Buffer.from(JSON.stringify(dataToSend)),
    PartitionKey: partitionKey,
  };

  const command = new PutRecordCommand(params);

  try {
    logger.debug(`Attempting to send data to Kinesis stream: ${streamName}`);
    logger.debug(`Data being sent: ${JSON.stringify(dataToSend)}`);
    logger.debug(`AWS Region: ${process.env.AWS_REGION}, Stream name: ${streamName}`);
    
    const result = await kinesisClient.send(command);
    
    logger.info(`Successfully sent data to Kinesis. ShardId: ${result.ShardId}, SequenceNumber: ${result.SequenceNumber?.substring(0, 10)}...`);
    logger.debug(`Full Kinesis response: ${JSON.stringify(result)}`);
    logger.clearContext();
    return result;
  } catch (error) {
    logger.error(`Error sending data to Kinesis: ${error.message}`, {
      streamName: streamName,
      partitionKey: partitionKey,
      errorCode: error.name,
      errorMessage: error.message,
      requestId: error.$metadata?.requestId,
      stack: error.stack
    });
    
    // Повторная попытка отправки с задержкой при определенных ошибках
    if (error.name === 'ProvisionedThroughputExceededException') {
      logger.info('Throughput exceeded. Will retry after delay.');
      await new Promise(resolve => setTimeout(resolve, 1000));
      logger.clearContext(); // Очищаем контекст перед рекурсивным вызовом
      return sendToKinesis(data, partitionKey); // Рекурсивный вызов для повторной попытки
    }
    
    logger.clearContext();
    return null;
  }
};

module.exports = {
  sendToKinesis
};