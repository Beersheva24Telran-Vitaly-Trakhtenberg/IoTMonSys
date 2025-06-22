package optdev.iotmonsys.lambdas;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.KinesisEvent;
import com.amazonaws.services.lambda.runtime.events.KinesisEvent.KinesisEventRecord;
import com.amazonaws.services.sns.AmazonSNS;
import com.amazonaws.services.sns.AmazonSNSClientBuilder;
import com.amazonaws.services.sns.model.PublishRequest;
import com.amazonaws.services.sns.model.PublishResult;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Updates;
import org.bson.Document;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

import optdev.iotmonsys.lambdas.utils.SecretsManagerHelper;

/**
 * Lambda функция для обработки данных устройств из Kinesis Data Stream.
 * Функция анализирует данные на наличие аномалий и отправляет уведомления при необходимости.
 */
public class DataProcessorHandler implements RequestHandler<KinesisEvent, String> {
    private static final ObjectMapper objectMapper = new ObjectMapper();

    private static final String MONGODB_URI = SecretsManagerHelper.getSecret("IoTMonSys/AtlasMongoDBCredentials");
    private static final String MONGODB_DB = System.getenv("MONGODB_DB");

    private static final boolean ANOMALY_DETECTION_ENABLED = Boolean.parseBoolean(System.getenv("ANOMALY_DETECTION_ENABLED"));
    private static final String SNS_TOPIC_ARN = System.getenv("SNS_TOPIC_ARN");
    private static final boolean SMS_ENABLED = Boolean.parseBoolean(System.getenv("SMS_ENABLED"));
    private static final String SMS_PHONE_NUMBER = System.getenv("SMS_PHONE_NUMBER");

    private final AmazonSNS snsClient = AmazonSNSClientBuilder.defaultClient();
    
    @Override
    public String handleRequest(KinesisEvent kinesisEvent, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("Processing " + kinesisEvent.getRecords().size() + " Kinesis records");

        try (MongoClient mongoClient = MongoClients.create(MONGODB_URI)) {
            MongoDatabase database = mongoClient.getDatabase(MONGODB_DB);
            MongoCollection<Document> deviceCollection = database.getCollection("devices");
            MongoCollection<Document> deviceDataCollection = database.getCollection("deviceData");
            MongoCollection<Document> processedDataCollection = database.getCollection("processedData");
            MongoCollection<Document> anomaliesCollection = database.getCollection("anomalies");
            
            int processedCount = 0;
            int anomalyCount = 0;
            
            for (KinesisEventRecord record : kinesisEvent.getRecords()) {
                try {
                    // Получение данных из Kinesis
                    String data = new String(record.getKinesis().getData().array(), StandardCharsets.UTF_8);
                    JsonNode deviceData = objectMapper.readTree(data);
                    
                    // Получение deviceId из данных
                    String deviceId = deviceData.get("deviceId").asText();
                    String deviceStatus = deviceData.has("deviceStatus") ? deviceData.get("deviceStatus").asText() : "unknown";
                    
                    logger.log("[DEBUG] Processing data for device: " + deviceId + ", status: " + deviceStatus);
                    
                    // Пропускаем данные от устройств со статусом "pending"
                    if ("pending".equals(deviceStatus)) {
                        logger.log("[INFO] Skipping data from device with 'pending' status: " + deviceId);
                        continue;
                    }
                    
                    // Получение информации об устройстве из MongoDB
                    Document deviceDoc = deviceCollection.find(Filters.eq("deviceId", deviceId)).first();
                    if (deviceDoc == null) {
                        logger.log("[WARN] Device not found in database: " + deviceId);
                        continue;
                    }
                    
                    // Проверка статуса устройства
                    String storedStatus = deviceDoc.getString("status");
                    if (!"active".equals(storedStatus)) {
                        logger.log("[INFO] Device is not active (status: " + storedStatus + "), skipping processing: " + deviceId);
                        continue;
                    }
                    
                    // Получение пороговых значений для устройства
                    Document thresholds = deviceDoc.get("thresholds", Document.class);
                    if (thresholds == null) {
                        thresholds = new Document();
                    }
                    
                    // Обработка данных и проверка на аномалии
                    Document processedData = processDeviceData(deviceData, thresholds);
                    boolean hasAnomalies = processedData.getBoolean("hasAnomalies", false);
                    
                    // Сохранение обработанных данных
                    processedDataCollection.insertOne(processedData);
                    processedCount++;
                    
                    // Если обнаружены аномалии, сохраняем их и отправляем уведомление
                    if (hasAnomalies && ANOMALY_DETECTION_ENABLED) {
                        Document anomalyDoc = createAnomalyDocument(deviceId, deviceData, processedData);
                        anomaliesCollection.insertOne(anomalyDoc);
                        
                        // Обновление статуса устройства, если есть серьезные аномалии
                        if (isCriticalAnomaly(processedData)) {
                            deviceCollection.updateOne(
                                Filters.eq("deviceId", deviceId),
                                Updates.combine(
                                    Updates.set("lastAnomalyAt", new Date()),
                                    Updates.set("anomalyStatus", "critical")
                                )
                            );
                        }
                        
                        // Отправка уведомления через SNS
                        sendAnomalyNotification(deviceId, deviceDoc, anomalyDoc, logger);
                        anomalyCount++;
                    }
                    
                } catch (Exception e) {
                    logger.log("[ERROR] Error processing Kinesis record: " + e);
                }
            }
            
            logger.log("[INFO] Processed " + processedCount + " records, detected " + anomalyCount + " anomalies");
            return String.format("Processed %d records, detected %d anomalies", processedCount, anomalyCount);
        }
    }
    
