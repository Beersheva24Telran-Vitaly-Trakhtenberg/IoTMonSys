import { PreTokenGenerationTriggerEvent } from 'aws-lambda';

exports.handler = async (event: PreTokenGenerationTriggerEvent) => {
  const attrs = event.request.userAttributes;

  event.response = {
    claimsOverrideDetails: {
      claimsToAddOrOverride: {
        role: attrs['custom:role'],
        department: attrs['custom:department'],
      },
    },
  };

  return event;
};