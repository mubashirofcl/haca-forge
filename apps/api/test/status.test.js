import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/server.js';

describe('Health Check Endpoint', () => {
  it('GET /api/status should return 200 with service information', async () => {
    const res = await request(app).get('/api/status');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('marketing-workflow-api');
    expect(res.body.uptime).toBeDefined();
  });
});
