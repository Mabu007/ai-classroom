import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as React from 'react';
import type { User } from 'firebase/auth';
import { createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { BookOpen, Brain, ArrowRight, ChevronRight, GraduationCap, Users, CalendarDays, Sparkles, Volume2, VolumeX, Mic, MessageCircle, Hand, Play, Pause, Send, CheckCircle2, AlertCircle, Plus, LogOut, Menu, X, ShieldCheck, Clock3, Zap, LayoutDashboard, ChevronLeft, Maximize2, Minimize2, Grid3X3, HelpCircle } from 'lucide-react';
import katex from 'katex';
import { auth, configured, db } from './lib/firebase';
import { classroomApi } from './lib/api';
import { speak, stopSpeech } from './lib/voice';
import type { ClassroomEvent, Child, Room, TeacherStep } from './lib/types';
const Whiteboard = lazy(() => import('./components/Whiteboard'));


type Page = 'home' | 'dashboard' | 'room' | 'admin';
function route(): { page: Page; roomId?: string } {
  const pathname = window.location.pathname;
  if (pathname.startsWith('/classroom/')) return { page: 'room', roomId: pathname.split('/')[2] };
  if (pathname === '/admin') return { page: 'admin' };
  if (pathname === '/dashboard') return { page: 'dashboard' };
  return { page: 'home' };
}
function Logo() { return <div className="brand"><span className="brand-icon"><BookOpen size={21} strokeWidth={2.5}/></span><span>AI<span className="brand-strong">Classroom</span></span></div>; }
function Btn({ children, onClick, variant = 'primary', disabled = false, className = '' }: { children: React.ReactNode; onClick: () => void; variant?: 'primary' | 'secondary' | 'ghost'; disabled?: boolean; className?: string }) { return <button className={`btn ${variant} ${className}`} onClick={onClick} disabled={disabled}>{children}</button>; }
function Banner({ message, type = 'error', onClose }: {message: string; type?: 'error'|'info'; onClose?: () => void}) { return <div className={`notice ${type}`}><AlertCircle size={17}/><span>{message}</span>{onClose && <button onClick={onClose} aria-label="Dismiss"><X size={16}/></button>}</div>; }


function authErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error
    ? String((error as { code: unknown }).code) : '';
  switch (code) {
    case 'auth/email-already-in-use': return 'This email already has an account. Please sign in instead.';
    case 'auth/invalid-email': return 'Enter a valid email address.';
    case 'auth/weak-password': return 'Choose a stronger password (at least 6 characters).';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found': return 'Incorrect email or password. Please try again.';
    case 'auth/operation-not-allowed': return 'Email/password sign-in must be enabled in Firebase Authentication.';
    case 'auth/unauthorized-domain': return 'This website must be added to Firebase Authentication authorized domains.';
    case 'auth/network-request-failed': return 'Network error. Check your connection and try again.';
    case 'auth/too-many-requests': return 'Too many attempts. Please try again later.';
    default: return 'Unable to complete this request. Please try again.';
  }
}

