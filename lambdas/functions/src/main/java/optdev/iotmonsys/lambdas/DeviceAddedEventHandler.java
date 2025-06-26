package optdev.iotmonsys.lambdas;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestStreamHandler;
import com.amazonaws.services.lambda.runtime.LambdaLogger;

import java.io.*;
import java.nio.charset.StandardCharsets;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import com.amazonaws.services.simplesystemsmanagement.AWSSimpleSystemsManagement;
import com.amazonaws.services.simplesystemsmanagement.AWSSimpleSystemsManagementClientBuilder;
import com.amazonaws.services.simplesystemsmanagement.model.GetParameterRequest;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import optdev.iotmonsys.lambdas.utils.SecretsManagerHelper;

import javax.crypto.spec.SecretKeySpec;
import java.security.Key;
import java.util.Date;

import static optdev.iotmonsys.lambdas.utils.SNSHelper.sendNotification;

public class DeviceAddedEventHandler implements RequestStreamHandler {
    @Override
    public void handleRequest(InputStream input, OutputStream output, Context context) throws IOException {
        LambdaLogger logger = context.getLogger();

        String eventJson = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))
                .lines()
                .reduce("", (acc, line) -> acc + line);
        logger.log("[EVENT] DeviceAdded: " + eventJson);

        var response = "";

        String parameterName = System.getenv("API_ENDPOINT_PARAMETER");
        AWSSimpleSystemsManagement ssmClient = AWSSimpleSystemsManagementClientBuilder.defaultClient();
        GetParameterRequest request = new GetParameterRequest().withName(parameterName);
        String endPoint = ssmClient.getParameter(request).getParameter().getValue();
        String deviceEndPoint = endPoint + "devices/";

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

                String jwtSecret = SecretsManagerHelper.getSecret("IoTMonSys/JWTSecret");
                if (jwtSecret != null && !jwtSecret.isEmpty()) {
                    Key key;
                    try {
                        // Если секрет слишком короткий, дополняем его до 32 байт
                        byte[] secretBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
                        if (secretBytes.length < 32) {
                            byte[] paddedSecret = new byte[32];
                            System.arraycopy(secretBytes, 0, paddedSecret, 0, secretBytes.length);
                            // Заполняем оставшиеся байты случайными значениями
                            for (int i = secretBytes.length; i < 32; i++) {
                                paddedSecret[i] = (byte)8;
                            }
                            key = new SecretKeySpec(paddedSecret, SignatureAlgorithm.HS256.getJcaName());
                        } else {
                            key = new SecretKeySpec(secretBytes, SignatureAlgorithm.HS256.getJcaName());
                        }

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
                        String approveDeviceString = "Click the link to approve this device: " + deviceEndPoint +deviceIdString + "/approve?token=" + tokenApprove;
                        String blockDeviceString = "Click the link to block this device: " + deviceEndPoint + deviceIdString + "/block?token=" + tokenBlock;
                        String removeDeviceString = "Click the link to remove this device: " + deviceEndPoint + deviceIdString + "/remove?token=" + tokenRemove;
                        String deviceManagementString = deviceManagementInitialString +
                                approveDeviceString + "\n" +
                                blockDeviceString + "\n" +
                                removeDeviceString + "\n";
                        emailText += deviceManagementString;
                    } catch (Exception e) {
                        logger.log("[ERROR] Failed to create JWT key: " + e.getMessage());
                        response = "{\"statusCode\":500,\"body\":\"Alarm: JWT_KEY_CREATION_FAILED\"}";
                        output.write(response.getBytes(StandardCharsets.UTF_8));
                        return;
                    }
                }
                String subject = "IoTMonSys Warning: New device found";
                String smsMessage = "New device added: " + deviceIdString +
                        (deviceNameString.isEmpty() ? "" : " - " + deviceNameString) +
                        (deviceTypeString.isEmpty() ? "" : " (" + deviceTypeString + ")");

                boolean sentResult = sendNotification(subject, emailText, smsMessage, logger);

                if (sentResult) {
                    response = "{\"statusCode\":200,\"body\":\"OK\"}";
                } else {
                    response = "{\"statusCode\":500,\"body\":\"Alarm: SNS_NOTIFY_FAILED\"}";
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
