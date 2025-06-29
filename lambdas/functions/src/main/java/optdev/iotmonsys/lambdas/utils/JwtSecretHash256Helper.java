package optdev.iotmonsys.lambdas.utils;

import io.jsonwebtoken.SignatureAlgorithm;

import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.Key;

public class JwtSecretHash256Helper {
    /**
     * Generates a 256-bit secret key from the IoTMonSys/JWTSecret secret in AWS Secrets Manager.
     * If the secret is shorter than 32 bytes, it is padded with 0x08 bytes until it is 32 bytes.
     * The resulting key is suitable for use with the HS256 signature algorithm in JSON Web Tokens.
     * @return A 256-bit secret key suitable for use with the HS256 signature algorithm in JSON Web Tokens.
     */
    public static Key getJwtSecret256() {
        String jwtSecret = SecretsManagerHelper.getSecret("IoTMonSys/JWTSecret");
        byte[] secretBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        Key key;
        if (secretBytes.length < 32) {
            byte[] paddedSecret = new byte[32];
            System.arraycopy(secretBytes, 0, paddedSecret, 0, secretBytes.length);
            byte secretBytesLength = secretBytes.length;
            for (int i = secretBytesLength; i < 32; i++) {
                byte j = (byte) ((i - secretBytesLength) % secretBytesLength);
                paddedSecret[i] = secretBytes[j];
            }
            key = new SecretKeySpec(paddedSecret, SignatureAlgorithm.HS256.getJcaName());
        } else {
            key = new SecretKeySpec(secretBytes, SignatureAlgorithm.HS256.getJcaName());
        }

        return key;
    }
}
