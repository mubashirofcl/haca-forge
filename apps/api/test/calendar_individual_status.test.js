import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { Person } from '../src/modules/people/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { CalendarPlan } from '../src/modules/calendar/plan.model.js';
import { ContentPiece } from '../src/modules/calendar/contentPiece.model.js';
import { getCalendarWorkItems } from '../src/modules/workItems/service.js';

const TOPIC = 'CalBadgeTest';
const START = new Date('2031-03-01T00:00:00.000Z');
const END = new Date('2031-03-31T23:59:59.000Z');
const PAST = new Date(Date.now() - 2 * 86400000);

describe('Calendar entries: individual work and status', () => {
  let admin;

  const removeLeftovers = async () => {
    const plans = await CalendarPlan.find({ code: /^CALBADGE-/ }).select('_id').lean();
    const pieces = await ContentPiece.find({ planId: { $in: plans.map((p) => p._id) } }).select('_id').lean();
    await WorkItem.deleteMany({ $or: [{ contentPieceId: { $in: pieces.map((p) => p._id) } }, { title: new RegExp(`^${TOPIC}`) }] });
    await ContentPiece.deleteMany({ _id: { $in: pieces.map((p) => p._id) } });
    await CalendarPlan.deleteMany({ _id: { $in: plans.map((p) => p._id) } });
    await Person.deleteOne({ email: 'cal.badge.admin@example.com' });
  };

  const plan = (code, kind) =>
    CalendarPlan.create({ code, title: code, kind, periodStart: START, periodEnd: END, createdById: admin._id, calendar: 'sm' });
  const piece = (planDoc, topic, rowStatus = 'approved') =>
    ContentPiece.create({ planId: planDoc._id, postingDate: new Date('2031-03-20T00:00:00.000Z'), topic, contentType: 'Poster', pipeline: 'design', rowStatus, calendar: 'sm' });
  const step = (title, pieceDoc, status, extra = {}) =>
    WorkItem.create({
      title: `${TOPIC} ${title}`,
      workType: 'Poster',
      contentPieceId: pieceDoc?._id || null,
      stageKey: 'Post',
      stageOrder: 2,
      status,
      isLocked: false,
      deadline: new Date('2031-03-15T00:00:00.000Z'),
      departmentId: new mongoose.Types.ObjectId(),
      profileId: new mongoose.Types.ObjectId(),
      ...extra,
    });

  const load = () => getCalendarWorkItems({ start: START.toISOString(), end: END.toISOString() }, admin);

  beforeAll(async () => {
    await connectDB();
    await removeLeftovers();
    admin = await Person.create({ name: 'Cal Badge Admin', email: 'cal.badge.admin@example.com', role: 'admin', status: 'active' });

    const individual = await plan('CALBADGE-IND', 'individual');
    const monthly = await plan('CALBADGE-MON', 'monthly');
    const indPiece = await piece(individual, `${TOPIC} individual`);
    const monPiece = await piece(monthly, `${TOPIC} monthly`);
    await piece(monthly, `${TOPIC} no steps`, 'draft');
    await step('individual step', indPiece, 'In Progress');
    await step('first monthly step', monPiece, 'Approved', { stageOrder: 1, stageKey: 'Design' });
    await step('final monthly step', monPiece, 'Pending', { isLocked: true });
  });

  afterAll(removeLeftovers);

  const find = (items, text) => items.find((i) => (i.topic || i.title).includes(text) && (text.includes('step') || i.isPublishEvent));

  it('flags work from an individual plan, on both the step and the publish date', async () => {
    const items = await load();
    expect(find(items, 'individual step').isIndividual).toBe(true);
    expect(find(items, `${TOPIC} individual`).isIndividual).toBe(true);
    expect(find(items, 'final monthly step').isIndividual).toBe(false);
    expect(find(items, `${TOPIC} monthly`).isIndividual).toBe(false);
  });

  it('a publish date takes the status of the final step and links to it', async () => {
    const items = await load();
    const publish = find(items, `${TOPIC} monthly`);
    const finalStep = find(items, 'final monthly step');
    expect(publish.status).toBe('Pending');
    expect(publish.isLocked).toBe(true);
    expect(String(publish.workItemId)).toBe(String(finalStep._id));
  });

  it('a row with no steps yet stays Planned and has nothing to open', async () => {
    const publish = find(await load(), `${TOPIC} no steps`);
    expect(publish.status).toBe('Planned');
    expect(publish.workItemId).toBeNull();
    expect(publish.isOverdue).toBe(false);
  });

  it('marks unfinished past-deadline steps as overdue, and finished ones not', async () => {
    const late = await step('late step', null, 'In Progress', { deadline: PAST });
    const finished = await step('finished late step', null, 'Approved', { deadline: PAST });
    const items = await getCalendarWorkItems({}, admin);
    const byId = (doc) => items.find((i) => String(i._id) === String(doc._id));
    expect(byId(late).isOverdue).toBe(true);
    expect(byId(late).isIndividual).toBe(true);
    expect(byId(finished).isOverdue).toBe(false);
  });
});
