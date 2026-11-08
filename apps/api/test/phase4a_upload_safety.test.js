import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { Person } from '../src/modules/people/model.js';
import { MediaItem } from '../src/modules/media/model.js';
import { ContentPiece } from '../src/modules/calendar/contentPiece.model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { Channel } from '../src/modules/chat/channel.model.js';
import { ChannelMember } from '../src/modules/chat/channelMember.model.js';
import { ChatMessage } from '../src/modules/chat/chatMessage.model.js';
import { ShareGrant } from '../src/modules/chat/shareGrant.model.js';
import { ensureTeamChatChannel } from '../src/modules/chat/service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS = path.resolve(__dirname, '../uploads');
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

const tokenFor = (user) =>
  jwt.sign({ userId: user._id.toString(), role: user.role, name: user.name }, env.JWT_SECRET, { expiresIn: '1h' });

const listUploads = () => new Set(fs.readdirSync(UPLOADS));

describe('Phase 4a: upload safety', () => {
  const salt = `p4a-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  let head, admin, member, outsider;
  let headToken, adminToken, memberToken, outsiderToken;
  let teamChannel, group, otherGroup;
  const createdFiles = [];
  const createdDirs = [];

  const track = (url) => {
    if (!url) return;
    const rel = url.replace(/^\/uploads\//, '');
    createdFiles.push(path.join(UPLOADS, rel));
    if (rel.startsWith('chat/')) createdDirs.push(path.dirname(path.join(UPLOADS, rel)));
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(env.MONGODB_URI);
    fs.mkdirSync(UPLOADS, { recursive: true });
    const make = (name, role) =>
      Person.create({ name, email: `${name.toLowerCase().replace(/\s/g, '.')}.${salt}@p4a.test`, role, status: 'active' });
    head = await make('P4a Head', 'creative_head');
    admin = await make('P4a Admin', 'admin');
    member = await make('P4a Member', 'team_member');
    outsider = await make('P4a Outsider', 'team_member');
    headToken = tokenFor(head);
    adminToken = tokenFor(admin);
    memberToken = tokenFor(member);
    outsiderToken = tokenFor(outsider);
    teamChannel = await ensureTeamChatChannel();
    group = await Channel.create({ name: `P4a group ${salt}`, type: 'group', createdById: head._id });
    otherGroup = await Channel.create({ name: `P4a other ${salt}`, type: 'group', createdById: head._id });
    await ChannelMember.create([
      { channelId: group._id, userId: head._id, role: 'owner' },
      { channelId: group._id, userId: member._id, role: 'member' },
      { channelId: otherGroup._id, userId: member._id, role: 'member' },
    ]);
  });

  afterAll(async () => {
    for (const f of createdFiles) {
      try { fs.unlinkSync(f); } catch {}
    }
    for (const d of createdDirs) {
      try { fs.rmSync(d, { recursive: true, force: true }); } catch {}
    }
    for (const c of [group, otherGroup]) {
      try { fs.rmSync(path.join(UPLOADS, 'chat', String(c._id)), { recursive: true, force: true }); } catch {}
    }
    const ids = [head, admin, member, outsider].map((p) => p._id);
    await ChatMessage.deleteMany({ authorId: { $in: ids } });
    await ShareGrant.deleteMany({ sharedById: { $in: ids } });
    await ChannelMember.deleteMany({ channelId: { $in: [group._id, otherGroup._id] } });
    await Channel.deleteMany({ _id: { $in: [group._id, otherGroup._id] } });
    await MediaItem.deleteMany({ title: new RegExp(salt) });
    await ContentPiece.deleteMany({ topic: new RegExp(salt) });
    await WorkItem.deleteMany({ title: new RegExp(salt) });
    await ChannelMember.deleteMany({ userId: { $in: ids } });
    await Person.deleteMany({ _id: { $in: ids } });
  });

  describe('general upload route', () => {
    const rejected = [
      ['page.html', 'text/html'],
      ['vector.svg', 'image/svg+xml'],
      ['script.js', 'application/javascript'],
      ['tool.exe', 'application/octet-stream'],
      ['looks.png', 'text/html'],
      ['page.html', 'image/png'],
      ['notes.txt', 'text/plain'],
    ];
    for (const [name, type] of rejected) {
      it(`rejects ${name} sent as ${type} and stores nothing`, async () => {
        const before = listUploads();
        const res = await request(app)
          .post('/api/uploads/file')
          .set('Authorization', `Bearer ${outsiderToken}`)
          .attach('file', Buffer.from('<script>1</script>'), { filename: name, contentType: type });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('FILE_TYPE_NOT_ALLOWED');
        const added = [...listUploads()].filter((f) => !before.has(f));
        expect(added).toEqual([]);
      });
    }

    for (const [name, type, kind, ext] of [
      ['Clip One.mp4', 'video/mp4', 'video', '.mp4'],
      ['frame.png', 'image/png', 'image', '.png'],
      ['photo.JPEG', 'image/jpeg', 'image', '.jpg'],
      ['brief.pdf', 'application/pdf', 'pdf', '.pdf'],
    ]) {
      it(`accepts ${name} and stores it under a random name with ${ext}`, async () => {
        const res = await request(app)
          .post('/api/uploads/file')
          .set('Authorization', `Bearer ${outsiderToken}`)
          .attach('file', Buffer.from('DATA'), { filename: name, contentType: type });
        expect(res.status).toBe(201);
        track(res.body.data.url);
        expect(res.body.data.url).toMatch(new RegExp(`^/uploads/${UUID}\\${ext}$`));
        expect(res.body.data.kind).toBe(kind);
        expect(res.body.data.fileName).toBe(name);
      });
    }

    it('ignores a requested kind that does not match the file', async () => {
      const res = await request(app)
        .post('/api/uploads/file')
        .set('Authorization', `Bearer ${outsiderToken}`)
        .field('kind', 'video')
        .attach('file', Buffer.from('PNG'), { filename: 'still.png', contentType: 'image/png' });
      expect(res.status).toBe(201);
      track(res.body.data.url);
      expect(res.body.data.kind).toBe('image');
    });
  });

  describe('avatars', () => {
    for (const [name, type] of [
      ['avatar.html', 'image/png'],
      ['avatar.png', 'text/html'],
      ['avatar.svg', 'image/svg+xml'],
      ['avatar.pdf', 'application/pdf'],
    ]) {
      it(`rejects ${name} sent as ${type}`, async () => {
        const before = listUploads();
        const res = await request(app)
          .post('/api/me/avatar')
          .set('Authorization', `Bearer ${outsiderToken}`)
          .attach('avatar', Buffer.from('<script>1</script>'), { filename: name, contentType: type });
        expect(res.status).toBe(400);
        expect([...listUploads()].filter((f) => !before.has(f))).toEqual([]);
      });
    }

    it('stores an image avatar under a random name with its own extension', async () => {
      const res = await request(app)
        .post('/api/me/avatar')
        .set('Authorization', `Bearer ${outsiderToken}`)
        .attach('avatar', Buffer.from('PNG'), { filename: 'Me & My Cat.webp', contentType: 'image/webp' });
      expect(res.status).toBe(200);
      track(res.body.data.avatarUrl);
      expect(res.body.data.avatarUrl).toMatch(new RegExp(`^/uploads/avatar-${UUID}\\.webp$`));
    });
  });

  describe('serving /uploads', () => {
    const place = (name, content = 'X') => {
      fs.writeFileSync(path.join(UPLOADS, name), content);
      createdFiles.push(path.join(UPLOADS, name));
      return `/uploads/${name}`;
    };

    it('serves images and video inline, sandboxed and nosniff', async () => {
      for (const url of [place(`${salt}-a.png`), place(`${salt}-a.mp4`, Buffer.alloc(2048, 1))]) {
        const res = await request(app).get(url);
        expect(res.status).toBe(200);
        expect(res.headers['content-security-policy']).toBe('sandbox');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['content-disposition']).toBeUndefined();
      }
    });

    it('keeps range requests working for video', async () => {
      const url = place(`${salt}-range.mp4`, Buffer.alloc(4096, 2));
      const res = await request(app).get(url).set('Range', 'bytes=0-99');
      expect(res.status).toBe(206);
      expect(res.headers['content-range']).toBe('bytes 0-99/4096');
      expect(res.headers['content-security-policy']).toBe('sandbox');
    });

    it('downloads anything that is not media, including old HTML or SVG already on disk', async () => {
      for (const [name, prefix] of [[`${salt}-doc.pdf`, '/uploads/'], [`${salt}-old.html`, '/uploads/'], [`${salt}-old.svg`, '/api/uploads/files/']]) {
        place(name, '<script>document.title="RAN"</script>');
        const res = await request(app).get(`${prefix}${name}`);
        expect(res.status).toBe(200);
        expect(res.headers['content-disposition']).toMatch(/^attachment;/);
        expect(res.headers['content-security-policy']).toBe('sandbox');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
      }
    });

    it('still refuses path traversal', async () => {
      for (const p of ['/uploads/..%2fpackage.json', '/uploads/%2e%2e/%2e%2e/package.json', '/uploads/..%5c..%5cpackage.json']) {
        const res = await request(app).get(p);
        expect(res.status).toBe(404);
      }
    });
  });

  describe('chat uploads', () => {
    const upload = (token, query, name = 'note.txt', type = 'text/plain') =>
      request(app)
        .post(`/api/chat/upload${query}`)
        .set('Authorization', `Bearer ${token}`)
        .attach('files', Buffer.from('CHAT FILE'), { filename: name, contentType: type });

    it('requires a valid channel id and writes nothing for a bad one', async () => {
      const escaped = path.resolve(UPLOADS, '..', 'escaped');
      for (const q of ['', '?channelId=..%2F..%2Fescaped', '?channelId=general', '?channelId=123']) {
        const res = await upload(memberToken, q);
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('INVALID_CHANNEL_ID');
      }
      expect(fs.existsSync(escaped)).toBe(false);
    });

    it('requires membership of a private channel', async () => {
      const res = await upload(outsiderToken, `?channelId=${group._id}`);
      expect(res.status).toBe(403);
      expect(fs.existsSync(path.join(UPLOADS, 'chat', String(group._id)))).toBe(false);
    });

    it('returns 404 for a channel that does not exist', async () => {
      const res = await upload(memberToken, `?channelId=${new mongoose.Types.ObjectId()}`);
      expect(res.status).toBe(404);
    });

    it('lets a member upload into their channel folder', async () => {
      const res = await upload(memberToken, `?channelId=${group._id}`, 'My Notes.txt');
      expect(res.status).toBe(201);
      const url = res.body.attachments[0].storageUrl;
      track(url);
      expect(url).toMatch(new RegExp(`^/uploads/chat/${group._id}/${UUID}/My_Notes\\.txt$`));
    });

    it('rejects a disallowed chat file type with 400, not a server error', async () => {
      const res = await upload(memberToken, `?channelId=${group._id}`, 'page.html', 'text/html');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('FILE_TYPE_NOT_ALLOWED');
    });
  });

  describe('chat messages', () => {
    let realUrl;
    let otherChannelUrl;

    beforeAll(async () => {
      const a = await request(app)
        .post(`/api/chat/upload?channelId=${group._id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .attach('files', Buffer.alloc(1234, 3), { filename: 'cut.mp4', contentType: 'video/mp4' });
      realUrl = a.body.attachments[0].storageUrl;
      track(realUrl);
      const b = await request(app)
        .post(`/api/chat/upload?channelId=${otherGroup._id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .attach('files', Buffer.from('OTHER'), { filename: 'other.txt', contentType: 'text/plain' });
      otherChannelUrl = b.body.attachments[0].storageUrl;
      track(otherChannelUrl);
    });

    const send = (body) =>
      request(app).post(`/api/chat/channels/${group._id}/messages`).set('Authorization', `Bearer ${memberToken}`).send(body);

    it('rejects attachment links that are not files uploaded to this channel', async () => {
      for (const storageUrl of [
        'javascript:document.title="RAN"',
        'data:text/html,<script>1</script>',
        'https://evil.example/x.mp4',
        '/uploads/someone-elses-cut.mp4',
        otherChannelUrl,
        `/uploads/chat/${group._id}/../../x.txt`,
        realUrl.replace('cut.mp4', 'missing.mp4'),
      ]) {
        const res = await send({ content: 'x', attachments: [{ fileName: 'a.pdf', fileSize: 1, mimeType: 'application/pdf', storageUrl }] });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('INVALID_ATTACHMENT');
      }
    });

    it('builds name, size and type from the file on disk, not from the client', async () => {
      const res = await send({
        content: '',
        attachments: [{ fileName: 'evil.html', fileSize: 1, mimeType: 'text/html', storageUrl: realUrl }],
      });
      expect(res.status).toBe(201);
      const [att] = res.body.message.attachments;
      expect(att).toMatchObject({ fileName: 'cut.mp4', fileSize: 1234, mimeType: 'video/mp4', storageUrl: realUrl });
    });

    it('ignores a share card sent by the client', async () => {
      const res = await send({
        content: 'look',
        sharedMedia: {
          grantId: new mongoose.Types.ObjectId().toString(),
          assetId: new mongoose.Types.ObjectId().toString(),
          contentPieceId: new mongoose.Types.ObjectId().toString(),
          contentPieceTitle: 'x',
          assetType: 'clip',
          stageKey: 'Shoot',
          title: 'FORGED_SHARE',
          downloadUrl: 'javascript:document.title="RAN"',
          owner: { name: 'Creative Head' },
        },
      });
      expect(res.status).toBe(201);
      expect(res.body.message.kind).toBe('text');
      expect(res.body.message.sharedMedia ?? null).toBeNull();
      const stored = await ChatMessage.findById(res.body.message._id).lean();
      expect(stored.sharedMedia ?? null).toBeNull();
    });
  });

  describe('share-to-chat links', () => {
    it('drops a share card link that is not http(s) or a site path', async () => {
      const step = await WorkItem.create({
        title: `P4a shoot ${salt}`,
        workType: 'Reel',
        status: 'Approved',
        stageKey: 'Shoot',
        stageOrder: 2,
        departmentId: new mongoose.Types.ObjectId(),
        ownerId: member._id,
        deadline: new Date(Date.now() + 86400000),
        estimatedEffortHrs: 1,
      });
      const piece = await ContentPiece.create({
        planId: new mongoose.Types.ObjectId(),
        topic: `P4a piece ${salt}`,
        contentType: 'Reel',
        pipeline: 'reel_a',
        postingDate: new Date(Date.now() + 5 * 86400000),
        status: 'In Progress',
      });
      const clip = await MediaItem.create({
        stageItemId: step._id,
        contentPieceId: piece._id,
        uploadedBy: member._id,
        kind: 'video',
        title: `P4a clip ${salt}`,
        url: 'javascript:document.title="RAN"',
        thumbnailUrl: 'data:image/svg+xml,<svg onload=alert(1)>',
        sizeBytes: 10,
        status: 'approved',
      });
      const res = await request(app)
        .post('/api/chat/share')
        .set('Authorization', `Bearer ${headToken}`)
        .send({ channelId: teamChannel._id.toString(), assetId: clip._id.toString(), assetType: 'clip' });
      expect(res.status).toBeLessThan(300);
      const grant = await ShareGrant.findOne({ assetId: clip._id.toString() }).lean();
      const msg = await ChatMessage.findOne({ 'sharedMedia.grantId': grant._id }).lean();
      expect(msg.sharedMedia.previewUrl || '').toBe('');
      expect(msg.sharedMedia.downloadUrl || '').toBe('');
      expect(msg.sharedMedia.thumbnailUrl || '').toBe('');
      const access = await request(app).get(`/api/chat/shared-asset/${grant._id}`).set('Authorization', `Bearer ${adminToken}`);
      expect(access.status).toBe(200);
      expect(JSON.stringify(access.body)).not.toMatch(/javascript:|data:image/);
    });
  });

  describe('report HTML', () => {
    it('escapes work-item text in report HTML', async () => {
      await WorkItem.create({
        title: `<img src=x onerror=alert(1)>${salt}`,
        workType: 'Reel',
        status: 'In Progress',
        stageKey: 'Edit',
        stageOrder: 3,
        departmentId: new mongoose.Types.ObjectId(),
        ownerId: member._id,
        deadline: new Date(Date.now() + 2 * 86400000),
        estimatedEffortHrs: 1,
      });
      // Phase 7: reports are JSON only (no HTML report); the topic comes back as plain text.
      const res = await request(app).get('/api/reports/view/weekly_marketing').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
      const html = await request(app).get('/api/reports/export?format=html').set('Authorization', `Bearer ${adminToken}`);
      expect(html.status).toBe(404);
    });
  });
});
