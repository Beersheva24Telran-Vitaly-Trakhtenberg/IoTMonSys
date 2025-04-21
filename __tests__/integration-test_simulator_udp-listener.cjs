const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '.env') });

const { exec } = require('child_process');
const mongoose = require('mongoose');
const assert = require('assert');
const { promisify } = require('util');
const sleep = promisify(setTimeout);

async function testIntegration() {
  const listenerProcess = exec('cd ../udp-listener && npm start -- --test-mode');

  try {
    await sleep(3000);

    const simulatorProcess = exec('cd ../simulator && npm start -- --devices 1 --interval 1000 --udp-host localhost --udp-port 41234');

    await sleep(5000);

    const connection = await mongoose.connect(process.env.MONGODB_URI);
    const DeviceData = mongoose.model('DeviceData', new mongoose.Schema({
      deviceId: String,
      type: String,
      value: Number,
      timestamp: Date
    }));

    const count = await DeviceData.countDocuments();
    assert(count > 0, 'MongoDB: No any data.');

    console.log(`Test successful. Found ${count} records.`);

    simulatorProcess.kill();

    await mongoose.connection.close();

    return true;
  } catch (error) {
    console.error('Integration test failed. Error: ', error);
    return false;
  } finally {
    listenerProcess.kill();
  }
}

testIntegration().then(success => process.exit(success ? 0 : 1));