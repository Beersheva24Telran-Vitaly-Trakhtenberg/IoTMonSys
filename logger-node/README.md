# IoTMonSys Logger Module

A universal logging module for the IoTMonSys project with advanced features, including structured logging in JSON format, integration with AWS CloudWatch Logs, and contextual logging.

## Features

- Structured logging in JSON-formate
- Log file rotation
- AWS CloudWatch Logs integration
- Contextual logging (trace ID, request ID)
- Enhanced logging levels and colors for better visibility and filtering
- Metadata logging (hostname, environment, service name)
- Middleware for HTTP-requests with automated tracing
- Compatible with both ESM and CommonJS modules (import/require)

## Setup

```bash
# In project root directory
yarn install

# Or setup just this module
cd logger-node
yarn install
```

## Usage

### Basic usage

```javascript
import { createLogger } from '@iotmonsys/logger-node';

// Create a logger instance with a service name and log file path. 
const logger = createLogger('my-service', './logs');

// Different levels logging
logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message');
logger.alert('Critical alert');
```

### Contextual logging

```javascript
import { createLogger, setLoggerContext, clearLoggerContext, generateLoggerTraceId } from '@iotmonsys/logger-node';

const logger = createLogger('my-service', './logs');

// Generation and setting context
const traceId = generateLoggerTraceId();
setLoggerContext({ traceId, deviceId: 'device-123' });

// Logs will contain the context. 
logger.info('Processing device data');

// Clear context after operation finished
clearLoggerContext();
```

### HTTP-logger with tracing middleware.

```javascript
import express from 'express';
import { createLogger, createHttpLogger, createErrorLogger } from '@iotmonsys/logger-node';

const app = express();
const logger = createLogger('api-service', './logs');

// Middleware for logging HTTP-requests with tracing
app.use(createHttpLogger(logger));

// Middleware for logging errors 
app.use(createErrorLogger(logger));

app.get('/api/devices', (req, res) => {
  // Context already sets in middleware. 
  logger.info('Fetching devices');
  
  // Additional context adding
  logger.setContext({ userId: req.user?.id });
  
  // Request processing logic
  res.json({ devices: [] });
});

app.listen(3000, () => {
  logger.info('Server started on port 3000');
});
```

### Integration with AWS CloudWatch Logs. 

To enable logging to AWS CloudWatch, set the following environment variables:

```
AWS_CLOUDWATCH_ENABLED=true
AWS_CLOUDWATCH_GROUP=IoTMonSys-ServiceName
AWS_CLOUDWATCH_STREAM=instance-name
AWS_REGION=us-east-1
```

## Logging levels

- `alert`: 0 - Critical errors requiring immediate activities
- `error`: 1 - Errors that disrupt the operation of the application
- `warn`: 2 - Warnings that do not interfere with application operation
- `info`: 3 - Information messages about the application's operation
- `http`: 4 - Logging HTTP requests
- `debug`: 5 - Debugging information

## Logs formats

### Console output 

```
2025-06-11 19:15:23:456 [my-service] info [trace-id] [request-id]: Message
```

### Files output and CloudWatch output (JSON)

```json
{
  "timestamp": "2025-06-11T19:15:23.456Z",
  "level": "info",
  "message": "Message",
  "service": "my-service",
  "hostname": "server-name",
  "environment": "development",
  "traceId": "trace-id",
  "requestId": "request-id",
  "deviceId": "device-123"
}
```

## Settings

The logging module uses the following environment variables:

| Variable | Description | Default value |
|------------|----------|----------------------|
| NODE_ENV | Environment (development/production) | development |
| LOG_FORMAT | Log format (text/json) | text for development, json for production |
| AWS_CLOUDWATCH_ENABLED | Enable sending logs to CloudWatch | false |
| AWS_CLOUDWATCH_GROUP | CloudWatch log group name | - |
| AWS_CLOUDWATCH_STREAM | CloudWatch log stream name (default: hostname-date) | - |
| AWS_REGION | AWS region | - |
