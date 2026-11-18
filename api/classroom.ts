import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from 'firebase-admin/firestore';
import { randomUUID, createHash } from 'node:crypto';
import { adminServices, isAdmin } from '../server/firebase-admin.js';
import { requestSchema } from '../server/schema.js';
import { answerQuestion } from '../server/teacher.js';
import { guidedLessonLength, guidedLessonStep, nextGuidedState } from '../server/guided-lesson.mjs';
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
          tx.create(room, { title: 'My maths studio', subject: 'Mathematics', topic: 'Factorisation', grade: 10, status: 'scheduled', mode: 'practice', stage: 0, sequence: 0, memberCount: 1, createdAt: FieldValue.serverTimestamp(), createdBy: uid });
          tx.create(membership, { role: 'facilitator', joinedAt: FieldValue.serverTimestamp() });
        } else if (existing.get('createdBy') !== uid || existing.get('mode') !== 'practice') {
          throw new Error('Practice classroom unavailable.');
        }
      });
      return res.status(200).json({ roomId: room.id });
    }

    if (input.action === 'listChildren') {
      const snap = await store.collection('users').doc(uid).collection('children').limit(12).get();
      return res.status(200).json({ children: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
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
      batch.create(room, { title: 'Factorisation lab', subject: 'Mathematics', topic: 'Factorisation', grade: 10, status: 'scheduled', mode: 'shared', stage: 0, sequence: 0, memberCount: 1, createdAt: FieldValue.serverTimestamp(), createdBy: uid });
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
    const requiresFacilitator = ['start','step','pause','resume','restart','skipQuestion','skipExercise'].includes(input.action);
    if (requiresFacilitator && !(owner || (admin && !practice))) return res.status(403).json({ error: 'Only the classroom facilitator can control the lesson.' });
    if (input.action === 'restart') {
      if (!owner || !practice) return res.status(403).json({ error: 'Only the practice room owner can restart this lesson.' });
      await store.runTransaction(async tx => {
        const current = await tx.get(room);
        if (!current.exists) throw new Error('Classroom not found.');
        const sequence = (current.get('sequence') as number) + 1;
        if (sequence > EVENT_LIMIT) throw new Error('Classroom event limit reached.');
        tx.create(room.collection('events').doc(eventId(sequence)), { sequence, type: 'classroom_reset', payload: { status: 'scheduled' }, createdAt: FieldValue.serverTimestamp() });
        tx.update(room, { sequence, status: 'scheduled', stage: 0, epoch: (current.get('epoch') as number ?? 0) + 1, lease: null, leaseUntil: 0 });
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
      await store.runTransaction(async tx => {
        const current = await tx.get(room);
        if (!current.exists) throw new Error('Classroom not found.');
        if (current.get('status') !== 'scheduled') return; // idempotent double click
        const sequence = (current.get('sequence') as number ?? 0) + 1;
        if (sequence > EVENT_LIMIT) throw new Error('Classroom event limit reached.');
        const step = guidedLessonStep(0);
        tx.create(room.collection('events').doc(eventId(sequence)), {
          sequence, type: 'teacher_step', payload: { ...step, stage: 0, origin: 'guided' },
          createdAt: FieldValue.serverTimestamp()
        });
        tx.update(room, { sequence, stage: 1, status: 'teaching', epoch: current.get('epoch') ?? 0 });
      });
      return res.status(200).json({ status: 'teaching', started: true });
    }
    if (input.action === 'pause' || input.action === 'resume') {
      const status = input.action === 'pause' ? 'paused' : 'teaching';
      await store.runTransaction(async tx => {
        const current=await tx.get(room);
        const before=current.get('status') as string;
        if(input.action==='pause' && !['teaching','awaiting_answer'].includes(before))
          throw new Error('Pause is available during an active lesson.');
        if(input.action==='resume' && before!=='paused')
          throw new Error('The lesson is not paused.');
        const sequence = (current.get('sequence') as number) + 1;
        tx.create(room.collection('events').doc(eventId(sequence)), { sequence,type:'classroom_status',payload:{status},createdAt:FieldValue.serverTimestamp() });
        tx.update(room,{status,sequence, ...(input.action==='pause'?{previousStatus:before}:{previousStatus:null}) });
      });
      return res.status(200).json({ status });
    }
    if (input.action === 'skipQuestion') {
      const pending=await room.collection('questions').where('status','==','pending').limit(1).get();
      if(pending.empty)return res.status(200).json({skipped:false});
      await pending.docs[0].ref.update({status:'deferred'});
      await appendEvent('question_deferred',{ message:'The unanswered question was deferred. You can continue the lesson.' });
      return res.status(200).json({skipped:true});
    }
    if (input.action === 'skipExercise') {
      if(snap.get('status')!=='awaiting_answer')return res.status(409).json({error:'No exercise is awaiting an answer.'});
      await appendEvent('classroom_status',{status:'teaching'},'teaching');
      return res.status(200).json({status:'teaching'});
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
      const attempt = room.collection('attempts').doc(String(snap.get('epoch') ?? 0) + '_' + uid);
      const correct = checkFactorisation(input.answer);
      let tries = 0; let alreadyCorrect = false;
      await store.runTransaction(async tx => {
        const existing = await tx.get(attempt);
        tries = Number(existing.get('tries') ?? 0);
        alreadyCorrect = !!existing.get('correct');
        if (tries >= 3 || alreadyCorrect) return;
        tries++;
        tx.set(attempt, {uid, childId:member.get('childId')??null,answer:input.answer,correct,tries,
          createdAt:existing.get('createdAt')??FieldValue.serverTimestamp(),
          updatedAt:FieldValue.serverTimestamp()});
      });
      if(alreadyCorrect)return res.status(200).json({correct:true,feedback:'You already completed this exercise.'});
      if(tries >= 3 && !correct)return res.status(200).json({correct:false,feedback:'Three attempts used. Choose Show solution to continue.'});
      if(correct){
        await appendEvent('answer',{message:'An exercise answer was checked.'},'teaching');
      }
      return res.status(200).json({
        correct,
        feedback: correct
          ? 'Correct! Two plus three is five, and two times three is six.'
          : 'Not yet. Choose two numbers that multiply to six and add to five. ' + Math.max(0,3-tries) + ' attempt(s) remain.'
      });
    }
    if (input.action === 'step') {
      const lease = randomUUID();
      const now = Date.now();
      let stage = 0;
      await store.runTransaction(async tx => {
        const current = await tx.get(room);
        if (!current.exists) throw new Error('Classroom not found.');
        const state = current.data()!;
        if (state.status === 'awaiting_answer') throw new Error('Answer the exercise or show its solution first.');
        if (state.status !== 'teaching') throw new Error('Start or resume this lesson first.');
        if (state.leaseUntil && state.leaseUntil > now) throw new Error('A lesson step is already running.');
        stage = Number(state.stage ?? 0);
        if (stage >= guidedLessonLength) throw new Error('All lesson steps are complete.');
        tx.update(room, { lease, leaseUntil: now + 20_000 });
      });
      try {
        const waiting = await room.collection('questions').where('status','==','pending').limit(1).get();
        const pending=waiting.docs[0];
        // Only a real student question calls the model. Core lesson steps are instant and verified.
        const outcome = pending
          ? await answerQuestion(String(pending.get('question') ?? '').slice(0,400))
          : { step: guidedLessonStep(stage), usage:{ totalTokens:0 }, origin:'guided' as const };
        await store.runTransaction(async tx => {
          const current = await tx.get(room);
          if (!current.exists || current.get('lease') !== lease) throw new Error('Lesson controller lease expired.');
          const sequence = Number(current.get('sequence') ?? 0) + 1;
          if (sequence > EVENT_LIMIT) throw new Error('Classroom event limit reached.');
          const progress = pending
            ? { stage, status:'teaching' }
            : nextGuidedState(stage);
          tx.create(room.collection('events').doc(eventId(sequence)), {
            sequence, type:'teacher_step', payload:{ ...outcome.step, stage, origin:outcome.origin, answeredQuestion:!!pending },
            createdAt:FieldValue.serverTimestamp()
          });
          tx.update(room, {
            sequence,stage:progress.stage,status:progress.status,lease:null,leaseUntil:0,
            tokensUsed:FieldValue.increment((outcome.usage as {totalTokens?:number}).totalTokens ?? 0)
          });
          if(pending)tx.update(pending.ref,{status:'answered'});
        });
        return res.status(200).json({success:true,source:outcome.origin});
      } catch(err){
        await store.runTransaction(async tx => {
          const current=await tx.get(room);
          if(current.exists && current.get('lease')===lease)tx.update(room,{lease:null,leaseUntil:0});
        }).catch(()=>{});
        throw err;
      }
    }
    return res.status(400).json({ error: 'Unsupported action.' });
  } catch (error) {
    console.error('Classroom operation failed:', error);
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    const safe = /^(Authentication|Sign in|Administrator|Join this|Select a child|Room|Start|A lesson|All lesson|Classroom|AI teacher|No active|No exercise|Answer the exercise|Pause is|The lesson is|Only|This parent|You already|Question limit)/.test(message);
    return res.status(400).json({ error: safe ? message : 'Could not complete this action. Check server configuration and logs.' });
  }
}
