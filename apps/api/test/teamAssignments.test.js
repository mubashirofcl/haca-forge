import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/server.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/modules/users/model.js';
import { TeamAssignment } from '../src/modules/teamAssignments/model.js';
import { getManagedWorkerIds, isWorkerManagedBy } from '../src/lib/teamAccess.js';
import { updateUserRole } from '../src/modules/users/service.js';

describe('TeamAssignment Module & Access Helper Tests', () => {
  const testPrefix = 'ta_test_' + Date.now();
  let adminCookie;
  let headCookie;
  let lead1Cookie;
  let worker1Cookie;

  let adminUser;
  let headUser;
  let teamLead1;
  let teamLead2;
  let worker1;
  let worker2;

  beforeAll(async () => {
    await connectDB();

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Password123!', salt);

    const login = async (email, password = 'Password123!') => {
      const res = await request(app).post('/api/auth/login').send({ email, password });
      expect(res.status).toBe(200);
      return res.headers['set-cookie'];
    };

    // Ensure Admin
    adminUser = await User.findOne({ email: 'admin@marketingportal.com' });
    if (!adminUser) {
      adminUser = await User.create({
        name: 'TA Test Admin',
        email: `${testPrefix}_admin@example.com`,
        role: 'admin',
        passwordHash,
        status: 'active',
      });
      adminCookie = await login(adminUser.email, 'Password123!');
    } else {
      adminCookie = await login(adminUser.email, 'Admin1212');
    }

    // Create Head
    headUser = await User.create({
      name: 'TA Test Head',
      email: `${testPrefix}_head@example.com`,
      role: 'head',
      passwordHash,
      status: 'active',
    });
    headCookie = await login(headUser.email);

    // Create 2 Team Leads
    teamLead1 = await User.create({
      name: 'Team Lead Alpha',
      email: `${testPrefix}_lead1@example.com`,
      role: 'team_lead',
      teamId: 'content',
      passwordHash,
      status: 'active',
    });
    lead1Cookie = await login(teamLead1.email);

    teamLead2 = await User.create({
      name: 'Team Lead Beta',
      email: `${testPrefix}_lead2@example.com`,
      role: 'team_lead',
      teamId: 'graphics',
      passwordHash,
      status: 'active',
    });

    // Create 2 Workers
    worker1 = await User.create({
      name: 'Worker One',
      email: `${testPrefix}_worker1@example.com`,
      role: 'worker',
      teamId: 'content',
      passwordHash,
      status: 'active',
    });
    worker1Cookie = await login(worker1.email);

    worker2 = await User.create({
      name: 'Worker Two',
      email: `${testPrefix}_worker2@example.com`,
      role: 'worker',
      teamId: 'graphics',
      passwordHash,
      status: 'active',
    });
  }, 30000);

  afterAll(async () => {
    await User.deleteMany({ email: { $regex: testPrefix } });
    await TeamAssignment.deleteMany({
      $or: [
        { teamLeadId: { $in: [teamLead1?._id, teamLead2?._id] } },
        { workerId: { $in: [worker1?._id, worker2?._id] } },
      ],
    });
    await disconnectDB();
  }, 30000);

  it('1. Admin can assign worker to team lead via POST /api/team-assignments', async () => {
    const res = await request(app)
      .post('/api/team-assignments')
      .set('Cookie', adminCookie)
      .send({
        teamLeadId: teamLead1._id.toString(),
        workerId: worker1._id.toString(),
        notes: 'Assigned for content pipeline',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.assignment.active).toBe(true);
    expect(res.body.assignment.teamLeadId._id.toString()).toBe(teamLead1._id.toString());
    expect(res.body.assignment.workerId._id.toString()).toBe(worker1._id.toString());
  });

  it('2. Non-admin (team lead or worker) cannot assign workers (403 forbidden)', async () => {
    const res = await request(app)
      .post('/api/team-assignments')
      .set('Cookie', lead1Cookie)
      .send({
        teamLeadId: teamLead1._id.toString(),
        workerId: worker2._id.toString(),
      });

    expect(res.status).toBe(403);
  });

  it('3. Worker can have multiple active team leads (many-to-many relationship)', async () => {
    // Assign worker1 to teamLead2 as well
    const res = await request(app)
      .post('/api/team-assignments')
      .set('Cookie', adminCookie)
      .send({
        teamLeadId: teamLead2._id.toString(),
        workerId: worker1._id.toString(),
        notes: 'Cross-functional design assist',
      });

    expect(res.status).toBe(201);

    // Query leads for worker1
    const leadsRes = await request(app)
      .get(`/api/team-assignments/worker/${worker1._id}`)
      .set('Cookie', adminCookie);

    expect(leadsRes.status).toBe(200);
    expect(leadsRes.body.leads.length).toBe(2);
    const leadIds = leadsRes.body.leads.map((l) => l.teamLeadId._id.toString());
    expect(leadIds).toContain(teamLead1._id.toString());
    expect(leadIds).toContain(teamLead2._id.toString());
  });

  it('4. Team lead can have multiple active workers', async () => {
    // Assign worker2 to teamLead1
    const res = await request(app)
      .post('/api/team-assignments')
      .set('Cookie', adminCookie)
      .send({
        teamLeadId: teamLead1._id.toString(),
        workerId: worker2._id.toString(),
      });

    expect(res.status).toBe(201);

    // Query workers for teamLead1
    const leadRes = await request(app)
      .get(`/api/team-assignments/lead/${teamLead1._id}`)
      .set('Cookie', lead1Cookie);

    expect(leadRes.status).toBe(200);
    expect(leadRes.body.assignments.length).toBe(2);
  });

  it('5. Unassign deactivates row (soft-delete), records endedAt and endReason', async () => {
    const res = await request(app)
      .delete('/api/team-assignments')
      .set('Cookie', adminCookie)
      .send({
        teamLeadId: teamLead1._id.toString(),
        workerId: worker2._id.toString(),
        reason: 'reassigned',
      });

    expect(res.status).toBe(200);
    expect(res.body.assignment.active).toBe(false);
    expect(res.body.assignment.endReason).toBe('reassigned');
    expect(res.body.assignment.endedAt).toBeTruthy();

    // Verify active query now returns only 1 worker for teamLead1
    const activeLeadRes = await request(app)
      .get(`/api/team-assignments/lead/${teamLead1._id}?activeOnly=true`)
      .set('Cookie', lead1Cookie);

    expect(activeLeadRes.body.assignments.length).toBe(1);
    expect(activeLeadRes.body.assignments[0].workerId._id.toString()).toBe(worker1._id.toString());
  });

  it('6. GET /api/team-assignments/me returns appropriate context per role', async () => {
    // As Team Lead: returns managed worker assignments
    const tlMeRes = await request(app)
      .get('/api/team-assignments/me')
      .set('Cookie', lead1Cookie);

    expect(tlMeRes.status).toBe(200);
    expect(tlMeRes.body.role).toBe('team_lead');
    expect(Array.isArray(tlMeRes.body.assignments)).toBe(true);

    // As Worker: returns their leads
    const workerMeRes = await request(app)
      .get('/api/team-assignments/me')
      .set('Cookie', worker1Cookie);

    expect(workerMeRes.status).toBe(200);
    expect(workerMeRes.body.role).toBe('worker');
    expect(Array.isArray(workerMeRes.body.leads)).toBe(true);
    expect(workerMeRes.body.leads.length).toBeGreaterThanOrEqual(1);
  });

  it('7. Centralized helper getManagedWorkerIds returns correct sets for each role', async () => {
    // Admin manages 'all'
    const adminManaged = await getManagedWorkerIds(adminUser);
    expect(adminManaged).toBe('all');

    // Head manages 'all'
    const headManaged = await getManagedWorkerIds(headUser);
    expect(headManaged).toBe('all');

    // Team Lead manages only their actively assigned workers (plus themselves)
    const tlManaged = await getManagedWorkerIds(teamLead1);
    expect(Array.isArray(tlManaged)).toBe(true);
    const tlStrings = tlManaged.map((id) => id.toString());
    expect(tlStrings).toContain(worker1._id.toString());
    expect(tlStrings).toContain(teamLead1._id.toString());
    expect(tlStrings).not.toContain(worker2._id.toString()); // worker2 was unassigned above

    // Worker manages only self
    const workerManaged = await getManagedWorkerIds(worker1);
    expect(workerManaged.map((id) => id.toString())).toEqual([worker1._id.toString()]);

    // isWorkerManagedBy helper assertions
    expect(await isWorkerManagedBy(adminUser, worker1._id)).toBe(true);
    expect(await isWorkerManagedBy(headUser, worker1._id)).toBe(true);
    expect(await isWorkerManagedBy(teamLead1, worker1._id)).toBe(true);
    expect(await isWorkerManagedBy(teamLead1, worker2._id)).toBe(false);
  });

  it('8. Changing user role away from worker or team_lead automatically soft-ends active assignments', async () => {
    // worker1 currently has an active assignment with teamLead2
    const beforeAssignment = await TeamAssignment.findOne({
      teamLeadId: teamLead2._id,
      workerId: worker1._id,
      active: true,
    });
    expect(beforeAssignment).toBeTruthy();

    // Promote worker1 to dept_staff
    await updateUserRole(worker1._id, 'dept_staff', adminUser);

    // Check that active assignment was automatically deactivated with endReason 'role_changed'
    const afterAssignment = await TeamAssignment.findById(beforeAssignment._id);
    expect(afterAssignment.active).toBe(false);
    expect(afterAssignment.endReason).toBe('role_changed');
    expect(afterAssignment.endedAt).toBeTruthy();
  });
});
