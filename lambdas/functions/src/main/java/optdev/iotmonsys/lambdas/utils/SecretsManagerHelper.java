package optdev.iotmonsys.lambdas.utils;

import com.amazonaws.services.secretsmanager.AWSSecretsManager;
import com.amazonaws.services.secretsmanager.AWSSecretsManagerClientBuilder;
import com.amazonaws.services.secretsmanager.model.GetSecretValueRequest;
import com.amazonaws.services.secretsmanager.model.GetSecretValueResult;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class SecretsManagerHelper {
    private static final Map<String, String> secretCache = new ConcurrentHashMap<>();
    private static final AWSSecretsManager client = AWSSecretsManagerClientBuilder.standard().build();

    // pattern Singleton
    private SecretsManagerHelper() {}

    /**
     * Gets secret by its name
     * @param secretName name of secret in AWS Secrets Manager
     * @return value of secret
     */
    public static String getSecret(String secretName) {
        return secretCache.computeIfAbsent(secretName, name -> {
            try {
                GetSecretValueRequest getSecretValueRequest = new GetSecretValueRequest()
                        .withSecretId(name);

                GetSecretValueResult getSecretValueResult = client.getSecretValue(getSecretValueRequest);
                return getSecretValueResult.getSecretString() != null
                        ? getSecretValueResult.getSecretString()
                        : new String(java.util.Base64.getDecoder().decode(getSecretValueResult.getSecretBinary()).array());
            } catch (Exception e) {
                throw new RuntimeException("Error getting secret: " + name, e);
            }
        });
    }
}
