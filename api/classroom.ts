import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from 'firebase-admin/firestore';
import { randomUUID, createHash } from 'node:crypto';
import { adminServices, isAdmin } from '../server/firebase-admin.js';
import { requestSchema } from '../server/schema.js';
import { teach, totalStages } from '../server/teacher.js';
import { checkFactorisation } from '../server/assessment.mjs';

const EVENT_LIMIT = 250;
const classroomDoc = (store: ReturnType<typeof adminServices>['store'], id: string) => store.collection('classrooms').doc(id);
const noCache = { 'Cache-Control': 'no-store' };
const eventId = (sequence: number) => sequence.toString().padStart(8,'0');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', noCache['Cache-Control']);
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required.' });
  try {
    const { adminAuth, store } = adminServices();
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required.' });
    const user = await adminAuth.verifyIdToken(header.slice(7), true);
    const uid = user.uid;
    const admin = isAdmin(user);
    const input = requestSchema.parse(req.body);
    if (input.action === 'me') return res.status(200).json({ admin });

    if (input.action === 'list') {
      const [mine, shared] = await Promise.all([
        store.collection('classrooms').where('createdBy', '==', uid).limit(40).get(),
        store.collection('classrooms').where('mode', '==', 'shared').limit(40).get()
      ]);
      const rooms = new Map<string, Record<string, unknown>>();
      for (const doc of [...shared.docs, ...mine.docs]) rooms.set(doc.id, { id: doc.id, ...doc.data() });
      return res.status(200).json({ rooms: [...rooms.values()].sort((a,b) => {
        const aa = a.createdAt as { toMillis?: () => number } | undefined;
        const bb = b.createdAt as { toMillis?: () => number } | undefined;
        return (bb?.toMillis?.() ?? 0) - (aa?.toMillis?.() ?? 0);
      }) });
    }
    if (input.action === 'createPractice') {
      // Exactly one reusable practice room per account; no unbounded room creation.
      const id = 'practice-' + createHash('sha256').update(uid).digest('hex').slice(0,24);
      const room = store.collection('classrooms').doc(id);
      const membership = room.collection('members').doc(uid);
      await store.runTransaction(async tx => {
        const existing = await tx.get(room);
        if (!existing.exists) {
          tx.create(room, { title: 'My maths studio', subject: 'Mathematics', topic: 'Factorisation', grade: 10, status: 'scheduled', mode: 'practice', stage: 0, sequence: 0, memberCount: 1, mode: 'shared', createdAt: FieldValue.serverTimestamp(), createdBy: uid });
          tx.create(membership, { role: 'facilitator', joinedAt: FieldValue.serverTimestamp() });
        } else if (existing.get('createdBy') !== uid || existing.get('mode') !== 'practice') {
          throw new Error('Practice classroom unavailable.');
        }
      });
      return res.status(200).json({ roomId: room.id });
    }

    if (input.action === 'createChild') {
      const childCount = await store.collection('users').doc(uid).collection('children').count().get();
      if (childCount.data().count >= 12) return res.status(429).json({ error: 'Learner profile limit reached.' });
      const ref = store.collection('users').doc(uid).collection('children').doc();
      await ref.create({ firstName: input.firstName, grade: input.grade, createdAt: FieldValue.serverTimestamp() });
      return res.status(200).json({ childId: ref.id });
    }
    if (input.action === 'create') {
      if (!admin) return res.status(403).json({ error: 'Administrator access required.' });
      const room = store.collection('classrooms').doc();
      const batch = store.batch();
      batch.create(room, { title: 'Factorisation lab', subject: 'Mathematics', topic: 'Factorisation', grade: 10, status: 'scheduled', stage: 0, sequence: 0, memberCount: 1, createdAt: FieldValue.serverTimestamp(), createdBy: uid });
      batch.create(room.collection('members').doc(uid), { role: 'teacher', joinedAt: FieldValue.serverTimestamp() });
      await batch.commit();
      return res.status(200).json({ roomId: room.id });
    }
    const room = classroomDoc(store, input.roomId);
    const snap = await room.get();
    if (!snap.exists) return res.status(404).json({ error: 'Classroom not found.' });
    const membership = room.collection('members').doc(uid);
    const owner = snap.get('createdBy') === uid;
    const practice = snap.get('mode') === 'practice';
    if (practice && !owner) return res.status(403).json({ error: 'This is another account’s practice classroom.' });
    if (input.action === 'snapshot') {
      const member = await membership.get();
      const events = member.exists
        ? await room.collection('events').orderBy('sequence', 'asc').limit(EVENT_LIMIT).get()
        : null;
      return res.status(200).json({
        room: { id: room.id, ...snap.data() },
        joined: member.exists,
        events: events ? events.docs.map(d => ({ id: d.id, ...d.data() })) : []
      });
    }
    if (input.action === 'join') {
      if (!admin && !owner) {
        if (!input.childId) return res.status(400).json({ error: 'Select a child profile first.' });
        const child = await store.collection('users').doc(uid).collection('children').doc(input.childId).get();
        if (!child.exists) return res.status(403).json({ error: 'Child profile does not belong to this parent.' });
      }
      await store.runTransaction(async tx => {
        const roomState = await tx.get(room);
        const existing = await tx.get(membership);
        if (!roomState.exists) throw new Error('Room removed.');
        if (!existing.exists) {
          tx.create(membership, { role: (admin || owner) ? 'teacher' : 'learner', childId: input.childId ?? null, joinedAt: FieldValue.serverTimestamp() });
          tx.update(room, { memberCount: FieldValue.increment(1) });
        } else if (!admin && !owner && existing.get('childId') !== input.childId) {
          throw new Error('This parent joined with a different child profile.');
        }
      });
      return res.status(200).json({ joined: true });
    }
    const member = await membership.get();
    if (!member.exists) return res.status(403).json({ error: 'Join this classroom first.' });
    const requiresFacilitator = ['start','step','pause','resume','restart'].includes(input.action);
    if (requiresFacilitator && !(owner || (admin && !practice))) return res.status(403).json({ error: 'Only the classroom facilitator can control the lesson.' });
    if (input.action === 'restart') {
      if (!owner || !practice) return res.status(403).json({ error: 'Only the practice room owner can restart this lesson.' });
      await store.runTransaction(async tx => {
        const current = await tx.get(room);
        if (!current.exists) throw new Error('Classroom not found.');
        const sequence = (current.get('sequence') as number) + 1;
        if (sequence > EVENT_LIMIT) throw new Error('Classroom event limit reached.');
        tx.create(room.collection('events').doc(eventId(sequence)), { sequence, type: 'classroom_reset', payload: { status: 'scheduled' }, createdAt: FieldValue.serverTimestamp() });
        tx.update(room, { sequence, status: 'scheduled', stage: 0, lease: null, leaseUntil: 0 });
      });
      return res.status(200).json({ status: 'scheduled' });
    }

    async function appendEvent(type: string, payload: Record<string, unknown>, status?: string) {
      await store.runTransaction(async tx => {
        const current = await tx.get(room);
        if (!current.exists) throw new Error('Classroom no longer exists.');
        const sequence = (current.get('sequence') as number) + 1;
        if (sequence > EVENT_LIMIT) throw new Error('Classroom event limit reached.');
        tx.update(room, { sequence, ...(status ? { status } : {}) });
        tx.create(room.collection('events').doc(eventId(sequence)), { sequence, type, payload, createdAt: FieldValue.serverTimestamp() });
      });
    }
    if (input.action === 'start') {
      if (snap.get('status') !== 'scheduled') return res.status(409).json({ error: 'Room is already started.' });
      await appendEvent('classroom_status', { status: 'teaching' }, 'teaching');
      return res.status(200).json({ status: 'teaching' });
    }
    if (input.action === 'pause' || input.action === 'resume') {
      const status = input.action === 'pause' ? 'paused' : 'teaching';
      await appendEvent('classroom_status', { status }, status);
      return res.status(200).json({ status });
    }
    if (input.action === 'ask') {
      const count = await room.collection('questions').where('uid','==',uid).count().get();
      if (count.data().count >= 5) return res.status(429).json({ error: 'Question limit reached for this classroom.' });
      const doc = room.collection('questions').doc();
      await doc.create({ uid, question: input.question, status: 'pending', createdAt: FieldValue.serverTimestamp() });
      await appendEvent('question_asked', { question: input.question });
      return res.status(200).json({ queued: true });
    }
    if (input.action === 'raise') {
      await appendEvent('hand_raised', { message: 'A learner raised their hand.' });
      return res.status(200).json({ raised: true });
    }
    if (input.action === 'answer') {
      if (snap.get('status') !== 'awaiting_answer') return res.status(409).json({ error: 'No active exercise right now.' });
      const attempt = room.collection('attempts').doc(uid);
      const correct = checkFactorisation(input.answer);
      try { await attempt.create({ uid, childId: member.get('childId') ?? null, answer: input.answer, correct, createdAt: FieldValue.serverTimestamp() }); }
      catch (error) { if ((error as { code?: number }).code === 6) return res.status(409).json({ error: 'You already submitted an answer.' }); throw error; }
      await appendEvent('answer', { message: 'A learner submitted an exercise.' });
      return res.status(200).json({ correct, feedback: correct ? 'Correct! The two constants add to 5 and multiply to 6.' : 'Not quite. Look for two numbers that add to 5 and multiply to 6.' });
    }
    if (input.action === 'step') {
      const lease = randomUUID();
      const now = Date.now();
      let stage = 0;
      await store.runTransaction(async tx => {
        const current = await tx.get(room);
        const state = current.data()!;
        if (!['teaching','awaiting_answer'].includes(state.status)) throw new Error('Start or resume this lesson first.');
        if (state.leaseUntil && state.leaseUntil > now) throw new Error('A lesson step is already running.');
        stage = state.stage;
        if (stage >= totalStages && !state.pendingQuestion) throw new Error('All lesson steps are complete.');
        tx.update(room, { lease, leaseUntil: now + 45_000 });
      });
      try {
        const waiting = await room.collection('questions').orderBy('createdAt','asc').limit(25).get();
        const pending = waiting.docs.find(d => d.get('status') === 'pending');
        const { step, usage } = await teach(Math.min(stage, totalStages - 1), pending?.get('question') as string | undefined);
        await store.runTransaction(async tx => {
          const current = await tx.get(room);
          if (!current.exists || current.get('lease') !== lease) throw new Error('Lesson controller lease expired.');
          const sequence = (current.get('sequence') as number) + 1;
          if (sequence > EVENT_LIMIT) throw new Error('Classroom event limit reached.');
          const nextStage = pending ? stage : Math.min(stage + 1, totalStages);
          const status = pending ? current.get('status') as string : stage === 3 ? 'awaiting_answer' : nextStage >= totalStages ? 'completed' : 'teaching';
          tx.create(room.collection('events').doc(eventId(sequence)), { sequence, type: 'teacher_step', payload: { ...step, stage, answeredQuestion: !!pending }, createdAt: FieldValue.serverTimestamp() });
          tx.update(room, { sequence, status, stage: nextStage, lease: null, leaseUntil: 0, tokensUsed: FieldValue.increment((usage as {totalTokens?:number}).totalTokens ?? 0) });
          if (pending) tx.update(pending.ref, { status: 'answered' });
        });
        return res.status(200).json({ success: true });
      } catch (err) {
        await store.runTransaction(async tx => {
          const current = await tx.get(room);
          if (current.exists && current.get('lease') === lease) tx.update(room, { lease: null, leaseUntil: 0 });
        }).catch(() => {});
        throw err;
      }
    }
    return res.status(400).json({ error: 'Unsupported action.' });
  } catch (error) {
    console.error('Classroom operation failed:', error);
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    const safe = /^(Authentication|Sign in|Administrator|Join this|Select a child|Room|Start|A lesson|All lesson|Classroom|Teaching engine|No active|This parent|You already|Question limit)/.test(message);
    return res.status(400).json({ error: safe ? message : 'Could not complete this action. Check server configuration and logs.' });
  }
}
