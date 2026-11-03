import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { connectDB } from '../src/config/db.js';
import { Person } from '../src/modules/people/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';

describe('Security Probe: Creative Head executing worker actions on tasks owned by others', () => {
  let headUser, writerUser, workItem;
  let headToken;

  beforeAll(async () => {
    await connectDB();

    headUser = await Person.create({
      name: 'Probe Creative Head',
      email: 'probe.head@test.com',
      role: 'creative_head',
      status: 'active',
    });

    writerUser = await Person.create({
      name: 'Probe Writer',
      email: 'probe.writer@test.com',
      role: 'team_member',
      status: 'active',
    });

    const dept = await mongoose.connection.db.collection('departments').findOne({});
    const prof = await mongoose.connection.db.collection('profiles').findOne({});

    workItem = await WorkItem.create({
      title: 'Security Probe Work',
      workType: 'Copy',
      ownerId: writerUser._id,
      status: 'In Progress',
      stageKey: 'Content',
      isLocked: false,
      deadline: new Date(Date.now() + 86400000),
      departmentId: dept._id,
      profileId: prof._id,
    });

    headToken = jwt.sign(
      { userId: headUser._id.toString(), email: headUser.email, role: headUser.role },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    if (workItem?._id) await WorkItem.findByIdAndDelete(workItem._id);
    if (headUser?._id) await Person.findByIdAndDelete(headUser._id);
    if (writerUser?._id) await Person.findByIdAndDelete(writerUser._id);
  });

  it('probes whether Creative Head can submit a task owned by someone else', async () => {
    const res = await request(app)
      .post(`/api/work/${workItem._id}/transition`)
      .set('Authorization', `Bearer ${headToken}`)
      .send({ toStatus: 'Pending', deliverableUrl: 'https://evil.com/doc' });

    console.log('[PROBE RESULT] Creative Head Submit Status:', res.status, res.body);
  });

  it('probes whether Creative Head can mark blocked a task owned by someone else', async () => {
    await WorkItem.findByIdAndUpdate(workItem._id, { status: 'In Progress' });
    const res = await request(app)
      .post(`/api/work/${workItem._id}/transition`)
      .set('Authorization', `Bearer ${headToken}`)
      .send({ toStatus: 'Blocked', blockerReason: 'Waiting for feedback', blockerNote: 'Probe block' });

    console.log('[PROBE RESULT] Creative Head Block Status:', res.status, res.body);
  });

  it('probes whether Creative Head can publish a task owned by someone else', async () => {
    await WorkItem.findByIdAndUpdate(workItem._id, { status: 'Approved' });
    const res = await request(app)
      .post(`/api/work/${workItem._id}/transition`)
      .set('Authorization', `Bearer ${headToken}`)
      .send({ toStatus: 'Published', publishedUrl: 'https://instagram.com/p/evil' });

    console.log('[PROBE RESULT] Creative Head Publish Status:', res.status, res.body);
  });
});
