package optdev.iotmonsys.lambdas;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.KinesisEvent;
import com.amazonaws.services.lambda.runtime.events.KinesisEvent.KinesisEventRecord;

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
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

import optdev.iotmonsys.lambdas.utils.SecretsManagerHelper;
import org.bson.conversions.Bson;

import static optdev.iotmonsys.lambdas.utils.SNSHelper.sendNotification;

/**
 * Lambda function for processing device data from Kinesis Data Stream
 * The function analyzes data for anomalies and sends notifications when necessary
 */
public class DataProcessorHandler implements RequestHandler<KinesisEvent, String> {
    private static final ObjectMapper objectMapper = new ObjectMapper();

    private static final String MONGODB_URI = SecretsManagerHelper.getSecret("IoTMonSys/AtlasMongoDBCredentials");
    private static final String MONGODB_DB = System.getenv("MONGODB_DB");

    private static final boolean ANOMALY_DETECTION_ENABLED = Boolean.parseBoolean(System.getenv("ANOMALY_DETECTION_ENABLED"));
    private static final String SNS_TOPIC_ARN = System.getenv("SNS_TOPIC_ARN");
    private static final boolean SMS_ENABLED = Boolean.parseBoolean(System.getenv("SMS_ENABLED"));
    private static final String SMS_PHONE_NUMBER = System.getenv("SMS_PHONE_NUMBER");

    // Battery level threshold (can be moved to environment variable)
    private static final int BATTERY_LOW_THRESHOLD = 20; // 20%

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
                    // Gets data from Kinesis
                    String data = new String(record.getKinesis().getData().array(), StandardCharsets.UTF_8);
                    JsonNode deviceData = objectMapper.readTree(data);
                    
                    // Gets deviceId from the data
                    String deviceId = deviceData.get("deviceId").asText();
                    String deviceStatus = deviceData.has("deviceStatus") ? deviceData.get("deviceStatus").asText() : "unknown";
                    
                    logger.log("[DEBUG] Processing data for device: " + deviceId + ", status: " + deviceStatus);
                    
                    // Skip data from devices that are not active or have pending status
                    if ("pending".equals(deviceStatus)) {
                        logger.log("[DEBUG] Skipping data from device with 'pending' status: " + deviceId);
                        continue;
                    }
                    
                    // Reads device information from MongoDB and checks if the device is active
                    Document deviceDoc = deviceCollection.find(Filters.eq("deviceId", deviceId)).first();
                    if (deviceDoc == null) {
                        logger.log("[WARN] Device not found in database: " + deviceId);
                        continue;
                    }
                    String storedStatus = deviceDoc.getString("status");
                    if (!"active".equals(storedStatus)) {
                        logger.log("[DEBUG] Device is not active (status: " + storedStatus + "), skipping processing: " + deviceId);
                        continue;
                    }

                    // Prepare updates for device document
                    List<Bson> updates = new ArrayList<>();
                    // Update lastDataReceived timestamp and reset offline alert flag
                    updates.add(Updates.set("lastDataReceived", new Date()));
                    updates.add(Updates.set("offlineAlertSent", false));

                    // Check battery level if available and update lowBatteryAlertSent flag accordingly
                    if (deviceData.has("batteryLevel")) {
                        double batteryLevel = deviceData.get("batteryLevel").asDouble();
                        String powerType = deviceDoc.getString("powerType");

                        // Only check battery level for devices powered by battery
                        if ("battery".equals(powerType)) {
                            if (batteryLevel <= BATTERY_LOW_THRESHOLD) {
                                if (!deviceDoc.getBoolean("lowBatteryAlertSent", false)) {
                                    // Send low battery alert notification
                                    sendNotification(
                                            "IoTMonSys Alert: Low Battery",
                                            "Low battery level detected for device " + deviceId + ": " + batteryLevel + "%",
                                            "Low battery level detected for device " + deviceId + ": " + batteryLevel + "%",
                                            logger
                                    );
                                    updates.add(Updates.set("lowBatteryAlertSent", true));
                                }
                                logger.log("[WARN] Low battery level detected for device " + deviceId + ": " + batteryLevel + "%");
                            } else {
                                // Reset low battery alert flag if battery level is OK
                                updates.add(Updates.set("lowBatteryAlertSent", false));
                            }
                        }
                    }

                    // Apply all updates to device document
                    deviceCollection.updateOne(
                            Filters.eq("deviceId", deviceId),
                            Updates.combine(updates)
                    );

                    // Gets threshold values for the device from MongoDB
                    Document thresholds = deviceDoc.get("thresholds", Document.class);
                    if (thresholds == null) {
                        thresholds = new Document();
                    }
                    
