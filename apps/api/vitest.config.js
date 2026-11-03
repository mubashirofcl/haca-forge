import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /.*\/profile\.model\.js$/,
        replacement: path.resolve(__dirname, 'test/fixtures/profile.mock.js'),
      },
    ],
  },
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 15000,
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/marketing_portal_test',
    },
  },
});
