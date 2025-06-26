# UDP Listener for IoT-devices Monitoring System

This component is a UDP listener for IoT-devices monitoring system.
It receives data from IoT-devices over UDP protocol, processes and saves them in MongoDB directly (*temporary and reserve solution*) or sends them to AWS Kinesis Data Streams.

## Functionality

- Receive data from IoT-devices
- Parse and validate incoming JSON data
- Store data in MongoDB
- Send data to AWS Kinesis Data Streams
- Handle network errors
- Send logs to CloudWatch
- Send metrics to CloudWatch
- Send alarms to CloudWatch
- Device discovery mode for automatic registration of new devices

## Installation

1. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

2. Configure environment variables:
   Create a `.env` file in the root directory with the following variables:
   ```
   # MongoDB Configuration
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>
   
   # UDP Server Configuration
   UDP_HOST=0.0.0.0
   UDP_PORT=41234
   
   # AWS Configuration
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your_access_key_id
   AWS_SECRET_ACCESS_KEY=your_secret_access_key
   KINESIS_STREAM_NAME=iot-data-stream
   
   # API Configuration
   API_PORT=3000
   ```

## Running the Application

Start the UDP listener:
```bash
npm start
# or
yarn start
```

For development with auto-restart:
```bash
npm run dev
# or
yarn dev
```

## Device Data Format

The UDP listener expects JSON data in the following format:
```json
{
  "deviceId": "device-123",
  "type": "temperature",
  "value": 25.5,
  "timestamp": "2025-04-08T18:30:00.000Z"
}
```

Required fields:
- `deviceId`: Unique identifier for the device
- `type`: Type of measurement (e.g., temperature, humidity, pressure)
- `value`: Numeric value of the measurement
- `timestamp`: ISO 8601 formatted timestamp

## Device Discovery Mode

The UDP listener includes a device discovery mode feature that allows automatic registration of new devices:

- When discovery mode is enabled, data from unregistered devices will be saved and the devices will be registered
- When discovery mode is disabled, data from unregistered devices will be rejected
- Discovery mode can be enabled for a specific duration, after which it automatically disables

### Discovery Mode API

The discovery mode can be controlled via the following API endpoints:

- `GET /api/discovery` - Get the current status of discovery mode
- `POST /api/discovery` - Enable or disable discovery mode
  ```json
  {
    "enabled": true,
    "duration": 60000  // Optional: Duration in milliseconds (default: 60000)
  }
  ```

## Testing

Run the test suite:
```bash
npm test
# or
yarn test
```

The test suite includes:
- Data validation tests
- Device data service tests
- UDP listener core functionality tests
- Discovery API tests

## Logs

Logs are stored in the `logs` directory and are rotated daily.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request