                    // Processing data and checks anomaly (anomaly detection)
                    Document processedData = processDeviceData(deviceData, thresholds);
                    boolean hasAnomalies = processedData.getBoolean("hasAnomalies", false);
                    
                    // Store processed data in MongoDB
                    processedDataCollection.insertOne(processedData);
                    processedCount++;
                    
                    // If anomaly detected, store it in MongoDB and send notification to SNS
                    if (hasAnomalies && ANOMALY_DETECTION_ENABLED) {
                        Document anomalyDoc = createAnomalyDocument(deviceId, deviceData, processedData);
                        anomaliesCollection.insertOne(anomalyDoc);
                        
                        // Update device status is the anomaly critical
                        if (isCriticalAnomaly(processedData)) {
                            deviceCollection.updateOne(
                                Filters.eq("deviceId", deviceId),
                                Updates.combine(
                                    Updates.set("lastAnomalyAt", new Date()),
                                    Updates.set("anomalyStatus", "critical")
                                )
                            );
                        }
                        
                        // Sends SNS-notifications
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
     * Processes device data and checks for anomalies
     * 
     * @param deviceData Device data
     * @param thresholds Threshold values for anomaly detection
     * @return Document with processed data
     */
    private Document processDeviceData(JsonNode deviceData, Document thresholds) {
        Document processedDoc = new Document();
        processedDoc.append("deviceId", deviceData.get("deviceId").asText());
        processedDoc.append("timestamp", deviceData.get("timestamp").asText());
        processedDoc.append("processedAt", new Date());
        
        // Copying measurements
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
                    
                    // Checking for anomalies
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
     * Creates a document with information about the anomaly
     * 
     * @param deviceId device ID
     * @param deviceData device data
     * @param processedData processed data
     * @return Document containing information about the anomaly
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
     * Calculates the severity of the anomaly
     * 
     * @param processedData processed data
     * @return Severity level of the anomaly (low, medium, high, critical)
     */
    private String calculateAnomalySeverity(Document processedData) {
        Document anomalies = processedData.get("anomalies", Document.class);
        if (anomalies == null || anomalies.isEmpty()) {
            return "low";
        }

        // Simple logic for determining the severity of an anomaly
        // Note: In a real project, the logic here may be more complex
        int anomalyCount = anomalies.size();
        if (anomalyCount >= 3) {
            return "critical";
        } else if (anomalyCount == 2) {
            return "high";
        } else if (anomalyCount == 1) {
            // Checking how much the value deviates from the threshold
            for (String key : anomalies.keySet()) {
                Document anomaly = anomalies.get(key, Document.class);
                double value = anomaly.getDouble("value");
                double minObj = anomaly.containsKey("min") ? anomaly.getDouble("min") : Double.MIN_VALUE;
                double maxObj = anomaly.containsKey("max") ? anomaly.getDouble("max") : Double.MAX_VALUE;
                String type = anomaly.getString("type");
                
                if ("below_min".equals(type)) {
                    double deviation = (minObj - value) / minObj * 100;
                    if (deviation > 20) {
                        return "high";
                    }
                } else if ("above_max".equals(type)) {
                    double deviation = (value - maxObj) / maxObj * 100;
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
     * Checks if the anomaly is critical
     * 
     * @param processedData processed data
     * @return true, if anomaly is critical of high severity
     */
    private boolean isCriticalAnomaly(Document processedData) {
        String severity = calculateAnomalySeverity(processedData);
        return "critical".equals(severity) || "high".equals(severity);
    }
    
    /**
     * Sends a notification about the anomaly
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
            
            // Date/Time formating for the message
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")
                .withZone(ZoneId.systemDefault());
            String formattedTime = formatter.format(detectedAt.toInstant());
            
            // Create message
            StringBuilder messageBuilder = new StringBuilder();
            messageBuilder.append(String.format("ANOMALY ALERT: %s severity for device %s\n\n", severity.toUpperCase(), deviceName));
            messageBuilder.append(String.format("Device ID: %s\n", deviceId));
            messageBuilder.append(String.format("Detected at: %s\n", formattedTime));
            messageBuilder.append(String.format("Severity: %s\n\n", severity));
            
            // Add info about anomaly(-es)
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
            String smsMessage = String.format("[%s] Alert: Device %s - %s",
                    severity.toUpperCase(), deviceName,
                    anomalies.size() == 1 ? "1 anomaly" : anomalies.size() + " anomalies");

            sendNotification(subject, message, smsMessage, logger);
        } catch (Exception e) {
            logger.log("[ERROR] Error sending anomaly notification: " + e);
        }
    }
}
