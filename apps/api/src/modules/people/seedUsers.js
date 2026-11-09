/**
 * The 12 local test users (Phase 9). No passwords here: each password comes from the
 * git-ignored apps/api/.env as SEED_PASSWORD_<KEY>. Used only by scripts/reset-and-seed.js;
 * the app never creates or rewrites these users at startup.
 */
export const SEED_USERS = [
  { key: 'CREATIVEHEAD', name: 'Test Creative Head', email: 'creativehead@demo.haca.local', phone: '9000000001', role: 'creative_head', jobRole: 'Creative Manager (TL)', departmentCode: 'design', workPreferences: [], capacity: 40 },
  { key: 'SMMANAGER', name: 'Test SM Manager', email: 'smmanager@demo.haca.local', phone: '9000000002', role: 'sm_manager', jobRole: 'Social Media Manager', departmentCode: 'social_media', workPreferences: [], capacity: 40 },
  { key: 'EXECUTIVE', name: 'Test Executive', email: 'executive@demo.haca.local', phone: '9000000003', role: 'executive', jobRole: '', departmentCode: null, workPreferences: [], capacity: 0 },
  { key: 'WRITER1', name: 'Test Writer One', email: 'writer1@demo.haca.local', phone: '9000000011', role: 'team_member', jobRole: 'Writer', departmentCode: 'seo_content', workPreferences: ['Content', 'Script'], capacity: 40 },
  { key: 'WRITER2', name: 'Test Writer Two', email: 'writer2@demo.haca.local', phone: '9000000012', role: 'team_member', jobRole: 'Writer', departmentCode: 'seo_content', workPreferences: ['Content', 'Script'], capacity: 40 },
  { key: 'DESIGNER1', name: 'Test Designer One', email: 'designer1@demo.haca.local', phone: '9000000013', role: 'team_member', jobRole: 'Designer', departmentCode: 'design', workPreferences: ['Design'], capacity: 40 },
  { key: 'DESIGNER2', name: 'Test Designer Two', email: 'designer2@demo.haca.local', phone: '9000000014', role: 'team_member', jobRole: 'Designer', departmentCode: 'design', workPreferences: ['Design'], capacity: 40 },
  { key: 'SHOOTER', name: 'Test Shooter', email: 'shooter@demo.haca.local', phone: '9000000015', role: 'team_member', jobRole: 'Videographer', departmentCode: 'video_production', workPreferences: ['Shoot'], capacity: 40 },
  { key: 'EDITOR1', name: 'Test Editor One', email: 'editor1@demo.haca.local', phone: '9000000016', role: 'team_member', jobRole: 'Video Editor', departmentCode: 'video_production', workPreferences: ['Edit'], capacity: 40 },
  { key: 'EDITOR2', name: 'Test Editor Two', email: 'editor2@demo.haca.local', phone: '9000000017', role: 'team_member', jobRole: 'Video Editor', departmentCode: 'video_production', workPreferences: ['Edit'], capacity: 40 },
  { key: 'POSTER', name: 'Test Poster', email: 'poster@demo.haca.local', phone: '9000000018', role: 'team_member', jobRole: 'Social Specialist', departmentCode: 'social_media', workPreferences: ['Post'], capacity: 40 },
  { key: 'ALLROUNDER', name: 'Test All Rounder', email: 'allrounder@demo.haca.local', phone: '9000000019', role: 'team_member', jobRole: 'Social Specialist', departmentCode: 'social_media', workPreferences: ['Script', 'Shoot', 'Post'], capacity: 40 },
];

export const seedPasswordVar = (user) => `SEED_PASSWORD_${user.key}`;

/** The env variable names the reset script needs, and which of them are missing. */
export function missingSeedPasswords(source = process.env) {
  return SEED_USERS.map(seedPasswordVar).filter((name) => !source[name] || String(source[name]).length < 8);
}
