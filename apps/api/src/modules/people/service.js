import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Person } from './model.js';
import { resolveScope } from '../../lib/scope.js';
import { logActivity } from '../activity/service.js';
import { normalizeRole } from '@mmp/shared';

export async function listPeople({ actor, filters = {}, excludeAdmin = false }) {
  const scope = await resolveScope(actor, filters);
  if (!scope.isAllowed) {
    return [];
  }

  const query = {};

  // Person visibility scoping
  if (scope.allowedPersonIds !== null) {
    query._id = { $in: scope.allowedPersonIds };
  }

  // Department filter
  if (filters.departmentId) {
    query.departmentId = filters.departmentId;
  }

  // Status filter (default to active and invited unless specified)
  if (filters.status) {
    query.status = filters.status;
  }

  // Role filter
  if (filters.role) {
    query.role = filters.role;
  }

  // Exclude admin and executive from auto-assignment candidate pools, workload calculations, and performance metrics
  if (excludeAdmin) {
    query.role = { $nin: ['admin', 'executive'] };
  }

  const people = await Person.find(query)
    .populate('departmentId', 'name code')
    .populate('profileAccess', 'name code active')
    .populate('reportsToIds', 'name email role jobRole')
    .sort({ name: 1 })
    .lean();

  if (normalizeRole(actor?.role) === 'executive') {
    return people.map((p) => {
      const sanitized = { ...p };
      delete sanitized.email;
      delete sanitized.phone;
      if (Array.isArray(sanitized.reportsToIds)) {
        sanitized.reportsToIds = sanitized.reportsToIds.map((r) => {
          if (typeof r === 'object' && r !== null) {
            const rep = { ...r };
            delete rep.email;
            delete rep.phone;
            return rep;
          }
          return r;
        });
      }
      return sanitized;
    });
  }

  return people;
}

export async function getPersonById(id, actor) {
  const person = await Person.findById(id)
    .populate('departmentId', 'name code')
    .populate('profileAccess', 'name code active')
    .populate('reportsToIds', 'name email role jobRole')
    .lean();

  if (!person) {
    const error = new Error('Person not found');
    error.code = 'PERSON_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  if (actor) {
    const scope = await resolveScope(actor);
    if (!scope.canAccessPerson(person._id)) {
      const error = new Error('Access denied: person is outside your team scope');
      error.code = 'FORBIDDEN';
      error.statusCode = 403;
      throw error;
    }
  }

  if (normalizeRole(actor?.role) === 'executive') {
    const sanitized = { ...person };
    delete sanitized.email;
    delete sanitized.phone;
    if (Array.isArray(sanitized.reportsToIds)) {
      sanitized.reportsToIds = sanitized.reportsToIds.map((r) => {
        if (typeof r === 'object' && r !== null) {
          const rep = { ...r };
          delete rep.email;
          delete rep.phone;
          return rep;
        }
        return r;
      });
    }
    return sanitized;
  }

  return person;
}

export async function createPerson(data, actor) {
  const actorRole = normalizeRole(actor?.role);
  if (actorRole !== 'admin') {
    const error = new Error('Forbidden: only Administrator can create users');
    error.code = 'FORBIDDEN';
    error.statusCode = 403;
    throw error;
  }

  const email = (data.email || '').toLowerCase().trim();
  const existing = await Person.findOne({ email });
  if (existing) {
    const error = new Error('A person with this email already exists');
    error.code = 'PERSON_EXISTS';
    error.statusCode = 409;
    throw error;
  }

  let passwordHash = undefined;
  let mustSetPassword = true;

  if (data.password) {
    const salt = await bcrypt.genSalt(10);
    passwordHash = await bcrypt.hash(data.password, salt);
    mustSetPassword = false;
  }

  const person = await Person.create({
    name: data.name.trim(),
    email,
    passwordHash,
    role: data.role || 'team_member',
    jobRole: data.jobRole || '',
    departmentId: data.departmentId || null,
    profileAccess: data.profileAccess || [],
    reportsToIds: data.reportsToIds || [],
    weeklyCapacityHours: data.weeklyCapacityHours ?? 40,
    workPreferences: data.workPreferences || [],
    status: data.status || 'active',
    mustSetPassword,
  });

  await logActivity({
    entityType: 'person',
    entityId: person._id,
    actor,
    action: 'person.created',
    metadata: { name: person.name, email: person.email, role: person.role },
  });

  return person;
}

