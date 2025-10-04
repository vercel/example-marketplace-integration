// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Set up environment variables for testing
process.env.KV_URL = 'redis://localhost:6379';
process.env.INTEGRATION_CLIENT_ID = 'test-client-id';
process.env.INTEGRATION_CLIENT_SECRET = 'test-client-secret';
process.env.CRON_SECRET = 'test-cron-secret';

// Mock nanoid to avoid ES module issues
jest.mock('nanoid', () => ({
  nanoid: () => 'test-id-123',
}));