function AuthScreen() {
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [info, setInfo] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(''); setInfo('');
    try { if (register) await createUserWithEmailAndPassword(auth, email, password); else await signInWithEmailAndPassword(auth, email, password); }
    catch(err) { setError(authErrorMessage(err)); }
    finally { setLoading(false); }
  }

  async function resetPassword() {
    setError(''); setInfo('');
    if (!email.trim()) { setError('Enter your email address above before resetting your password.'); return; }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo('If this email has an account, you will receive a password-reset link.');
    } catch (err) { setError(authErrorMessage(err)); }
    finally { setLoading(false); }
  }
  return <div className="public-site"><header className="public-nav shell"><Logo/><span className="nav-note"><span className="online-dot"/> A new way to learn</span></header>
    <div className="hero shell"><div className="hero-copy"><div className="eyebrow"><Sparkles size={15}/> THE FUTURE OF LEARNING IS HERE</div><h1>A classroom that <em>comes alive.</em></h1><p>Meet your AI teacher. Watch lessons unfold on a live whiteboard, ask questions in real time, and discover what you’re capable of.</p><div className="hero-features"><span><CheckCircle2 size={17}/> Interactive lessons</span><span><CheckCircle2 size={17}/> Learn together</span><span><CheckCircle2 size={17}/> Personal guidance</span></div><div className="hero-testimonial">Designed for Grade 10 Mathematics. Built for curious minds.</div></div>
      <div className="auth-card"><div className="auth-overline"><span className="feature-icon"><GraduationCap size={22}/></span><span>YOUR LEARNING JOURNEY</span></div><h2>{register ? 'Create your account' : 'Welcome to class'}</h2><p>{register ? 'Parents and guardians can create an account and manage learner profiles.' : 'Sign in to join your next interactive lesson.'}</p>{!configured && <Banner message="Firebase is not configured yet. Add the VITE_FIREBASE_* environment variables."/>}{error && <Banner message={error} onClose={() => setError('')}/>}{info && <Banner type="info" message={info} onClose={() => setInfo('')}/>}
        <form onSubmit={submit}><label>Email address<input type="email" placeholder="you@example.com" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)}/></label><label>Password<input type="password" minLength={6} placeholder="Enter your password" autoComplete={register ? 'new-password' : 'current-password'} required value={password} onChange={e=>setPassword(e.target.value)}/></label><button type="submit" className="btn primary full" disabled={!configured||loading}>{loading ? 'Please wait…' : register ? 'Create account' : 'Enter classroom'} <ArrowRight size={17}/></button></form><div className="auth-switch">{register ? 'Already have an account?' : 'New here?'} <button onClick={() => {setRegister(!register);setError('');}}>{register ? 'Sign in' : 'Create an account'}</button></div>{!register && <div className="auth-switch"><button type="button" onClick={() => void resetPassword()} disabled={loading}>Forgot password?</button></div>}<div className="auth-footer"><ShieldCheck size={16}/> A safe, parent-managed learning environment</div></div>
    </div><section className="feature-strip shell"><div><span><Users size={21}/></span><strong>One shared classroom</strong><small>Learn together in real time</small></div><div><span><Brain size={21}/></span><strong>Intelligent explanations</strong><small>Ask when you need help</small></div><div><span><BookOpen size={21}/></span><strong>See ideas take shape</strong><small>Interactive visual learning</small></div></section></div>;
}

function useRooms(uid?: string) {
  const [rooms, setRooms] = useState<Room[]>([]);
  useEffect(() => {
    if (!uid) { setRooms([]); return; }
    let active = true;
    let owned: Room[] = []; let shared: Room[] = [];
    let fallback = false;
    function publish() {
      const found = new Map<string, Room>();
      [...shared, ...owned].forEach(room => { if(room.mode !== 'practice' || room.createdBy === uid) found.set(room.id,room); });
      if(active) setRooms([...found.values()]);
    }
    async function fetchRooms() {
      try {
        const result = await classroomApi<{rooms:Room[]}>('list');
        if(active && (fallback || (!owned.length && !shared.length))) setRooms(result.rooms);
      } catch { /* Server not ready; keep the last visible list. */ }
    }
    const mine = onSnapshot(query(collection(db,'classrooms'),where('createdBy','==',uid)),snapshot=>{
      owned = snapshot.docs.map(d=>({...d.data(),id:d.id} as Room));publish();
    },()=>{fallback=true;void fetchRooms();});
    const publicRooms = onSnapshot(query(collection(db,'classrooms'),where('mode','==','shared')),snapshot=>{
      shared = snapshot.docs.map(d=>({...d.data(),id:d.id} as Room));publish();
    },()=>{fallback=true;void fetchRooms();});
    void fetchRooms();
    const timer=window.setInterval(()=>{if(fallback)void fetchRooms();},20000);
    return ()=>{active=false;mine();publicRooms();window.clearInterval(timer);};
  },[uid]);
  return rooms;
}


function useChildren(uid: string) {
  const [children, setChildren] = useState<Child[]>([]);
  useEffect(() => {
    if (!uid) { setChildren([]); return; }
    let active = true;
    let fallback = false;
    async function fromServer() {
      try {
        const data = await classroomApi<{children:Child[]}>('listChildren');
        if(active) setChildren(data.children);
      } catch { /* Remain on the last known learner list. */ }
    }
    const unsubscribe = onSnapshot(collection(db,'users',uid,'children'),
      snapshot => { if(active)setChildren(snapshot.docs.map(d=>({...d.data(),id:d.id} as Child))); },
      () => {fallback=true;void fromServer();});
    void fromServer();
    const refresh = () => {void fromServer();};
    window.addEventListener('ai-classroom-children-change', refresh);
    const timer = window.setInterval(() => {if(fallback)void fromServer();},20000);
    return () => {active=false;unsubscribe();window.removeEventListener('ai-classroom-children-change', refresh);window.clearInterval(timer);};
  },[uid]);
  return children;
}

