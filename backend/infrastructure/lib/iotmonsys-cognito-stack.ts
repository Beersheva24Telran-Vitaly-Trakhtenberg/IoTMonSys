import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { RemovalPolicy } from 'aws-cdk-lib';
import { CfnUserPool } from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';


export class IotmonsysCognitoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const preTokenFn = new lambda.Function(this, 'PreTokenLambda', {
      functionName: 'PreTokenLambda',
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/preToken'),
    });
    preTokenFn.grantInvoke(new iam.ServicePrincipal('cognito-idp.amazonaws.com'));

    const logGroupResource = preTokenFn.node.tryFindChild('LogGroup');
    if (logGroupResource) {
      logGroupResource.node.tryRemoveChild('Resource');
    }

    // Cognito User Pool
    const rawUserPool = new CfnUserPool(this, 'IoTMonSysUserPool', {
      userPoolName: 'IoTMonSysUserPool',
      autoVerifiedAttributes: ['email'],
      usernameAttributes: ['email'],
      mfaConfiguration: 'OPTIONAL',
      enabledMfas: ['SOFTWARE_TOKEN_MFA'],
      lambdaConfig: {
        preTokenGeneration: preTokenFn.functionArn,
      },
      policies: {
        passwordPolicy: {
          minimumLength: 8,
          requireLowercase: true,
          requireUppercase: true,
          requireNumbers: true,
          requireSymbols: true,
        },
      },
      schema: [
        {
          name: 'role',
          attributeDataType: 'String',
          mutable: true,
          required: false,
        },
        {
          name: 'department',
          attributeDataType: 'String',
          mutable: true,
          required: false,
        },
      ],
      accountRecoverySetting: {
        recoveryMechanisms: [
          {
            name: 'verified_email',
            priority: 1,
          },
        ],
      },
    });

    // Теги ресурсов
    cdk.Tags.of(rawUserPool).add('Project', 'IoTMonSysControl');
    cdk.Tags.of(rawUserPool).add('Environment', 'Dev');

    // Группы
    new cognito.CfnUserPoolGroup(this, 'AdministratorsGroup', {
      userPoolId: rawUserPool.ref,
      groupName: 'Administrators',
      description: 'Administrators of the system',
      precedence: 1,
    });
    new cognito.CfnUserPoolGroup(this, 'OperatorsGroup', {
      userPoolId: rawUserPool.ref,
      groupName: 'Operators',
      description: 'Operators of the system',
      precedence: 5,
    });
    new cognito.CfnUserPoolGroup(this, 'UsersGroup', {
      userPoolId: rawUserPool.ref,
      groupName: 'Users',
      description: 'Users of the system',
      precedence: 10,
    });


    // App Client
    new cognito.CfnUserPoolClient(this, 'IoTMonSysAppClient', {
      userPoolId: rawUserPool.ref,
      clientName: 'IoTMonSysAppClient',
      generateSecret: false,
      explicitAuthFlows: [
        'ALLOW_ADMIN_USER_PASSWORD_AUTH',
        'ALLOW_USER_PASSWORD_AUTH',
        'ALLOW_REFRESH_TOKEN_AUTH',
      ],
      accessTokenValidity: 24,
      refreshTokenValidity: 30,
    });

  }
}
