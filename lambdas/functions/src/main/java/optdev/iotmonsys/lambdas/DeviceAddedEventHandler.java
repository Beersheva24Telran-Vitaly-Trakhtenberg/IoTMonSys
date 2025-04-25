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
        logger.log("Event DeviceAdded: " + eventJson);

        ObjectMapper mapper = new ObjectMapper();
        JsonNode rootNode = mapper.readTree(eventJson);
        String bodyJson = rootNode.get("body").asText();
        String deviceId = rootNode.get("body").get("deviceId").asText();

        String deviceManagementInitialString = "You can approve this device or remove this one. Or do nothing, device will wait in 'pending' status.\n";
        String addDeviceString = "<a href=\"https://adding-device.com?deviceId=" + deviceId + "\">Click here to add</a> this device.\n";
        String removeDeviceString = "<a href=\"https://remove-device.com?deviceId=" + deviceId + "\">Click here to remove</a> this device.\n";
        String deviceManagementString = deviceManagementInitialString +
                addDeviceString + "\n" +
                removeDeviceString;

        JsonNode bodyNode = mapper.readTree(bodyJson);
        ObjectWriter writer = mapper.writerWithDefaultPrettyPrinter();
        String prettyBody = writer.writeValueAsString(bodyNode);

        String topicArn = System.getenv("SNS_TOPIC_ARN");
        if (topicArn != null && !topicArn.isEmpty()) {
            AmazonSNS snsClient = AmazonSNSClientBuilder.defaultClient();
            snsClient.publish(topicArn, "New event from IoTMonSys:\n" + prettyBody + "\n\n" + deviceManagementString, "IoTMonSys Alert");
            logger.log("SNS notification sent.");
        }

        String response = "{\"statusCode\":200,\"body\":\"OK\"}";
        output.write(response.getBytes(StandardCharsets.UTF_8));
    }
}
