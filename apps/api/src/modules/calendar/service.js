import { CalendarEntry } from './model.js';

export async function listEntries(filters = {}) {
  const query = {};
  if (filters.from || filters.to) {
    query.date = {};
    if (filters.from) query.date.$gte = new Date(filters.from);
    if (filters.to) {
      const toDate = new Date(filters.to);
      toDate.setHours(23, 59, 59, 999);
      query.date.$lte = toDate;
    }
  }
  if (filters.platform) query.platform = filters.platform.toLowerCase();
  if (filters.status) query.status = filters.status;

  return CalendarEntry.find(query).populate('owner', 'name email role').sort({ date: 1 }).lean();
}

export async function createEntry(data, user) {
  const entry = await CalendarEntry.create({
    ...data,
    owner: data.owner || user._id,
  });
  return entry;
}

export async function updateEntry(id, updates) {
  return CalendarEntry.findByIdAndUpdate(id, updates, { new: true }).lean();
}

export async function deleteEntry(id) {
  const deleted = await CalendarEntry.findByIdAndDelete(id);
  return { success: !!deleted };
}

export async function approveEntries(ids) {
  await CalendarEntry.updateMany({ _id: { $in: ids } }, { status: 'approved' });
  return { updated: ids.length };
}
