package optdev.iotmonsys.lambdas.utils;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

public class WebResponsesHelper {
    /**
     * Builds a JSON response that conforms to the AWS Lambda proxy integration format.
     * The response is a JSON object with the following properties:
     * @param statusCode The HTTP status code of the response.
     * @param body The response body.
     * @return A JSON string representing the response.
     *
     * The method will pad the input body with double quotes if it is not empty.
     * If the input body is empty, the method will set it to "OK".
     * If the input status code is not between 100 and 599, the method will return a JSON string
     * representing an internal server error response.
     */
    public static String buildJSONResponse(
            int statusCode,
            String body)
    {
        if (statusCode < 0 || statusCode > 599) {
            return "{\"statusCode\":\"500\",\"headers\":{\"Content-Type\":\"application/json\",\"Access-Control-Allow-Origin\":\"*\"},\"body\":\"\\\"Internal Server Error - Invalid response status code\\\"\"}";
        }
        if (body == null || body.trim().isEmpty()) {
            body = "OK";
        }

        ObjectMapper mapper = new ObjectMapper();
        ObjectNode rootNode = mapper.createObjectNode();

        rootNode.put("statusCode", statusCode);
        ObjectNode headersNode = rootNode.putObject("headers");
        headersNode.put("Content-Type", "application/json");
        headersNode.put("Access-Control-Allow-Origin", "*");

        rootNode.put("body", "\"" + body + "\"");

        try {
            return mapper.writeValueAsString(rootNode);
        } catch (Exception e) {
            return "{\"statusCode\":\"500\",\"headers\":{\"Content-Type\":\"application/json\",\"Access-Control-Allow-Origin\":\"*\"},\"body\":\"\\\"Internal Server Error\\\"\"}";
        }
    }
}
