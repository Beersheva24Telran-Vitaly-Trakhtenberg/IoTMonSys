package optdev.iotmonsys.lambdas;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestStreamHandler;
import com.amazonaws.services.lambda.runtime.LambdaLogger;

import java.io.*;
import java.nio.charset.StandardCharsets;

import com.amazonaws.services.sns.model.PublishRequest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import com.amazonaws.services.sns.AmazonSNS;
import com.amazonaws.services.sns.AmazonSNSClientBuilder;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import javax.crypto.spec.SecretKeySpec;
import java.security.Key;
import java.util.Date;

public class DeviceAddedEventHandler implements RequestStreamHandler {
    @Override
    public void handleRequest(InputStream input, OutputStream output, Context context) throws IOException {
        LambdaLogger logger = context.getLogger();

        String eventJson = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))
                .lines()
                .reduce("", (acc, line) -> acc + line);
        logger.log("[EVENT] DeviceAdded: " + eventJson);

        String response = "";
        String endPoint = "https://uwi10frym6.execute-api.us-east-1.amazonaws.com/devices";

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

                String emailText = "New event from IoTMonSys.\nNew device added:\ndeviceId\t" + deviceIdString +
                        "\ndevice type:\t" + deviceTypeString +
                        "\ndevice name:\t" + deviceNameString +
                        "\n\n";

                String jwtSecret = System.getenv("JWT_SECRET");
                if (jwtSecret != null && !jwtSecret.isEmpty()) {
                    Key key = new SecretKeySpec(jwtSecret.getBytes(StandardCharsets.UTF_8), SignatureAlgorithm.HS256.getJcaName());
                    long expMillis = System.currentTimeMillis() + 10 * 60 * 1000;
                    String tokenApprove = Jwts.builder()
                            .claim("deviceId", deviceIdString)
                            .claim("action", "approve")
                            .setExpiration(new Date(expMillis))
                            .signWith(key, SignatureAlgorithm.HS256)
                            .compact();
                    String tokenBlock = Jwts.builder()
                            .claim("deviceId", deviceIdString)
                            .claim("action", "block")
                            .setExpiration(new Date(expMillis))
                            .signWith(key, SignatureAlgorithm.HS256)
                            .compact();
                    String tokenRemove = Jwts.builder()
                            .claim("deviceId", deviceIdString)
                            .claim("action", "remove")
                            .setExpiration(new Date(expMillis))
                            .signWith(key, SignatureAlgorithm.HS256)
                            .compact();

                    String deviceManagementInitialString = "!!!\nYou can approve this device or remove this one. Or do nothing, device will wait in 'pending' status.\n";
                    String approveDeviceString = "Click the link to approve this device: " + endPoint + "/" +deviceIdString + "/approve?token=" + tokenApprove;
                    String blockDeviceString = "Click the link to block this device: " + endPoint + "/" + deviceIdString + "/block?token=" + tokenBlock;
                    String removeDeviceString = "Click the link to remove this device: " + endPoint + "/" + deviceIdString + "/remove?token=" + tokenRemove;
                    String deviceManagementString = deviceManagementInitialString +
                            approveDeviceString + "\n" +
                            blockDeviceString + "\n" +
                            removeDeviceString + "\n";
                    emailText += deviceManagementString;
                }

                String topicArn = System.getenv("SNS_TOPIC_ARN");
                if (topicArn != null && !topicArn.isEmpty()) {
                    AmazonSNS snsClient = AmazonSNSClientBuilder.defaultClient();
                    snsClient.publish(topicArn, emailText, "IoTMonSys Alert");
                    logger.log("[DEBUG] SNS notification via email sent.");
/*
                    snsClient.publish(new PublishRequest()
                            .withSubject("IoTMonSys Alert: New device added")
                            .withPhoneNumber("+375296523901")
                            .withMessage("deviceId " + deviceIdString + ": " + deviceNameString + " (" + deviceTypeString + ")"));
                    logger.log("[DEBUG] SNS notification via sms sent.");
*/
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