export async function updatePerson(id, updates, actor) {
  const actorRole = normalizeRole(actor?.role);
  const target = await Person.findById(id);

  if (!target) {
    const error = new Error('Person not found');
    error.code = 'PERSON_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  const targetRole = normalizeRole(target.role);

  // Creative Head update restrictions
  if (actorRole === 'creative_head') {
    // Cannot touch admin, creative_head, or executive accounts
    if (targetRole === 'admin' || targetRole === 'creative_head' || targetRole === 'executive') {
      const error = new Error('Forbidden: Creative Head cannot modify admin, executive, or other creative_head accounts');
      error.code = 'FORBIDDEN';
      error.statusCode = 403;
      throw error;
    }

    // Cannot modify core account identity fields
    if (updates.role && updates.role !== target.role) {
      const error = new Error('Forbidden: Creative Head cannot change user roles');
      error.code = 'FORBIDDEN';
      error.statusCode = 403;
      throw error;
    }

    if (updates.status && updates.status !== target.status) {
      const error = new Error('Forbidden: Creative Head cannot change user status (suspend/activate)');
      error.code = 'FORBIDDEN';
      error.statusCode = 403;
      throw error;
    }

    if (updates.email || updates.password || updates.name) {
      const error = new Error('Forbidden: Creative Head can only edit operational fields (department, jobRole, workPreferences, weeklyCapacityHours)');
      error.code = 'FORBIDDEN';
      error.statusCode = 403;
      throw error;
    }

    // Only apply operational fields
    if (updates.departmentId !== undefined) target.departmentId = updates.departmentId;
    if (updates.jobRole !== undefined) target.jobRole = updates.jobRole;
    if (updates.profileAccess !== undefined) target.profileAccess = updates.profileAccess;
    if (updates.reportsToIds !== undefined) target.reportsToIds = updates.reportsToIds;
    if (updates.weeklyCapacityHours !== undefined) target.weeklyCapacityHours = updates.weeklyCapacityHours;
    if (updates.lastProfileId !== undefined) target.lastProfileId = updates.lastProfileId;
    if (updates.workPreferences !== undefined) target.workPreferences = updates.workPreferences;
  } else if (actorRole === 'admin') {
    // Admin has full control
    if (updates.name !== undefined) target.name = updates.name;
    if (updates.email !== undefined) target.email = updates.email.toLowerCase().trim();
    if (updates.role !== undefined) target.role = updates.role;
    if (updates.status !== undefined) target.status = updates.status;
    if (updates.jobRole !== undefined) target.jobRole = updates.jobRole;
    if (updates.departmentId !== undefined) target.departmentId = updates.departmentId;
    if (updates.profileAccess !== undefined) target.profileAccess = updates.profileAccess;
    if (updates.reportsToIds !== undefined) target.reportsToIds = updates.reportsToIds;
    if (updates.weeklyCapacityHours !== undefined) target.weeklyCapacityHours = updates.weeklyCapacityHours;
    if (updates.lastProfileId !== undefined) target.lastProfileId = updates.lastProfileId;
    if (updates.workPreferences !== undefined) target.workPreferences = updates.workPreferences;

    if (updates.password) {
      const salt = await bcrypt.genSalt(10);
      target.passwordHash = await bcrypt.hash(updates.password, salt);
      target.mustSetPassword = false;
    }
  } else {
    const error = new Error('Forbidden: insufficient permissions to update people');
    error.code = 'FORBIDDEN';
    error.statusCode = 403;
    throw error;
  }

  await target.save();

  await logActivity({
    entityType: 'person',
    entityId: target._id,
    actor,
    action: 'person.updated',
    metadata: { updatedFields: Object.keys(updates) },
  });

  return target;
}

export async function suspendPerson(id, actor) {
  const actorRole = normalizeRole(actor?.role);
  if (actorRole !== 'admin') {
    const error = new Error('Forbidden: only Administrator can suspend users');
    error.code = 'FORBIDDEN';
    error.statusCode = 403;
    throw error;
  }

  const target = await Person.findById(id);
  if (!target) {
    const error = new Error('Person not found');
    error.code = 'PERSON_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  if (target._id.toString() === (actor._id || actor.id || actor.userId)?.toString()) {
    const error = new Error('Cannot suspend your own admin account');
    error.code = 'CANNOT_SUSPEND_SELF';
    error.statusCode = 400;
    throw error;
  }

  target.status = 'suspended';
  target.refreshTokenHash = undefined; // Force logout
  await target.save();

  await logActivity({
    entityType: 'person',
    entityId: target._id,
    actor,
    action: 'person.suspended',
    fromStatus: 'active',
    toStatus: 'suspended',
  });

  return target;
}

export async function reactivatePerson(id, actor) {
  const actorRole = normalizeRole(actor?.role);
  if (actorRole !== 'admin') {
    const error = new Error('Forbidden: only Administrator can reactivate users');
    error.code = 'FORBIDDEN';
    error.statusCode = 403;
    throw error;
  }

  const target = await Person.findById(id);
  if (!target) {
    const error = new Error('Person not found');
    error.code = 'PERSON_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  target.status = 'active';
  await target.save();

  await logActivity({
    entityType: 'person',
    entityId: target._id,
    actor,
    action: 'person.reactivated',
    fromStatus: 'suspended',
    toStatus: 'active',
  });

  return target;
}

export async function getAssignmentCandidates({ departmentId, profileId, excludeIds = [] }) {
  const query = {
    role: { $nin: ['admin', 'executive'] }, // Admin & Executive strictly excluded from candidate pools
    status: 'active',
  };

  if (departmentId) {
    query.departmentId = departmentId;
  }

  if (profileId) {
    query.profileAccess = profileId;
  }

  if (excludeIds.length > 0) {
    query._id = { $nin: excludeIds };
  }

  return Person.find(query)
    .populate('departmentId', 'name code')
    .lean();
}
