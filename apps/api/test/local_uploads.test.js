import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { User } from '../src/modules/people/model.js';

describe('Local File Uploads Engine', () => {
  let authToken, testUser;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.MONGODB_URI);
    }

    testUser = await User.create({
      name: 'Local Test Shooter',
      email: `shooter_local_${Date.now()}@haca.local`,
      role: 'team_member',
      status: 'active',
      password: 'password123',
    });

    authToken = jwt.sign(
      {
        userId: testUser._id.toString(),
        role: testUser.role,
        name: testUser.name,
        email: testUser.email,
      },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    if (testUser) {
      await User.findByIdAndDelete(testUser._id);
    }
  });

  it('successfully uploads an image to local project uploads folder and serves it statically', async () => {
    const dummyImageBuffer = Buffer.from('FAKE_IMAGE_DATA_PNG_HEADER_12345');

    const res = await request(app)
      .post('/api/uploads/file')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', dummyImageBuffer, 'test_sample.png')
      .field('kind', 'image');

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.url).toMatch(/^\/uploads\/.+\.png$/);
    expect(res.body.data.storageId).toBeDefined();
    expect(res.body.data.fileName).toBe('test_sample.png');
    expect(res.body.data.kind).toBe('image');

    // Test static file serving from the returned url
    const fileUrl = res.body.data.url;
    const staticRes = await request(app).get(fileUrl);
    expect(staticRes.status).toBe(200);
    expect(staticRes.body.toString()).toBe('FAKE_IMAGE_DATA_PNG_HEADER_12345');

    // Clean up created file from apps/api/uploads
    const filename = path.basename(fileUrl);
    const uploadedFilePath = path.resolve(process.cwd(), 'uploads', filename);
    if (fs.existsSync(uploadedFilePath)) {
      try { fs.unlinkSync(uploadedFilePath); } catch {}
    }
  });

  it('rejects uploads without a file', async () => {
    const res = await request(app)
      .post('/api/uploads/file')
      .set('Authorization', `Bearer ${authToken}`)
      .field('kind', 'image');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NO_FILE_PROVIDED');
  });

  it('rejects unauthenticated upload requests', async () => {
    const dummyBuffer = Buffer.from('TEST');
    const res = await request(app)
      .post('/api/uploads/file')
      .attach('file', dummyBuffer, 'test.png');

    expect(res.status).toBe(401);
  });
});
