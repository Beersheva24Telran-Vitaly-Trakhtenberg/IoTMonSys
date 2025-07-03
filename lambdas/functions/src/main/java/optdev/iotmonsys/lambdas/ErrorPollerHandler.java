package optdev.iotmonsys.lambdas;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Updates;
import org.bson.Document;

import java.util.Date;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import optdev.iotmonsys.lambdas.utils.SecretsManagerHelper;

import static optdev.iotmonsys.lambdas.utils.SNSHelper.sendNotification;

/**
 * AWS Lambda function that polls for device errors:
 * - Checks for devices that haven't sent data for a long time
 * - Checks for devices with low battery levels
 */
public class ErrorPollerHandler implements RequestHandler<Map<String, Object>, String> {
    private static final String MONGODB_URI = SecretsManagerHelper.getSecret("IoTMonSys/AtlasMongoDBCredentials");
    private static final String MONGODB_DB = System.getenv("MONGODB_DB");

    // Thresholds for alerts
    private static final int DEVICE_OFFLINE_THRESHOLD_HOURS = 24; // Consider device offline after 24 hours of inactivity
    private static final int BATTERY_LOW_THRESHOLD = 20; // 20% battery level threshold (same as in DataProcessorHandler)

    @Override
    public String handleRequest(Map<String, Object> input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("[INFO] Starting ErrorPoller check");

        int offlineDevicesCount;
        int lowBatteryDevicesCount;

        try (MongoClient mongoClient = MongoClients.create(MONGODB_URI)) {
            MongoDatabase database = mongoClient.getDatabase(MONGODB_DB);
            MongoCollection<Document> deviceCollection = database.getCollection("devices");
            MongoCollection<Document> deviceDatasCollection = database.getCollection("deviceDatas");

            // Check for offline devices
            offlineDevicesCount = checkOfflineDevices(deviceCollection, logger);

            // Check for low battery devices
            lowBatteryDevicesCount = checkLowBatteryDevices(deviceCollection, deviceDatasCollection, logger);

            logger.log(String.format("[INFO] ErrorPoller completed: found %d offline devices and %d devices with low battery",
                    offlineDevicesCount, lowBatteryDevicesCount));

            return String.format("ErrorPoller check completed: %d offline devices, %d low battery devices",
                    offlineDevicesCount, lowBatteryDevicesCount);
        } catch (Exception e) {
            logger.log("[ERROR] Error in ErrorPoller: " + e.getMessage());
            // Send notification about the error in the error monitoring system itself
            sendNotification(
                "Critical Error in ErrorPoller",
                "The error monitoring system encountered an error: " + e.getMessage(),
                "Error monitoring system failure",
                logger
            );
            return "ErrorPoller check failed: " + e.getMessage();
        }
    }

    /**
     * Check for devices that haven't sent data for a long time
     *
     * @param deviceCollection MongoDB collection with devices
     * @param logger Lambda logger
     * @return Number of offline devices found
     */
    private int checkOfflineDevices(MongoCollection<Document> deviceCollection, LambdaLogger logger) {
        int count = 0;

        // Calculate threshold time (current time - threshold hours)
        Date thresholdTime = new Date(System.currentTimeMillis() -
                                     TimeUnit.HOURS.toMillis(DEVICE_OFFLINE_THRESHOLD_HOURS));

        // Find active devices that haven't sent data since threshold time and haven't been alerted yet
        FindIterable<Document> offlineDevices = deviceCollection.find(
            Filters.and(
                Filters.eq("status", "active"),
                Filters.lt("lastDataReceived", thresholdTime),
                Filters.or(
                    Filters.eq("offlineAlertSent", false),
                    Filters.exists("offlineAlertSent", false)
                )
            )
        );

        for (Document device : offlineDevices) {
            String deviceId = device.getString("deviceId");
            String deviceName = device.getString("name");
            if (deviceName == null || deviceName.isEmpty()) {
                deviceName = deviceId;
            }

            Date lastDataReceived = device.getDate("lastDataReceived");

            // Calculate how long the device has been offline
            long hoursOffline = TimeUnit.MILLISECONDS.toHours(
                System.currentTimeMillis() - lastDataReceived.getTime()
            );

            logger.log(String.format("[WARN] Device %s (%s) is offline for %d hours",
                    deviceName, deviceId, hoursOffline));

            // Send notification
            String subject = "IoTMonSys Alert: Device Offline";
            String message = String.format("Device %s (%s) has not sent data since %s (%d hours ago).",
                                         deviceName, deviceId, lastDataReceived, hoursOffline);
            String smsMessage = String.format("Device %s offline for %d hours",
                                            deviceName, hoursOffline);

            boolean notificationSent = sendNotification(subject, message, smsMessage, logger);

            if (notificationSent) {
                // Update device status to mark that alert was sent
                deviceCollection.updateOne(
                    Filters.eq("deviceId", deviceId),
                    Updates.set("offlineAlertSent", true)
                );

                count++;
            }
        }

        return count;
    }

