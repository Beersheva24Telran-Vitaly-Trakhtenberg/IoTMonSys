/**
 * IoT-device data validation
 * @param {Object} data - Source device data, will be validated
 * @returns {Object} - Result of validation {isValid: boolean, error: string}
 */
function validateDeviceData(data) {
  let errors = [];
  let isValid = true;
  if (!data.deviceId) {
    isValid = false;
    errors.push(`'deviceId' field is missing`);
  }

  if (!data.type) {
    isValid = false;
    errors.push(`'type' field is missing`);
  }

  if (data.value === undefined || data.value === null) {
    isValid = false;
    errors.push(`'value' field is missing`);
  }

  if (!data.timestamp) {
    isValid = false;
    errors.push(`'timestamp' field is missing`);
  }

  if (isValid) {
    if (typeof data.deviceId !== 'string') {
      isValid = false;
      errors.push(`Incorrect format. 'deviceId' must be a String.`);
    }

    if (typeof data.type !== 'string') {
      isValid = false;
      errors.push(`Incorrect format. 'type' must be a String.`);
    }

    if (typeof data.value !== 'number') {
      isValid = false;
      errors.push(`Incorrect format. 'value' must be a Number.`);
    }

    /*try {
      new Date(data.timestamp);
    } catch (error) {
      isValid = false;
      errors.push(`Incorrect format. 'timestamp' must be a Timestamp.`);
    }
*/
    if (data.timestamp) {
      const date = new Date(data.timestamp);
      if (isNaN(date.getTime())) {
        isValid = false;
        errors.push(`Incorrect format. 'timestamp' must be a valid Timestamp.`);
      }
    }

    if (data.batteryLevel !== undefined && typeof data.batteryLevel !== 'number') {
      isValid = false;
      errors.push(`Incorrect format. 'batteryLevel' must be a Number.`);
    }

    if (data.isAnomaly !== undefined && typeof data.isAnomaly !== 'boolean') {
      isValid = false;
      errors.push(`Incorrect format. 'isAnomaly' must be a Boolean.`);
    }
  }

  return { isValid: isValid, error: errors.length === 0 ? null : 'Found ' + errors.length + ' error(s): ' + errors.join(', ') };
}

module.exports = {
  validateDeviceData
};