function Classroom({ roomId, admin, childId, back }: { roomId: string; admin: boolean; childId: string; back: () => void }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [events, setEvents] = useState<ClassroomEvent[]>([]);
  const [joined, setJoined] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [fallback, setFallback] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [notice, setNotice] = useState('');
  const [muted, setMuted] = useState(false);
  const [panel, setPanel] = useState<'closed' | 'chat' | 'activity' | 'help'>('closed');
  const [grid, setGrid] = useState(false);
  const [focus, setFocus] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const latestSeen = useRef<number | null>(null);
  const studioRef = useRef<HTMLDivElement | null>(null);
  const questionRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    const data = await classroomApi<{ room: Room; joined: boolean; events: ClassroomEvent[] }>('snapshot', { roomId });
    setRoom(data.room);
    setJoined(data.joined);
    setEvents(data.events);
    setLoading(false);
    return data;
  }, [roomId]);

  useEffect(() => {
    let active = true;
    latestSeen.current = null;
    setRoom(null); setJoined(null); setEvents([]); setLoading(true); setFallback(false); setError('');
    void refresh().catch(e => {
      if (!active) return;
      setLoading(false);
      setError(e instanceof Error ? e.message : 'Unable to load classroom.');
    });
    const unsubscribeRoom = onSnapshot(doc(db, 'classrooms', roomId),
      snapshot => {
        if (!active) return;
        if (snapshot.exists()) { setRoom({ ...snapshot.data(), id: snapshot.id } as Room); setLoading(false); }
      },
      () => { if (active) setFallback(true); });
    const unsubscribeMember = onSnapshot(doc(db, 'classrooms', roomId, 'members', auth.currentUser!.uid),
      snapshot => { if (active) setJoined(snapshot.exists()); },
      () => { if (active) setFallback(true); });
    return () => { active = false; unsubscribeRoom(); unsubscribeMember(); stopSpeech(); };
  }, [refresh, roomId]);

  useEffect(() => {
    if (!joined) return;
    return onSnapshot(query(collection(db, 'classrooms', roomId, 'events'), orderBy('sequence')),
      snapshot => setEvents(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as ClassroomEvent))),
      () => setFallback(true));
  }, [roomId, joined]);

  useEffect(() => {
    if (!fallback) return;
    const timer = window.setInterval(() => { void refresh().catch(() => {}); }, 5000);
    return () => window.clearInterval(timer);
  }, [fallback, refresh]);

  useEffect(() => {
    const last = events.at(-1)?.sequence ?? 0;
    if (latestSeen.current !== null && last > latestSeen.current && !muted) {
      const fresh = events.filter(e => e.sequence > latestSeen.current! && e.type === 'teacher_step');
      const newest = fresh.at(-1);
      if (newest?.payload.speech) speak(String(newest.payload.speech));
    }
    latestSeen.current = last;
  }, [events, muted]);

  useEffect(() => {
    function onFullscreenChange() { setFullscreen(!!document.fullscreenElement); }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const resetSequence = useMemo(() => events.filter(e => e.type === 'classroom_reset').at(-1)?.sequence ?? 0, [events]);
  const teacherEvents = useMemo(() => events.filter(e => e.sequence > resetSequence && e.type === 'teacher_step'), [events, resetSequence]);
  const lastStep = teacherEvents.at(-1)?.payload as unknown as TeacherStep | undefined;
  const canControl = !!room && (admin || room.createdBy === auth.currentUser?.uid);
  const progress = Math.max(0, Math.min(100, Math.round(((room?.stage ?? 0) / 5) * 100)));

  const doAction = useCallback(async (action: string, args: Record<string, unknown> = {}) => {
    setBusy(action); setError(''); setNotice('');
    try {
      const result = await classroomApi<{ feedback?: string }>(action, { roomId, ...args });
      if (action === 'ask') { setQuestion(''); setNotice('Question added to the teacher queue.'); }
      if (action === 'raise') setNotice('Hand raised. Your teacher has been notified.');
      if (action === 'answer') setFeedback(result.feedback ?? 'Your answer has been recorded.');
      if (action === 'restart') { stopSpeech(); setFeedback(''); latestSeen.current = null; }
      await refresh();
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to complete this action.');
      return undefined;
    } finally {
      setBusy('');
    }
  }, [roomId, refresh]);

  function replay() { if (lastStep?.speech) { setMuted(false); speak(lastStep.speech); } }
  function showQuestions() {
    setPanel('chat');
    window.setTimeout(() => questionRef.current?.focus(), 100);
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await studioRef.current?.requestFullscreen();
    } catch { setError('Full screen is unavailable in this browser.'); }
  }
  function teacherAction() {
    if (!room) return;
    if (room.status === 'scheduled') void doAction('start');
    else if (room.status === 'paused') void doAction('resume');
    else if (room.status === 'completed') void doAction('restart');
    else void doAction('step');
  }
  const teacherActionLabel = room?.status === 'scheduled' ? 'Start lesson'
    : room?.status === 'paused' ? 'Resume lesson'
    : room?.status === 'completed' ? 'Restart lesson' : 'Next teaching step';
  const teacherActionDisabled = !!busy || (room?.status === 'completed' && room.mode !== 'practice') || (!['scheduled', 'teaching', 'awaiting_answer', 'paused', 'completed'].includes(room?.status ?? ''));
  const statusLabel = room?.status === 'scheduled' ? 'Ready to begin'
    : room?.status === 'completed' ? 'Lesson complete'
    : room?.status === 'paused' ? 'Lesson paused'
    : room?.status === 'awaiting_answer' ? 'Your turn to solve'
    : room?.status === 'teaching' ? 'Class in session' : 'Getting ready';

  if (loading && !room) return <div className="studio-loading"><div className="studio-loading-mark"><BookOpen size={25}/></div><h2>Opening your classroom</h2><p>Preparing your whiteboard…</p></div>;
  if (!room) return <div className="center-state"><h2>Couldn't open the classroom</h2><p>{error || 'This classroom may not exist or your account may not have access.'}</p><div className="studio-error-actions"><Btn onClick={() => { setLoading(true); void refresh().catch(e => {setLoading(false);setError(e instanceof Error ? e.message : 'Unable to connect.');}); }}>Try again</Btn><Btn variant="secondary" onClick={back}>Dashboard</Btn></div></div>;

  return <div className={'studio-root' + (focus ? ' studio-focus' : '') + (panel !== 'closed' ? ' studio-panel-open' : '')} ref={studioRef}>
    <div className="studio-canvas" aria-label="Interactive classroom whiteboard">
      <Suspense fallback={<div className="studio-board-loading"><BookOpen size={25}/><span>Preparing the whiteboard…</span></div>}>
        <Whiteboard events={events} grid={grid}/>
      </Suspense>
    </div>
    <div className="studio-top">
      <div className="studio-top-start">
        <button className="studio-icon studio-back" type="button" onClick={back} title="Back to dashboard" aria-label="Back to dashboard"><ChevronLeft size={21}/></button>
        <div className="studio-brand"><span className="studio-brand-symbol"><Sparkles size={18}/></span><span>ai classroom<span className="studio-brand-dot">.</span></span></div>
        <div className="studio-divider" />
        <div className="studio-course"><span>GRADE {room.grade} • {room.subject.toUpperCase()}</span><strong>{room.title}</strong></div>
      </div>
      <div className="studio-top-end">
        <span className="studio-status"><span className={'studio-status-dot ' + (room.status === 'teaching' ? 'active' : '')}/>{statusLabel}</span>
        <span className="studio-members" title="Classroom participants"><Users size={16}/>{room.memberCount ?? 1}<span className="studio-desktop-only"> joined</span></span>
        <button className="studio-icon studio-mobile-chat" onClick={() => setPanel(panel === 'chat' ? 'closed' : 'chat')} title="Classroom chat" aria-label="Open classroom chat"><MessageCircle size={19}/></button>
        <button className="studio-icon studio-desktop-only" onClick={() => void toggleFullscreen()} title={fullscreen ? 'Exit full screen' : 'Full screen'} aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}>{fullscreen ? <Minimize2 size={18}/> : <Maximize2 size={18}/>}</button>
      </div>
    </div>

    <div className="studio-progress-pill"><span className="studio-progress-label">TODAY'S LESSON</span><div className="studio-progress-track"><span style={{width:progress + '%'}}/></div><strong>{room.stage}/5</strong></div>

    <div className="studio-rail" role="toolbar" aria-label="Classroom controls">
      <button className={'studio-tool' + (panel === 'chat' ? ' is-active' : '')} title="Ask the teacher" aria-label="Ask the teacher" onClick={showQuestions}><MessageCircle size={20}/><span>Ask</span></button>
      <button className={'studio-tool' + (panel === 'activity' ? ' is-active' : '')} title="Lesson activity" aria-label="Lesson activity" onClick={() => setPanel(panel === 'activity' ? 'closed' : 'activity')}><Clock3 size={20}/><span>Activity</span></button>
      <span className="studio-tool-separator"/>
      <button className={'studio-tool' + (grid ? ' is-active' : '')} title="Toggle board grid" aria-label="Toggle board grid" aria-pressed={grid} onClick={() => setGrid(!grid)}><Grid3X3 size={20}/><span>Grid</span></button>
      <button className={'studio-tool' + (focus ? ' is-active' : '')} title="Focus on whiteboard" aria-label="Focus on whiteboard" aria-pressed={focus} onClick={() => {setFocus(!focus);setPanel('closed');}}><Maximize2 size={19}/><span>Focus</span></button>
      <button className="studio-tool" title="How to use the classroom" aria-label="How to use the classroom" onClick={() => setPanel(panel === 'help' ? 'closed' : 'help')}><HelpCircle size={20}/><span>Help</span></button>
    </div>
    {focus && <button className="studio-focus-exit" onClick={() => setFocus(false)}><Minimize2 size={16}/> Exit focus</button>}

    {!teacherEvents.length && joined !== false && <div className="studio-intro">
      <div className="studio-intro-icon"><BookOpen size={27}/></div><span className="studio-intro-eyebrow">YOUR LEARNING SPACE</span>
      <h1>Big ideas start here.</h1>
      <p>A limitless whiteboard, a brilliant AI teacher, and a little curiosity. You're exactly where you need to be.</p>
      <div className="studio-example"><span>Today we're exploring</span><strong>x² + 5x + 6</strong><small>Factorisation • Grade 10 Maths</small></div>
      {canControl && room.status === 'scheduled' && <button className="studio-intro-cta" disabled={!!busy} onClick={teacherAction}><Play size={17} fill="currentColor"/> {busy ? 'Starting…' : 'Begin your lesson'} <ArrowRight size={17}/></button>}
    </div>}

    {joined === false && <div className="studio-gate-backdrop"><div className="studio-gate">
      <span className="studio-gate-icon"><GraduationCap size={27}/></span><h2>Welcome to the classroom</h2>
      <p>Join this Grade {room.grade} lesson to see the board and ask questions.</p>
      {error && <Banner message={error}/>}
      {!canControl && !childId && <p className="studio-gate-help">Create a learner profile on your dashboard first.</p>}
      <button className="studio-primary" disabled={!!busy || (!canControl && !childId)} onClick={() => void doAction('join', childId ? {childId} : {})}>Join classroom <ArrowRight size={16}/></button>
      <button className="studio-gate-back" onClick={back}>Back to dashboard</button>
    </div></div>}

    {joined !== false && <div className="studio-caption">
      <span className="studio-caption-stars"><Sparkles size={17}/></span>
      <div><span className="studio-caption-label">MISS NOVA IS TEACHING</span><p>{lastStep?.speech ?? 'Welcome! We will learn how to break down quadratic expressions, step by step.'}</p></div>
      {lastStep && <button onClick={replay} title="Replay explanation" aria-label="Replay explanation"><Volume2 size={19}/></button>}
    </div>}

    {error && <div className="studio-banner"><Banner message={error} onClose={() => setError('')}/></div>}
    {notice && <div className="studio-toast" role="status"><CheckCircle2 size={16}/>{notice}<button aria-label="Dismiss" onClick={() => setNotice('')}><X size={15}/></button></div>}

    {panel !== 'closed' && <div className="studio-side-panel">
      <div className="studio-panel-head"><div><span className="studio-panel-eyebrow">CLASSROOM SPACE</span><h2>{panel === 'chat' ? 'Ask Miss Nova' : panel === 'activity' ? 'Lesson activity' : 'How it works'}</h2></div><button className="studio-icon" aria-label="Close panel" onClick={() => setPanel('closed')}><X size={20}/></button></div>
      {panel === 'chat' ? <>
        <div className="studio-panel-scroll">
          <div className="studio-teacher-card"><div className="studio-teacher-avatar"><Sparkles size={21}/></div><div><strong>Miss Nova <span>AI Teacher</span></strong><p>{lastStep?.speech ?? 'Hi there! Ready to learn factorisation together?'}</p></div></div>
          {lastStep?.equationLatex && <div className="studio-equation" dangerouslySetInnerHTML={{ __html: katex.renderToString(lastStep.equationLatex, {throwOnError:false,trust:false,output:'html'}) }}/>}
          {lastStep?.question && <div className="studio-question-prompt"><strong><Brain size={16}/> Let's think</strong><p>{lastStep.question}</p></div>}
          {events.filter(e => e.sequence > resetSequence && e.type === 'question_asked').slice(-8).map(e => <div className="studio-message" key={e.id}><span>Question from class</span><p>{String(e.payload.question ?? '')}</p></div>)}
          {room.status === 'awaiting_answer' && <form className="studio-answer-form" onSubmit={e => { e.preventDefault(); if(answer.trim()) void doAction('answer', {answer:answer.trim()}); }}>
            <strong><Zap size={17}/> Quick exercise</strong><p>Factorise x² + 5x + 6</p><input aria-label="Your answer" placeholder="(x+...)(x+...)" value={answer} onChange={e => setAnswer(e.target.value)} maxLength={120}/>
            <button className="studio-primary" type="submit" disabled={!!busy || !answer.trim()}>Check answer <ArrowRight size={15}/></button>{feedback && <small>{feedback}</small>}
          </form>}
        </div>
        <form className="studio-chat-compose" onSubmit={e => { e.preventDefault(); if(question.trim()) void doAction('ask',{question:question.trim()}); }}>
          <button className="studio-hand" type="button" aria-label="Raise your hand" title="Raise your hand" disabled={!!busy || joined === false} onClick={() => void doAction('raise')}><Hand size={19}/></button>
          <input ref={questionRef} placeholder="Ask a question…" aria-label="Your question" value={question} maxLength={400} onChange={e=>setQuestion(e.target.value)} disabled={joined === false}/>
          <button className="studio-send" type="submit" aria-label="Send question" disabled={!!busy || !question.trim() || joined === false}><Send size={18}/></button>
        </form>
        <p className="studio-panel-footnote">Questions are queued for the next teaching step.</p>
      </> : panel === 'activity' ? <div className="studio-panel-scroll studio-history">
        {events.filter(e => e.sequence > resetSequence).slice().reverse().length === 0 ? <p className="studio-panel-empty">Lesson activity will appear here.</p> :
          events.filter(e => e.sequence > resetSequence).slice().reverse().map(e => <div className="studio-history-entry" key={e.id}><span className="studio-history-dot"/><div><strong>{e.type === 'teacher_step' ? String(e.payload.heading ?? 'Teaching step') : e.type === 'question_asked' ? 'Question asked' : e.type === 'hand_raised' ? 'Hand raised' : e.type === 'answer' ? 'Exercise submitted' : 'Classroom update'}</strong><small>Event {e.sequence}</small></div></div>)}
      </div> : <div className="studio-panel-scroll studio-help"><h3>Make the most of your classroom</h3><p>The whiteboard is the centre of every lesson. Miss Nova writes one explanation at a time as the facilitator moves the lesson forward.</p><div><MessageCircle size={19}/><p><strong>Ask a question</strong> Open the chat panel and send a question. The teacher handles queued questions during the next step.</p></div><div><Grid3X3 size={19}/><p><strong>Shape your view</strong> Turn on a grid or use the whiteboard zoom and pan controls.</p></div><div><Volume2 size={19}/><p><strong>Listen again</strong> Replay an explanation at any time. Speech is played by your browser.</p></div><p className="studio-help-note">Your classroom uses real AI teaching steps; it does not run an expensive background loop.</p></div>}
    </div>}

    {joined !== false && <div className="studio-dock">
      <div className="studio-dock-teacher"><span className="studio-dock-avatar"><Sparkles size={21}/></span><div><strong>Miss Nova</strong><span>YOUR AI TEACHER</span></div><span className="studio-dock-online" title="Teacher ready"/></div>
      <span className="studio-dock-divider"/>
      <div className="studio-dock-actions">
        <button className="studio-dock-icon" title={muted ? 'Unmute voice' : 'Mute voice'} aria-label={muted ? 'Unmute voice' : 'Mute voice'} aria-pressed={muted} onClick={() => {setMuted(!muted);if(!muted)stopSpeech();}}>{muted ? <VolumeX size={19}/> : <Volume2 size={19}/>}</button>
        <button className="studio-dock-icon" title="Replay last explanation" aria-label="Replay last explanation" disabled={!lastStep} onClick={replay}><Play size={19}/></button>
        <button className="studio-dock-icon studio-dock-hand" title="Raise your hand" aria-label="Raise your hand" disabled={!!busy} onClick={()=>void doAction('raise')}><Hand size={19}/></button>
        <button className="studio-dock-question" onClick={showQuestions}><MessageCircle size={18}/><span>Ask a question</span></button>
      </div>
      {canControl && <><span className="studio-dock-divider"/><div className="studio-control-group">
        {['teaching','awaiting_answer'].includes(room.status) && <button className="studio-dock-icon" aria-label="Pause lesson" title="Pause lesson" disabled={!!busy} onClick={()=>void doAction('pause')}><Pause size={18}/></button>}
        <button className="studio-primary studio-next" onClick={teacherAction} disabled={teacherActionDisabled}>
          {busy ? 'Working…' : teacherActionLabel} <ArrowRight size={17}/>
        </button>
      </div></>}
    </div>}
  </div>;
}

