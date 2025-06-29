jest.mock('../src/models/Device', () => ({}));
jest.mock('../src/models/deviceData', () => ({}));

const { setDiscoveryMode, getDiscoveryMode } = require('../src/services/deviceDataService');

describe('Device Data Service', () => {
  beforeEach(() => {
    setDiscoveryMode(false);
  });

  describe('Discovery Mode', () => {
    test('Should enable discovery mode', () => {
      const result = setDiscoveryMode(true, 1000);
      expect(result.enabled).toBe(true);
      expect(getDiscoveryMode().enabled).toBe(true);
    });

    test('Should disable discovery mode', () => {
      setDiscoveryMode(true);

      const result = setDiscoveryMode(false);
      expect(result.enabled).toBe(false);
      expect(getDiscoveryMode().enabled).toBe(false);
    });

    test('Should automatically disable discovery mode after timeout', async () => {
      setDiscoveryMode(true, 100);
      expect(getDiscoveryMode().enabled).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(getDiscoveryMode().enabled).toBe(false);
    });
  });
});