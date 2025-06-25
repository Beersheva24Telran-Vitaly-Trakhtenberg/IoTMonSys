package optdev.iotmonsys.lambdas.utils;

import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.sns.AmazonSNS;
import com.amazonaws.services.sns.AmazonSNSClientBuilder;
import com.amazonaws.services.sns.model.PublishRequest;
import com.amazonaws.services.sns.model.PublishResult;

public class SNSHelper {
    private static final String SNS_TOPIC_ARN = System.getenv("SNS_TOPIC_ARN");
    private static final boolean SMS_ENABLED = Boolean.parseBoolean(System.getenv("SMS_ENABLED"));
    private static final String SMS_PHONE_NUMBER = System.getenv("SMS_PHONE_NUMBER");
    private static final AmazonSNS snsClient = AmazonSNSClientBuilder.defaultClient();

    public static boolean sendNotification(
            String emailSubject,
            String emailMessage,
            String smsMessage,
            LambdaLogger logger)
    {
        boolean result = false;
        if (SNS_TOPIC_ARN == null || SNS_TOPIC_ARN.isEmpty()) {
            logger.log("[ERROR] No SNS_TOPIC_ARN in environment");
        } else {
            if (emailMessage != null && !emailMessage.isEmpty()) {
                try {
                    send_via_email(emailSubject, emailMessage, logger);
                    result = true;
                } catch (Exception e) {
                    logger.log("[ERROR] Failed to send notification via email: " + e.getMessage());
                }
            }
            if (SMS_ENABLED && SMS_PHONE_NUMBER != null && !SMS_PHONE_NUMBER.isEmpty()) {
                if (smsMessage != null && !smsMessage.isEmpty()) {
                    try {
                        send_via_sms(smsMessage, logger);
                        result = true;
                    } catch (Exception e) {
                        logger.log("[ERROR] Failed to send notification via SMS: " + e.getMessage());
                    }
                }
            }
        }

        return result;
    }

    // Send notification via SNS (transport Email)
    private static void send_via_email(String subject, String message, LambdaLogger logger) {
        PublishRequest publishRequest = new PublishRequest()
                .withTopicArn(SNS_TOPIC_ARN)
                .withMessage(message)
                .withSubject(subject);
        snsClient.publish(publishRequest);
        logger.log("[DEBUG] SNS notification via email sent.");
    }

    // Send notification via SNS (transport SMS)
    private static void send_via_sms(String message, LambdaLogger logger) {
        PublishRequest publishRequest = new PublishRequest()
                .withPhoneNumber(SMS_PHONE_NUMBER)
                .withMessage(message);

        PublishResult publishResult = snsClient.publish(publishRequest);
        logger.log("[DEBUG] SMS notification sent with message ID: " + publishResult.getMessageId());
    }
}
