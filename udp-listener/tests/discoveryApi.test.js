const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const discoveryApi = require('../src/api/discoveryApi');
const { setDiscoveryMode, getDiscoveryMode } = require('../src/services/deviceDataService');

jest.mock('../src/services/deviceDataService', () => ({
  setDiscoveryMode: jest.fn(),
  getDiscoveryMode: jest.fn()
}));

describe('Discovery API', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(bodyParser.json());
    app.use('/api', discoveryApi);

    getDiscoveryMode.mockReturnValue({ enabled: false });
    setDiscoveryMode.mockImplementation((enabled, duration) => {
      return { enabled, duration: duration || 60000 };
    });
  });

  test('GET /api/discovery should return current discovery mode status', async () => {
    const response = await request(app).get('/api/discovery');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ enabled: false });
    expect(getDiscoveryMode).toHaveBeenCalled();
  });

  test('POST /api/discovery should enable discovery mode', async () => {
    const response = await request(app)
      .post('/api/discovery')
      .send({ enabled: true, duration: 120000 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ enabled: true, duration: 120000 });
    expect(setDiscoveryMode).toHaveBeenCalledWith(true, 120000);
  });

  test('POST /api/discovery should disable discovery mode', async () => {
    const response = await request(app)
      .post('/api/discovery')
      .send({ enabled: false });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ enabled: false, duration: 60000 });
    expect(setDiscoveryMode).toHaveBeenCalledWith(false, undefined);
  });

  test('POST /api/discovery should return 400 for invalid request', async () => {
    const response = await request(app)
      .post('/api/discovery')
      .send({ invalid: 'data' });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(setDiscoveryMode).not.toHaveBeenCalled();
  });
});