    /**
     * Обрабатывает данные устройства и проверяет на аномалии
     * 
     * @param deviceData Данные устройства
     * @param thresholds Пороговые значения для проверки аномалий
     * @return Документ с обработанными данными
     */
    private Document processDeviceData(JsonNode deviceData, Document thresholds) {
        Document processedDoc = new Document();
        processedDoc.append("deviceId", deviceData.get("deviceId").asText());
        processedDoc.append("timestamp", deviceData.get("timestamp").asText());
        processedDoc.append("processedAt", new Date());
        
        // Копирование измерений
        Document measurements = new Document();
        JsonNode measurementsNode = deviceData.get("measurements");
        boolean hasAnomalies = false;
        Document anomalies = new Document();
        
        if (measurementsNode != null && measurementsNode.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> fields = measurementsNode.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> field = fields.next();
                String key = field.getKey();
                JsonNode value = field.getValue();
                
                if (value.isNumber()) {
                    double numValue = value.asDouble();
                    measurements.append(key, numValue);
                    
                    // Проверка на аномалии
                    if (thresholds.containsKey(key)) {
                        Document thresholdDoc = thresholds.get(key, Document.class);
                        Double minValue = thresholdDoc.getDouble("min");
                        Double maxValue = thresholdDoc.getDouble("max");
                        
                        boolean isAnomaly = (minValue != null && numValue < minValue) || 
                                           (maxValue != null && numValue > maxValue);
                        
                        if (isAnomaly) {
                            hasAnomalies = true;
                            Document anomalyInfo = new Document();
                            anomalyInfo.append("value", numValue);
                            anomalyInfo.append("min", minValue);
                            anomalyInfo.append("max", maxValue);
                            anomalyInfo.append("type", numValue < minValue ? "below_min" : "above_max");
                            anomalies.append(key, anomalyInfo);
                        }
                    }
                }
            }
        }
        
        processedDoc.append("measurements", measurements);
        processedDoc.append("hasAnomalies", hasAnomalies);
        if (hasAnomalies) {
            processedDoc.append("anomalies", anomalies);
        }
        
