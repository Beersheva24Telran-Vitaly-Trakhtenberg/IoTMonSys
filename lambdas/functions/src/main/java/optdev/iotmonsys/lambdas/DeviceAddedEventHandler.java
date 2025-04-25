package optdev.iotmonsys.lambdas;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestStreamHandler;
import com.amazonaws.services.lambda.runtime.LambdaLogger;

import java.io.*;
import java.nio.charset.StandardCharsets;

import com.amazonaws.services.sns.model.PublishRequest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectWriter;

import com.amazonaws.services.sns.AmazonSNS;
import com.amazonaws.services.sns.AmazonSNSClientBuilder;

public class DeviceAddedEventHandler implements RequestStreamHandler {
    @Override
    public void handleRequest(InputStream input, OutputStream output, Context context) throws IOException {
        LambdaLogger logger = context.getLogger();

        String eventJson = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))
                .lines()
                .reduce("", (acc, line) -> acc + line);
        logger.log("[EVENT] DeviceAdded: " + eventJson);

        String response = "";

        ObjectMapper mapper = new ObjectMapper();
        JsonNode rootNode = mapper.readTree(eventJson);
        JsonNode bodyJson = rootNode.get("body");
        if (bodyJson != null && !bodyJson.isNull()) {
            JsonNode bodyNode = mapper.readTree(bodyJson.asText());
            JsonNode deviceId = bodyNode.get("deviceId");
            if (deviceId != null && !deviceId.isNull()) {
                String deviceIdString = deviceId.asText();

                String deviceNameString = bodyNode.get("name") == null ? "" : bodyNode.get("name").asText();
                String deviceTypeString = bodyNode.get("type") == null ? "" : bodyNode.get("type").asText();

                String deviceManagementInitialString = "!!!\nYou can approve this device or remove this one. Or do nothing, device will wait in 'pending' status.\n";
                String addDeviceString = "Click the link to add this device: " + "https://iot-mon-sys.com/devices/add?deviceId=" + deviceIdString;
                String removeDeviceString = "Click the link to remove this device: " + "https://iot-mon-sys.com/devices/remove?deviceId=" + deviceIdString;
                String deviceManagementString = deviceManagementInitialString +
                        addDeviceString + "\n" +
                        removeDeviceString + "\n";

                String emailText = "New event from IoTMonSys.\nNew device added:\ndeviceId\t" + deviceIdString +
                        "\ndevice type:\t" + deviceTypeString +
                        "\ndevice name:\t" + deviceNameString +
                        "\n\n";
                emailText += deviceManagementString;
                String topicArn = System.getenv("SNS_TOPIC_ARN");
                if (topicArn != null && !topicArn.isEmpty()) {
                    AmazonSNS snsClient = AmazonSNSClientBuilder.defaultClient();
                    snsClient.publish(topicArn, emailText, "IoTMonSys Alert");
                    logger.log("[DEBUG] SNS notification via email sent.");
                    snsClient.publish(new PublishRequest()
                            .withSubject("IoTMonSys Alert: New device added")
                            .withPhoneNumber("+375296523901")
                            .withMessage("deviceId " + deviceIdString + ": " + deviceNameString + " (" + deviceTypeString + ")"));
                    logger.log("[DEBUG] SNS notification via sms sent.");
                    response = "{\"statusCode\":200,\"body\":\"OK\"}";
                } else {
                    logger.log("[ERROR] No SNS_TOPIC_ARN in environment");
                    response = "{\"statusCode\":500,\"body\":\"Alarm: No SNS_TOPIC_ARN in environment\"}";
                }
            } else {
                logger.log("[ERROR] No deviceId in given event");
                response = "{\"statusCode\":400,\"body\":\"Event body didn't match expected format (No deviceId presents)\"}";
            }
        } else {
            response = "{\"statusCode\":400,\"body\":\"Event body didn't exist\"}";
            logger.log("[WARN] No body in given event");
        }
        output.write(response.getBytes(StandardCharsets.UTF_8));
    }
}