    /**
     * Check for devices with low battery level
     *
     * @param deviceCollection MongoDB collection with devices
     * @param logger Lambda logger
     * @return Number of low battery devices found
     */
    private int checkLowBatteryDevices(MongoCollection<Document> deviceCollection, MongoCollection<Document> deviceDataCollection, LambdaLogger logger) {
        int count = 0;

        // Find active devices powered by battery that haven't been alerted for low battery yet
        FindIterable<Document> batteryDevices = deviceCollection.find(
            Filters.and(
                Filters.eq("status", "active"),
                Filters.eq("powerType", "battery"),
                Filters.or(
                    Filters.eq("lowBatteryAlertSent", false),
                    Filters.exists("lowBatteryAlertSent", false)
                )
            )
        );

        for (Document device : batteryDevices) {
            String deviceId = device.getString("deviceId");
            String deviceName = device.getString("name");
            if (deviceName == null || deviceName.isEmpty()) {
                deviceName = deviceId;
            }

            Document latestData = deviceDataCollection.find(Filters.eq("deviceId", deviceId))
                .sort(new Document("timestamp", -1))
                .limit(1)
                .first();

            if (latestData != null && latestData.containsKey("batteryLevel")) {
                double batteryLevel = latestData.getDouble("batteryLevel");

                if (batteryLevel <= BATTERY_LOW_THRESHOLD) {
                    logger.log(String.format("[WARN] Device %s (%s) has low battery: %.1f%%",
                            deviceName, deviceId, batteryLevel));

                    // Send notification
                    String subject = "IoTMonSys Alert: Low Battery";
                    String message = String.format("Device %s (%s) has low battery level: %.1f%%",
                                                 deviceName, deviceId, batteryLevel);
                    String smsMessage = String.format("Low battery: %s - %.1f%%",
                                                    deviceName, batteryLevel);

                    boolean notificationSent = sendNotification(subject, message, smsMessage, logger);

                    if (notificationSent) {
                        // Update device status to mark that alert was sent
                        deviceCollection.updateOne(
                            Filters.eq("deviceId", deviceId),
                            Updates.set("lowBatteryAlertSent", true)
                        );

                        count++;
                    }
                }
            }
        }

        return count;
    }

    /**
     * Future enhancement: Monitor system errors
     * This is a placeholder for future implementation
     */
    private void checkSystemErrors(MongoDatabase database, LambdaLogger logger) {
        // TODO: Implement system error monitoring in the future
        // This would check a collection of system errors and send notifications
    }

    /**
     * Future enhancement: Monitor system performance
     * This is a placeholder for future implementation
     */
    private void checkSystemPerformance(MongoDatabase database, LambdaLogger logger) {
        // TODO: Implement performance monitoring in the future
        // This would check Lambda execution times, database response times, etc.
    }
}
