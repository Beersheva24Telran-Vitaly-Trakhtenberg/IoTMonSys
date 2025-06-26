package optdev.iotmonsys.lambdas;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestStreamHandler;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import org.bson.Document;

import javax.crypto.spec.SecretKeySpec;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

import optdev.iotmonsys.lambdas.utils.SecretsManagerHelper;

public class ApproveBlockRemoveDeviceHandler implements RequestStreamHandler{
    private static final String MONGODB_URI = SecretsManagerHelper.getSecret("IoTMonSys/AtlasMongoDBCredentials");
    private static final String MONGODB_DB = System.getenv("MONGODB_DB");
    private static final String DEVICES_COLLECTION = "devices";

    @Override
    public void handleRequest(InputStream inputStream, OutputStream outputStream, Context context) throws IOException {
        LambdaLogger logger = context.getLogger();

        String jwtSecret = SecretsManagerHelper.getSecret("IoTMonSys/JWTSecret");
        String response = "";
        boolean flagContinue = true;

        ObjectMapper mapper = new ObjectMapper();
        JsonNode event = mapper.readTree(inputStream);
        logger.log("[EVENT] ApproveBlockRemoveDevice: " + event.toString());
        String path = event.get("path").asText();
        String action = null;
        String deviceId = null;
        String token = null;

        if (path != null && !path.isEmpty() && jwtSecret != null && !jwtSecret.isEmpty()) {
            JsonNode queryParams = event.path("queryStringParameters");
            if (queryParams != null && queryParams.has("token")) {
                token = queryParams.get("token").asText();
                
                Key key;
                byte[] secretBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
                if (secretBytes.length < 32) {
                    byte[] paddedSecret = new byte[32];
                    System.arraycopy(secretBytes, 0, paddedSecret, 0, secretBytes.length);
                    for (int i = secretBytes.length; i < 32; i++) {
                        paddedSecret[i] = (byte) 8;
                    }
                    key = new SecretKeySpec(paddedSecret, SignatureAlgorithm.HS256.getJcaName());
                } else {
                    key = new SecretKeySpec(secretBytes, SignatureAlgorithm.HS256.getJcaName());
                }

                if (path.matches("/devices/.+/approve")) {
                    action = "approve";
                    deviceId = path.replaceAll("/devices/([^/]+)/approve", "$1");
                } else if (path.matches("/devices/.+/block")) {
                    action = "block";
                    deviceId = path.replaceAll("/devices/([^/]+)/block", "$1");
                } else if (path.matches("/devices/.+/remove")) {
                    action = "remove";
                    deviceId = path.replaceAll("/devices/([^/]+)/remove", "$1");
                }

                if (deviceId == null || action == null) {
                    response = "{\"statusCode\":400,\"headers\":{\"Content-Type\":\"application/json\",\"Access-Control-Allow-Origin\":\"*\"},\"body\":\"\\\"Invalid request\\\"\"}";
                    flagContinue = false;
                }

                if (flagContinue) {
                    try {
                        Claims claims = Jwts.parserBuilder()
                                .setSigningKey(key)
                                .build()
                                .parseClaimsJws(token)
                                .getBody();

                        String tokenDeviceId = claims.get("deviceId", String.class);
                        String tokenAction = claims.get("action", String.class);

                        if (action.equals(tokenAction) && deviceId.equals(tokenDeviceId)) {
                            try (MongoClient mongoClient = MongoClients.create(MONGODB_URI)) {
                                MongoDatabase db = mongoClient.getDatabase(MONGODB_DB);
                                MongoCollection<Document> devices = db.getCollection(DEVICES_COLLECTION);

                                if (action.equals("approve") || action.equals("block")) {
                                    String newStatus = action.equals("approve") ? "approved" : "blocked";
                                    Document update = new Document("$set", new Document("status", newStatus));
                                    Document filter = new Document("deviceId", deviceId);

                                    devices.updateOne(filter, update);
                                } else if (action.equals("remove")) {
                                    Document filter = new Document("deviceId", deviceId);
                                    devices.deleteOne(filter);
                                }
                            }
                            response = "{\"statusCode\":200,\"headers\":{\"Content-Type\":\"application/json\",\"Access-Control-Allow-Origin\":\"*\"},\"body\":\"\\\"OK\\\"\"}";
                        } else {
                            response = "{\"statusCode\":401,\"headers\":{\"Content-Type\":\"application/json\",\"Access-Control-Allow-Origin\":\"*\"},\"body\":\"\\\"Unauthorized. Invalid token in request\\\"\"}";
                            flagContinue = false;
                        }
                    } catch (JwtException e) {
                        response = "{\"statusCode\":401,\"headers\":{\"Content-Type\":\"application/json\",\"Access-Control-Allow-Origin\":\"*\"},\"body\":\"\\\"Unauthorized. Invalid token in request\\\"\"}";
                        flagContinue = false;
                    }
                }
            } else {
                response = "{\"statusCode\":401,\"headers\":{\"Content-Type\":\"application/json\",\"Access-Control-Allow-Origin\":\"*\"},\"body\":\"\\\"Unauthorized. Invalid token in request\\\"\"}";
                flagContinue = false;
            }
        } else {
            response = "{\"statusCode\":500,\"headers\":{\"Content-Type\":\"application/json\",\"Access-Control-Allow-Origin\":\"*\"},\"body\":\"\\\"Invalid server params or request\\\"\"}";
            flagContinue = false;
        }
        outputStream.write(response.getBytes(StandardCharsets.UTF_8));
    }
}
