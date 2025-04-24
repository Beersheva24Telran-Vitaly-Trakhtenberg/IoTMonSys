package optdev.iotmonsys.lambdas;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestStreamHandler;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import java.io.*;
import java.nio.charset.StandardCharsets;

import com.amazonaws.services.sns.AmazonSNS;
import com.amazonaws.services.sns.AmazonSNSClientBuilder;

public class DeviceEventHandler implements RequestStreamHandler {
    @Override
    public void handleRequest(InputStream input, OutputStream output, Context context) throws IOException {
        LambdaLogger logger = context.getLogger();

        String eventJson = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))
                .lines()
                .reduce("", (acc, line) -> acc + line);

        logger.log("Received event: " + eventJson);

        String topicArn = System.getenv("SNS_TOPIC_ARN");
        if (topicArn != null && !topicArn.isEmpty()) {
            AmazonSNS snsClient = AmazonSNSClientBuilder.defaultClient();
            snsClient.publish(topicArn, "New event from IoTMonSys: " + eventJson, "IoTMonSys Alert");
            logger.log("SNS notification sent.");
        }

        String response = "{\"statusCode\":200,\"body\":\"OK\"}";
        output.write(response.getBytes(StandardCharsets.UTF_8));
    }
}
