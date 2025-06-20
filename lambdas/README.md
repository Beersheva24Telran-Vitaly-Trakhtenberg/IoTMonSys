# IoTMonSys Lambda Module

This module contains AWS Lambda functions and shared dependencies for the IoTMonSys project.

## Prerequisites

- Java 21 (JDK)
- Maven 3.8+
- AWS CLI configured with appropriate credentials
- AWS SAM CLI

## Build and Deploy Instructions

### 1. Build the Lambda Functions

```sh
cd lambdas/functions
mvn clean package
```
This will generate the deployment JAR in target/functions-1.0-SNAPSHOT.jar.

### 2. Build the Shared Layer (if needed)

```sh
cd ../shared-dependencies
mvn clean package
``` 
Layer artifact will be in target/shared-dependencies-1.0-SNAPSHOT-lambda-layer.zip.

### 3. Package the SAM Application

```sh
cd ..
sam package \
  --template-file template.yaml \
  --output-template-file packaged.yaml \
  --s3-bucket iotmonsys-deploy-bucket
```
This uploads Lambda code and layer to S3 and generates a deployable CloudFormation template.

### 4. Deploy the SAM Application (Stack)

```sh
sam deploy \
  --template-file packaged.yaml \
  --stack-name iotmonsys-stack \
  --capabilities CAPABILITY_IAM
```
This deploys the CloudFormation stack to AWS.

### 5. Post-Deployment
* Check the AWS Console for Lambda functions, API Gateway, and Layer
* Test endpoints using API Gateway URLs
* Monitor logs in CloudWatch

### Notes
* All shared dependencies (e.g., MongoDB driver) are provided via Lambda Layer.
* All functions use the shared dependencies layer.
* All credentials are provided via AWS SECRETS.
* Environment variables are configured in template.yaml
* Update samconfig.toml for custom deployment parameters if needed.

#### Adding New Functions
If we need to add new functions or dependencies:
* Add handler classes to functions/src/main/java/...
* Update template.yaml with new function definitions
* Add new dependencies to the appropriate pom.xml
* Run mvn clean and rebuild

#### Troubleshooting
Ensure our AWS credentials have permissions for Lambda, CloudFormation, and S3.
If dependencies are missing at runtime, verify the Layer is attached and up-to-date.
