// Test setup file
import { jest } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-minimum-32-characters-long';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-minimum-32-characters-long';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';

// Increase timeout for slower machines
jest.setTimeout(10000);

// Clean up after all tests
afterAll(async () => {
  // Add cleanup logic if needed
});
