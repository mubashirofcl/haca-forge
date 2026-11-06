// GET /api/departments?inUse=true: only departments with real data. Disposable test DB.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { connectDB } from '../src/config/db.js';
import { Person } from '../src/modules/people/model.js';
import { Department } from '../src/modules/departments/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';

const EMAIL = /@dept-inuse-test\.com$/;
const PREFIX = /^InUseTest /;

describe('departments in use', () => {
  let token;
  const ids = {};
  const cleanup = async () => {
    await WorkItem.collection.deleteMany({ title: /^InUseTest / });
    await Person.deleteMany({ email: EMAIL });
    await Department.deleteMany({ name: PREFIX });
  };

  beforeAll(async () => {
    await connectDB();
    await cleanup();
    for (const [key, code] of [['withPerson', 'inuse_person'], ['withWork', 'inuse_work'], ['suspendedOnly', 'inuse_susp'], ['empty', 'inuse_empty']]) {
      ids[key] = String((await Department.create({ name: `InUseTest ${key}`, code, type: code, isActive: true }))._id);
    }
    const viewer = await Person.create({ name: 'InUse Viewer', email: 'viewer@dept-inuse-test.com', role: 'executive', status: 'active' });
    token = jwt.sign({ userId: viewer._id.toString(), email: viewer.email, role: viewer.role }, env.JWT_SECRET, { expiresIn: '1h' });
    await Person.create({ name: 'InUse Active', email: 'a@dept-inuse-test.com', role: 'team_member', status: 'active', departmentId: ids.withPerson });
    await Person.create({ name: 'InUse Suspended', email: 's@dept-inuse-test.com', role: 'team_member', status: 'suspended', departmentId: ids.suspendedOnly });
    await WorkItem.collection.insertOne({ title: 'InUseTest item', departmentId: new Department({ _id: ids.withWork })._id, status: 'Not Started' });
  });
  afterAll(cleanup);

  const names = (res) => res.body.data.map((d) => String(d._id));

  it('inUse=true lists departments with an active person or a work item, and no others', async () => {
    const res = await request(app).get('/api/departments?inUse=true').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const got = names(res);
    expect(got).toContain(ids.withPerson);
    expect(got).toContain(ids.withWork);
    expect(got).not.toContain(ids.empty);
    expect(got).not.toContain(ids.suspendedOnly);
  });

  it('without the flag every department is still listed, for assignment forms', async () => {
    const got = names(await request(app).get('/api/departments').set('Authorization', `Bearer ${token}`));
    for (const id of Object.values(ids)) expect(got).toContain(id);
  });
});
