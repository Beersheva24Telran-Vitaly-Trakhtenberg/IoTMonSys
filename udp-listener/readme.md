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

## Installation

1. Install dependencies:
2. 