        return processedDoc;
    }
    
    /**
     * Создает документ с информацией об аномалии
     * 
     * @param deviceId ID устройства
     * @param deviceData Данные устройства
     * @param processedData Обработанные данные
     * @return Документ с информацией об аномалии
     */
    private Document createAnomalyDocument(String deviceId, JsonNode deviceData, Document processedData) {
        Document anomalyDoc = new Document();
        anomalyDoc.append("deviceId", deviceId);
        anomalyDoc.append("timestamp", deviceData.get("timestamp").asText());
        anomalyDoc.append("detectedAt", new Date());
        anomalyDoc.append("rawData", Document.parse(deviceData.toString()));
        anomalyDoc.append("anomalies", processedData.get("anomalies"));
        anomalyDoc.append("severity", calculateAnomalySeverity(processedData));
        anomalyDoc.append("status", "new");
        return anomalyDoc;
    }
    
    /**
     * Вычисляет уровень серьезности аномалии
     * 
     * @param processedData Обработанные данные
     * @return Уровень серьезности (low, medium, high, critical)
     */
    private String calculateAnomalySeverity(Document processedData) {
        Document anomalies = processedData.get("anomalies", Document.class);
        if (anomalies == null || anomalies.isEmpty()) {
            return "low";
        }
        
        // Простая логика определения серьезности аномалии
        // В реальном проекте здесь может быть более сложная логика
        int anomalyCount = anomalies.size();
        if (anomalyCount >= 3) {
            return "critical";
        } else if (anomalyCount == 2) {
            return "high";
        } else if (anomalyCount == 1) {
            // Проверка насколько значение отклоняется от порогового
            for (String key : anomalies.keySet()) {
                Document anomaly = anomalies.get(key, Document.class);
                double value = anomaly.getDouble("value");
                Double minObj = anomaly.containsKey("min") ? anomaly.getDouble("min") : Double.MIN_VALUE;
                Double maxObj = anomaly.containsKey("max") ? anomaly.getDouble("max") : Double.MAX_VALUE;
                double min = minObj;
                double max = maxObj;
                String type = anomaly.getString("type");
                
                if ("below_min".equals(type)) {
                    double deviation = (min - value) / min * 100;
                    if (deviation > 20) {
                        return "high";
                    }
                } else if ("above_max".equals(type)) {
                    double deviation = (value - max) / max * 100;
                    if (deviation > 20) {
                        return "high";
                    }
                }
            }
            return "medium";
        }
        
        return "low";
    }
    
    /**
     * Проверяет, является ли аномалия критической
     * 
     * @param processedData Обработанные данные
     * @return true, если аномалия критическая
     */
    private boolean isCriticalAnomaly(Document processedData) {
        String severity = calculateAnomalySeverity(processedData);
        return "critical".equals(severity) || "high".equals(severity);
    }
    
    /**
     * Отправляет уведомление об аномалии через SNS
     * 
     * @param deviceId ID устройства
     * @param deviceDoc Документ устройства
     * @param anomalyDoc Документ аномалии
     * @param logger Logger для логирования
     */
    private void sendAnomalyNotification(String deviceId, Document deviceDoc, Document anomalyDoc, LambdaLogger logger) {
        try {
            String deviceName = deviceDoc.getString("name");
            if (deviceName == null || deviceName.isEmpty()) {
                deviceName = deviceId;
            }
            
            String severity = anomalyDoc.getString("severity");
            String timestamp = anomalyDoc.getString("timestamp");
            Date detectedAt = anomalyDoc.getDate("detectedAt");
            
            // Форматирование времени
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")
                .withZone(ZoneId.systemDefault());
            String formattedTime = formatter.format(detectedAt.toInstant());
            
            // Создание сообщения
            StringBuilder messageBuilder = new StringBuilder();
            messageBuilder.append(String.format("ANOMALY ALERT: %s severity for device %s\n\n", severity.toUpperCase(), deviceName));
            messageBuilder.append(String.format("Device ID: %s\n", deviceId));
            messageBuilder.append(String.format("Detected at: %s\n", formattedTime));
            messageBuilder.append(String.format("Severity: %s\n\n", severity));
            
            // Добавление информации об аномалиях
            Document anomalies = anomalyDoc.get("anomalies", Document.class);
            messageBuilder.append("Anomalies detected:\n");
            for (String key : anomalies.keySet()) {
                Document anomaly = anomalies.get(key, Document.class);
                double value = anomaly.getDouble("value");
                double min = anomaly.containsKey("min") ? anomaly.getDouble("min") : Double.MIN_VALUE;
                double max = anomaly.containsKey("max") ? anomaly.getDouble("max") : Double.MAX_VALUE;
                String type = anomaly.getString("type");
                
                if ("below_min".equals(type)) {
                    messageBuilder.append(String.format("- %s: %.2f (below minimum threshold of %.2f)\n", key, value, min));
                } else if ("above_max".equals(type)) {
                    messageBuilder.append(String.format("- %s: %.2f (above maximum threshold of %.2f)\n", key, value, max));
                }
            }
            
            String message = messageBuilder.toString();
            String subject = String.format("[%s] Anomaly Alert for Device %s", severity.toUpperCase(), deviceName);
            
            // Отправка уведомления через SNS (Email)
            if (SNS_TOPIC_ARN != null && !SNS_TOPIC_ARN.isEmpty()) {
                PublishRequest publishRequest = new PublishRequest()
                    .withTopicArn(SNS_TOPIC_ARN)
                    .withMessage(message)
                    .withSubject(subject);
                snsClient.publish(publishRequest);
                logger.log("[DEBUG] SNS notification via email sent.");
            } else {
                logger.log("[ERROR] No SNS_TOPIC_ARN in environment");
            }
            
            // Отправка SMS-уведомления, если включено
            if (SMS_ENABLED && SMS_PHONE_NUMBER != null && !SMS_PHONE_NUMBER.isEmpty()) {
                // Сокращенное сообщение для SMS
                String smsMessage = String.format("[%s] Alert: Device %s - %s", 
                    severity.toUpperCase(), deviceName, 
                    anomalies.size() == 1 ? "1 anomaly" : anomalies.size() + " anomalies");
                
                PublishRequest publishRequest = new PublishRequest()
                    .withPhoneNumber(SMS_PHONE_NUMBER)
                    .withMessage(smsMessage);
                
                PublishResult publishResult = snsClient.publish(publishRequest);
                logger.log("[DEBUG] SMS notification sent with message ID: " + publishResult.getMessageId());
            }
            
        } catch (Exception e) {
            logger.log("[ERROR] Error sending anomaly notification: " + e);
        }
    }
}
