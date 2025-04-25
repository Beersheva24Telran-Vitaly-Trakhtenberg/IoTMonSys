package optdev.iotmonsys.lambdas;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestStreamHandler;
import com.amazonaws.services.lambda.runtime.LambdaLogger;

import java.io.*;
import java.nio.charset.StandardCharsets;

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

        ObjectMapper mapper = new ObjectMapper();
        JsonNode rootNode = mapper.readTree(eventJson);
        JsonNode bodyJson = rootNode.get("body");
        if (bodyJson == null || bodyJson.isNull()) {
            logger.log("[WARN] No body in given event");
            return;
        }

        JsonNode bodyNode = mapper.readTree(bodyJson.asText());

        ObjectWriter writer = mapper.writerWithDefaultPrettyPrinter();
        String prettyBody = writer.writeValueAsString(bodyNode);
        String emailText = "New event from IoTMonSys:\n" + prettyBody + "\n\n";

        JsonNode deviceId = bodyNode.get("deviceId");
        if (deviceId == null || deviceId.isNull()) {
            logger.log("[ERROR] No deviceId in given event");
        } else {
            String deviceIdString = deviceId.asText();

            String deviceManagementInitialString = "You can approve this device or remove this one. Or do nothing, device will wait in 'pending' status.\n";
            String addDeviceString = "<a href=\"https://adding-device.com?deviceId=" + deviceIdString + "\">Click here to add</a> this device.\n";
            String removeDeviceString = "<a href=\"https://remove-device.com?deviceId=" + deviceIdString + "\">Click here to remove</a> this device.\n";
            String deviceManagementString = deviceManagementInitialString +
                    addDeviceString + "\n" +
                    removeDeviceString;

            emailText += deviceManagementString;
        }

        String topicArn = System.getenv("SNS_TOPIC_ARN");
        if (topicArn != null && !topicArn.isEmpty()) {
            AmazonSNS snsClient = AmazonSNSClientBuilder.defaultClient();
            snsClient.publish(topicArn, emailText, "IoTMonSys Alert");
            logger.log("[DEBUG] SNS notification sent.");
        } else {
            logger.log("[ERROR] No SNS_TOPIC_ARN in environment");
        }

        String response = "{\"statusCode\":200,\"body\":\"OK\"}";
        output.write(response.getBytes(StandardCharsets.UTF_8));
    }
}