function Dashboard({ user, admin, rooms, children, selectedChild, selectChild, navigate, onCreate, onEnter, entering }: { user:User;admin:boolean;rooms:Room[];children:Child[];selectedChild:string;selectChild:(id:string)=>void;navigate:(path:string)=>void;onCreate:()=>void;onEnter:()=>void;entering:boolean }) {
  const [firstName,setFirstName]=useState('');const [grade,setGrade]=useState(10);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function addChild(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{await classroomApi('createChild',{firstName,grade});setFirstName('');window.dispatchEvent(new Event('ai-classroom-children-change'));}catch(e){setError(e instanceof Error?e.message:'Could not add profile.');}finally{setBusy(false);}}
  return <div className="dashboard shell"><div className="dash-heading"><div><div className="eyebrow dashboard-eyebrow"><Sparkles size={14}/> YOUR LEARNING SPACE</div><h1>Good to see you <span>again.</span></h1><p>Every big idea starts with a little curiosity. Ready for class?</p></div><div className="dash-date"><CalendarDays size={20}/> Grade 10 · Mathematics</div></div>{error&&<Banner message={error} onClose={()=>setError('')}/>}
    <div className="dash-grid"><div className="primary-stack"><section className="dashboard-feature"><div><span className="pill-white"><span className="online-dot"/> YOUR NEXT LESSON</span><h2>Unlock the power<br/>of factorisation.</h2><p>Learn to break down quadratic expressions with a teacher who makes every step clear.</p><button className="btn white" disabled={entering} onClick={onEnter}>{entering ? "Opening…" : "Open your classroom"} <ArrowRight size={18}/></button></div><div className="feature-illustration"><div className="math-sticker">x² + 7x + 10</div><div className="math-sticker smaller">(x + 5)(x + 2)</div><div className="drawing-pencil">✦</div></div></section><div className="section-heading"><div><h2>Classrooms</h2><p>Your learning spaces, all in one place.</p></div><Btn onClick={onEnter} disabled={entering}><Plus size={17}/> Practice classroom</Btn></div><div className="room-list">{rooms.length?rooms.map(r=><button key={r.id} onClick={()=>navigate(`/classroom/${r.id}`)} className="room-card"><span className="room-card-icon"><BookOpen size={23}/></span><div><strong>{r.title}</strong><p>Grade {r.grade} · {r.subject} · {r.topic}</p></div><span className={`status-pill ${r.status}`}>{r.status.replace('_',' ')}</span><ChevronRight size={20}/></button>):<div className="empty-rooms"><BookOpen size={24}/><h3>No classrooms yet</h3><p>'Your personal classroom is ready whenever you are. Click “Practice classroom” to begin.'</p></div>}</div></div>
      <div className="secondary-stack"><div className="profile-card"><div className="sidecard-label"><Users size={18}/> LEARNER PROFILES</div><p>Manage the learners in your family. Select a profile before joining a class.</p><div className="children-list">{children.map(c=><button type="button" onClick={()=>selectChild(c.id)} className={`child ${selectedChild===c.id?'selected':''}`} key={c.id}><span>{c.firstName.charAt(0).toUpperCase()}</span><div><strong>{c.firstName}</strong><small>Grade {c.grade}</small></div>{selectedChild===c.id&&<CheckCircle2 size={18}/>}</button>)}</div><form onSubmit={addChild} className="child-form"><label>Learner first name<input required maxLength={40} placeholder="e.g. Thabo" value={firstName} onChange={e=>setFirstName(e.target.value)}/></label><label>Grade<select value={grade} onChange={e=>setGrade(Number(e.target.value))}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>Grade {i+1}</option>)}</select></label><button type="submit" disabled={busy} className="btn secondary full"><Plus size={16}/> Add learner profile</button></form></div><div className="help-card"><div className="help-icon"><Brain size={22}/></div><h3>How it works</h3><p>One AI teacher runs the lesson for everyone. Each learner sees the same live whiteboard and can ask a question.</p></div></div></div>
  </div>;
}
export default function App() {
  const [user,setUser]=useState<User|null>(null);const [authReady,setAuthReady]=useState(false);
  const [page,setPage]=useState(route());const [admin,setAdmin]=useState(false);const [selectedChild,setSelectedChild]=useState('');
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [navOpen,setNavOpen]=useState(false);
  const rooms=useRooms(user?.uid);const children=useChildren(user?.uid??'');
  useEffect(()=>onAuthStateChanged(auth,u=>{setUser(u);setAuthReady(true);}),[]);
  useEffect(()=>{if(!user){setAdmin(false);return;} classroomApi<{admin:boolean}>('me').then(x=>setAdmin(x.admin)).catch(()=>setAdmin(false));},[user]);
  useEffect(()=>{if(!selectedChild&&children.length)setSelectedChild(children[0].id);if(selectedChild&&children.length&&!children.some(c=>c.id===selectedChild))setSelectedChild(children[0].id);},[children,selectedChild]);
  useEffect(()=>{const handler=()=>setPage(route());window.addEventListener('popstate',handler);return()=>window.removeEventListener('popstate',handler);},[]);
  const navigate=(path:string)=>{window.history.pushState({},'',path);setPage(route());window.scrollTo({top:0});setNavOpen(false);};
  async function createRoom(){setBusy(true);setError('');try{const data=await classroomApi<{roomId:string}>('create');navigate(`/classroom/${data.roomId}`);}catch(e){setError(e instanceof Error?e.message:'Could not create classroom.');}finally{setBusy(false);}}
  async function openPractice(){setBusy(true);setError('');try{const data=await classroomApi<{roomId:string}>('createPractice');navigate('/classroom/'+data.roomId);}catch(e){setError(e instanceof Error?e.message:'Unable to open your practice classroom.');}finally{setBusy(false);}}
  if(!authReady)return <div className="center-state"><Logo/><p>Preparing your classroom…</p></div>;
  if(!user)return <AuthScreen/>;
  return <div className="app-shell"><header className="app-topbar"><div className="shell app-topbar-inner"><button onClick={()=>navigate('/dashboard')} className="logo-button"><Logo/></button><nav className={navOpen?'nav-links open':'nav-links'}><button onClick={()=>navigate('/dashboard')} className={page.page==='dashboard'?'active':''}><LayoutDashboard size={17}/> Dashboard</button><button onClick={()=>void openPractice()} disabled={busy}><BookOpen size={17}/> Classroom</button>{admin&&<button onClick={()=>navigate('/admin')} className={page.page==='admin'?'active':''}><ShieldCheck size={17}/> Admin</button>}</nav><div className="nav-right"><span className="signed-in-as">{user.email}</span><button className="logout" title="Sign out" onClick={()=>void signOut(auth)}><LogOut size={18}/></button><button className="mobile-menu" onClick={()=>setNavOpen(!navOpen)} aria-label="Toggle navigation"><Menu size={23}/></button></div></div></header>
    {error&&<div className="shell app-error"><Banner message={error} onClose={()=>setError('')}/></div>}
    {page.page==='room'&&page.roomId?<Classroom roomId={page.roomId} admin={admin} childId={selectedChild} back={()=>navigate('/dashboard')}/>:page.page==='admin'&&admin?<div className="dashboard shell"><div className="dash-heading"><div><div className="eyebrow">ADMIN · CLASSROOM MANAGEMENT</div><h1>Teacher's desk</h1><p>Create a room, enter it and control each AI teaching step.</p></div><Btn onClick={()=>void createRoom()} disabled={busy}><Plus size={17}/> Create Grade 10 class</Btn></div><div className="room-list">{rooms.map(r=><button className="room-card" key={r.id} onClick={()=>navigate(`/classroom/${r.id}`)}><span className="room-card-icon"><BookOpen size={22}/></span><div><strong>{r.title}</strong><p>Grade {r.grade} · {r.status}</p></div><ChevronRight size={20}/></button>)}</div></div>:<Dashboard user={user} admin={admin} rooms={rooms} children={children} selectedChild={selectedChild} selectChild={setSelectedChild} navigate={navigate} onCreate={()=>void createRoom()} onEnter={()=>void openPractice()} entering={busy}/>}
  </div>;
}
