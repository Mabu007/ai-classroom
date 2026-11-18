import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as React from 'react';
import type { User } from 'firebase/auth';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { BookOpen, Brain, ArrowRight, ChevronRight, GraduationCap, Users, CalendarDays, Sparkles, Volume2, VolumeX, Mic, MessageCircle, Hand, Play, Pause, Send, CheckCircle2, AlertCircle, Plus, LogOut, Menu, X, ShieldCheck, Clock3, Zap, LayoutDashboard } from 'lucide-react';
import katex from 'katex';
import { auth, configured, db } from './lib/firebase';
import { classroomApi } from './lib/api';
import { speak, stopSpeech } from './lib/voice';
import type { ClassroomEvent, Child, Room, TeacherStep } from './lib/types';
import Whiteboard from './components/Whiteboard';

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

function AuthScreen() {
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('');
    try { if (register) await createUserWithEmailAndPassword(auth, email, password); else await signInWithEmailAndPassword(auth, email, password); }
    catch(err) { setError(err instanceof Error ? err.message : 'Could not sign in.'); }
    finally { setLoading(false); }
  }
  return <div className="public-site"><header className="public-nav shell"><Logo/><span className="nav-note"><span className="online-dot"/> A new way to learn</span></header>
    <div className="hero shell"><div className="hero-copy"><div className="eyebrow"><Sparkles size={15}/> THE FUTURE OF LEARNING IS HERE</div><h1>A classroom that <em>comes alive.</em></h1><p>Meet your AI teacher. Watch lessons unfold on a live whiteboard, ask questions in real time, and discover what you’re capable of.</p><div className="hero-features"><span><CheckCircle2 size={17}/> Interactive lessons</span><span><CheckCircle2 size={17}/> Learn together</span><span><CheckCircle2 size={17}/> Personal guidance</span></div><div className="hero-testimonial">Designed for Grade 10 Mathematics. Built for curious minds.</div></div>
      <div className="auth-card"><div className="auth-overline"><span className="feature-icon"><GraduationCap size={22}/></span><span>YOUR LEARNING JOURNEY</span></div><h2>{register ? 'Create your account' : 'Welcome to class'}</h2><p>{register ? 'Parents and guardians can create an account and manage learner profiles.' : 'Sign in to join your next interactive lesson.'}</p>{!configured && <Banner message="Firebase is not configured yet. Add the VITE_FIREBASE_* environment variables."/>}{error && <Banner message={error} onClose={() => setError('')}/>}
        <form onSubmit={submit}><label>Email address<input type="email" placeholder="you@example.com" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)}/></label><label>Password<input type="password" minLength={6} placeholder="Enter your password" autoComplete={register ? 'new-password' : 'current-password'} required value={password} onChange={e=>setPassword(e.target.value)}/></label><button type="submit" className="btn primary full" disabled={!configured||loading}>{loading ? 'Please wait…' : register ? 'Create account' : 'Enter classroom'} <ArrowRight size={17}/></button></form><div className="auth-switch">{register ? 'Already have an account?' : 'New here?'} <button onClick={() => {setRegister(!register);setError('');}}>{register ? 'Sign in' : 'Create an account'}</button></div><div className="auth-footer"><ShieldCheck size={16}/> A safe, parent-managed learning environment</div></div>
    </div><section className="feature-strip shell"><div><span><Users size={21}/></span><strong>One shared classroom</strong><small>Learn together in real time</small></div><div><span><Brain size={21}/></span><strong>Intelligent explanations</strong><small>Ask when you need help</small></div><div><span><BookOpen size={21}/></span><strong>See ideas take shape</strong><small>Interactive visual learning</small></div></section></div>;
}
function useRooms(uid?: string) {
  const [rooms, setRooms] = useState<Room[]>([]);
  useEffect(() => { if (!uid) { setRooms([]); return; } return onSnapshot(query(collection(db,'classrooms'), orderBy('createdAt','desc')), s => setRooms(s.docs.map(d => ({ ...d.data(), id: d.id } as Room))), () => setRooms([])); }, [uid]);
  return rooms;
}
function useChildren(uid: string) {
  const [children, setChildren] = useState<Child[]>([]);
  useEffect(() => { if (!uid) { setChildren([]); return; } return onSnapshot(collection(db,'users',uid,'children'), s => setChildren(s.docs.map(d => ({ ...d.data(), id: d.id } as Child))), () => setChildren([])); }, [uid]);
  return children;
}
function Classroom({ roomId, admin, childId, back }: { roomId:string; admin:boolean; childId:string; back:()=>void }) {
  const [room, setRoom] = useState<Room|null>(null); const [events, setEvents] = useState<ClassroomEvent[]>([]);
  const [joined, setJoined] = useState<boolean|null>(null); const [busy, setBusy] = useState(''); const [error, setError] = useState('');
  const [question, setQuestion] = useState(''); const [answer, setAnswer] = useState(''); const [feedback, setFeedback] = useState('');
  const [muted, setMuted] = useState(false); const [tab,setTab] = useState<'chat'|'activity'>('chat');
  const latestSeen = useRef<number|null>(null);
  useEffect(() => { stopSpeech(); latestSeen.current = null; setJoined(null); setEvents([]); const cancel = onSnapshot(doc(db,'classrooms',roomId), s=>setRoom(s.exists()?{...s.data(),id:s.id} as Room:null),()=>setRoom(null)); return () => {cancel();stopSpeech();}; },[roomId]);
  useEffect(() => { const unsubscribe = onSnapshot(doc(db,'classrooms',roomId,'members',auth.currentUser!.uid), s => setJoined(s.exists()), () => setJoined(false)); return unsubscribe; },[roomId]);
  useEffect(() => { if (!joined) return; return onSnapshot(query(collection(db,'classrooms',roomId,'events'),orderBy('sequence')), snapshot => {
    const list = snapshot.docs.map(d=>({ ...d.data(), id:d.id } as ClassroomEvent));
    const last = list.at(-1)?.sequence ?? 0;
    if (latestSeen.current !== null && last > latestSeen.current && !muted) {
      const fresh = list.filter(e=> e.sequence > latestSeen.current! && e.type==='teacher_step');
      const newest = fresh.at(-1);
      if (newest) speak(String(newest.payload.speech ?? ''));
    }
    latestSeen.current = last; setEvents(list);
  }, err=>setError(err.message)); },[roomId,joined,muted]);
  const teacherEvents = useMemo(() => events.filter(e=>e.type === 'teacher_step'),[events]);
  const lastStep = teacherEvents.at(-1)?.payload as unknown as TeacherStep | undefined;
  const doAction = useCallback(async (action: string, extra: Record<string,unknown>={}) => {
    setBusy(action); setError('');
    try { const result = await classroomApi<{correct?:boolean;feedback?:string}>(action,{roomId,...extra}); if(action==='answer') setFeedback(result.feedback??'Answer saved.'); if(action==='ask')setQuestion(''); return result; }
    catch(e){setError(e instanceof Error?e.message:'Action failed.');} finally {setBusy('');}
  },[roomId]);
  function replay() { if(lastStep) {setMuted(false);speak(lastStep.speech);} }
  if (!room) return <div className="center-state"><p>Loading classroom…</p><Btn variant="secondary" onClick={back}>Back to dashboard</Btn></div>;
  if (joined === false) return <div className="center-state"><span className="feature-icon"><GraduationCap/></span><h2>Ready to join?</h2><p>{room.title} · Grade {room.grade} {room.subject}</p>{error && <Banner message={error}/>}<Btn onClick={()=>void doAction('join',childId?{childId}:{})} disabled={!!busy||(!admin&&!childId)}>Join this classroom <ArrowRight size={16}/></Btn>{!admin&&!childId&&<p>Create a learner profile from your dashboard first.</p>}</div>;
  return <div className="classroom-layout"><div className="classroom-header"><div><button className="back-link" onClick={back}>‹ Dashboard</button><div className="room-title-row"><span className="room-badge">MATHS · GRADE 10</span><h1>{room.title}</h1><span className={`status-pill ${room.status}`}>{room.status.replace('_',' ')}</span></div></div><div className="classroom-header-actions"><span className="participants"><Users size={16}/>{(room as Room & {memberCount?:number}).memberCount ?? 1} joined</span><button className="icon-button" title="Replay teacher speech" onClick={replay}><Volume2 size={19}/></button><button className="icon-button" title={muted?'Unmute':'Mute'} onClick={()=> {setMuted(!muted);if(!muted)stopSpeech();}}>{muted?<VolumeX size={19}/>:<Volume2 size={19}/>}</button></div></div>
      {error && <div className="room-error"><Banner message={error} onClose={()=>setError('')}/></div>}
      <div className="classroom-columns"><div className="board-column"><div className="board-top"><div><span className="board-label"><span className="online-dot"/> LIVE WHITEBOARD</span><span className="board-topic">Factorising quadratic trinomials</span></div><span className="step-counter">Lesson step {Math.min(room.stage,5)} of 5</span></div><div className="whiteboard-panel"><Whiteboard events={events}/>{!teacherEvents.length&&<div className="board-empty"><div className="empty-orbit"><BookOpen size={32}/></div><h3>The whiteboard is ready</h3><p>Your teacher's ideas will appear here as the lesson begins.</p></div>}</div><div className="board-bottom"><div className="teacher-avatar"><Sparkles size={23}/></div><div className="teacher-intro"><strong>Miss Nova <span className="ai-label">AI TEACHER</span></strong><span>{lastStep?.heading || 'Ready to teach you something amazing'}</span></div><button className="btn secondary compact" onClick={replay} disabled={!lastStep}><Volume2 size={16}/> Replay</button></div>{lastStep?.equationLatex && <div className="math-preview" dangerouslySetInnerHTML={{__html:katex.renderToString(lastStep.equationLatex,{throwOnError:false,trust:false,output:'html'})}}/>}
        {admin && <div className="teacher-controls"><div><span className="teacher-control-label"><ShieldCheck size={16}/> TEACHER CONTROLS</span><p>Each step makes one bounded AI request. No background agent runs.</p></div><div className="control-buttons">{room.status==='scheduled'&&<Btn onClick={()=>void doAction('start')} disabled={!!busy}><Play size={17}/> Start lesson</Btn>}{['teaching','awaiting_answer'].includes(room.status)&&<><Btn onClick={()=>void doAction('step')} disabled={!!busy||room.stage>=5}>{busy==='step'?'Teaching…':'Teach next step'} <ArrowRight size={16}/></Btn><Btn variant="secondary" onClick={()=>void doAction('pause')} disabled={!!busy}><Pause size={16}/></Btn></>}{room.status==='paused'&&<Btn onClick={()=>void doAction('resume')} disabled={!!busy}><Play size={17}/> Resume</Btn>}{room.status==='completed'&&<span className="success-note"><CheckCircle2 size={17}/> Lesson completed</span>}</div></div>}
      </div><aside className="lesson-sidebar"><div className="side-tabs"><button className={tab==='chat'?'active':''} onClick={()=>setTab('chat')}><MessageCircle size={16}/> Classroom</button><button className={tab==='activity'?'active':''} onClick={()=>setTab('activity')}><Clock3 size={16}/> Activity</button></div><div className="side-content">{tab==='chat'?<><div className="teacher-note"><span className="message-spark"><Sparkles size={15}/></span><div><strong>Miss Nova</strong><p>{lastStep?.speech ?? 'Hello learners! I’m Miss Nova. We’ll explore factorisation together. Get comfortable and get ready to learn!'}</p></div></div>{lastStep?.question&&<div className="question-card"><strong><Brain size={16}/> Think about this</strong><p>{lastStep.question}</p></div>}<div className="questions-list">{events.filter(e=>e.type==='question_asked').slice(-4).map(e=><div className="learner-question" key={e.id}><span><MessageCircle size={14}/> Learner question</span><p>{String(e.payload.question)}</p></div>)}</div></>:<div className="activity-list">{events.slice().reverse().slice(0,35).map(e=><div key={e.id} className="activity-item"><div className="activity-marker"/><p>{e.type==='teacher_step'?String(e.payload.heading):e.type==='question_asked'?'A learner asked a question':e.type==='hand_raised'?'A learner raised a hand':e.type==='answer'?'Exercise answer submitted':`Lesson ${String(e.payload.status)}`}</p></div>)}</div>}</div>
        <div className="interaction-panel"><button className="raise-hand" onClick={()=>void doAction('raise')} disabled={!!busy}><Hand size={18}/> Raise your hand</button><form onSubmit={e=>{e.preventDefault();if(question.trim())void doAction('ask',{question:question.trim()});}} className="question-input"><input value={question} maxLength={400} onChange={e=>setQuestion(e.target.value)} placeholder="Ask your teacher a question…" aria-label="Ask a question"/><button type="submit" disabled={!!busy||!question.trim()} aria-label="Send question"><Send size={17}/></button></form>{room.status==='awaiting_answer' && <form className="answer-form" onSubmit={e=>{e.preventDefault();void doAction('answer',{answer});}}><strong><Zap size={16}/> Your turn to solve</strong><p>Factorise x² + 5x + 6</p><input value={answer} maxLength={120} onChange={e=>setAnswer(e.target.value)} placeholder="(x+...)(x+...)" aria-label="Your factorisation"/><button type="submit" className="btn primary full" disabled={!!busy||!answer.trim()}>Submit answer</button>{feedback&&<small>{feedback}</small>}</form>}</div></aside></div>
  </div>;
}
function Dashboard({ user, admin, rooms, children, selectedChild, selectChild, navigate, onCreate }: { user:User;admin:boolean;rooms:Room[];children:Child[];selectedChild:string;selectChild:(id:string)=>void;navigate:(path:string)=>void;onCreate:()=>void }) {
  const [firstName,setFirstName]=useState('');const [grade,setGrade]=useState(10);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function addChild(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{await classroomApi('createChild',{firstName,grade});setFirstName('');}catch(e){setError(e instanceof Error?e.message:'Could not add profile.');}finally{setBusy(false);}}
  return <div className="dashboard shell"><div className="dash-heading"><div><div className="eyebrow dashboard-eyebrow"><Sparkles size={14}/> YOUR LEARNING SPACE</div><h1>Good to see you <span>again.</span></h1><p>Every big idea starts with a little curiosity. Ready for class?</p></div><div className="dash-date"><CalendarDays size={20}/> Grade 10 · Mathematics</div></div>{error&&<Banner message={error} onClose={()=>setError('')}/>}
    <div className="dash-grid"><div className="primary-stack"><section className="dashboard-feature"><div><span className="pill-white"><span className="online-dot"/> YOUR NEXT LESSON</span><h2>Unlock the power<br/>of factorisation.</h2><p>Learn to break down quadratic expressions with a teacher who makes every step clear.</p><button className="btn white" disabled={!rooms.length} onClick={()=>navigate(`/classroom/${rooms[0].id}`)}>Enter classroom <ArrowRight size={18}/></button></div><div className="feature-illustration"><div className="math-sticker">x² + 7x + 10</div><div className="math-sticker smaller">(x + 5)(x + 2)</div><div className="drawing-pencil">✦</div></div></section><div className="section-heading"><div><h2>Classrooms</h2><p>Your learning spaces, all in one place.</p></div>{admin&&<Btn onClick={onCreate}><Plus size={17}/> New classroom</Btn>}</div><div className="room-list">{rooms.length?rooms.map(r=><button key={r.id} onClick={()=>navigate(`/classroom/${r.id}`)} className="room-card"><span className="room-card-icon"><BookOpen size={23}/></span><div><strong>{r.title}</strong><p>Grade {r.grade} · {r.subject} · {r.topic}</p></div><span className={`status-pill ${r.status}`}>{r.status.replace('_',' ')}</span><ChevronRight size={20}/></button>):<div className="empty-rooms"><BookOpen size={24}/><h3>No classrooms yet</h3><p>{admin?'Create a class to begin teaching.':'An administrator will schedule your first class.'}</p></div>}</div></div>
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
  if(!authReady)return <div className="center-state"><Logo/><p>Preparing your classroom…</p></div>;
  if(!user)return <AuthScreen/>;
  return <div className="app-shell"><header className="app-topbar"><div className="shell app-topbar-inner"><button onClick={()=>navigate('/dashboard')} className="logo-button"><Logo/></button><nav className={navOpen?'nav-links open':'nav-links'}><button onClick={()=>navigate('/dashboard')} className={page.page==='dashboard'?'active':''}><LayoutDashboard size={17}/> Dashboard</button>{admin&&<button onClick={()=>navigate('/admin')} className={page.page==='admin'?'active':''}><ShieldCheck size={17}/> Admin</button>}</nav><div className="nav-right"><span className="signed-in-as">{user.email}</span><button className="logout" title="Sign out" onClick={()=>void signOut(auth)}><LogOut size={18}/></button><button className="mobile-menu" onClick={()=>setNavOpen(!navOpen)} aria-label="Toggle navigation"><Menu size={23}/></button></div></div></header>
    {error&&<div className="shell app-error"><Banner message={error} onClose={()=>setError('')}/></div>}
    {page.page==='room'&&page.roomId?<Classroom roomId={page.roomId} admin={admin} childId={selectedChild} back={()=>navigate('/dashboard')}/>:page.page==='admin'&&admin?<div className="dashboard shell"><div className="dash-heading"><div><div className="eyebrow">ADMIN · CLASSROOM MANAGEMENT</div><h1>Teacher's desk</h1><p>Create a room, enter it and control each AI teaching step.</p></div><Btn onClick={()=>void createRoom()} disabled={busy}><Plus size={17}/> Create Grade 10 class</Btn></div><div className="room-list">{rooms.map(r=><button className="room-card" key={r.id} onClick={()=>navigate(`/classroom/${r.id}`)}><span className="room-card-icon"><BookOpen size={22}/></span><div><strong>{r.title}</strong><p>Grade {r.grade} · {r.status}</p></div><ChevronRight size={20}/></button>)}</div></div>:<Dashboard user={user} admin={admin} rooms={rooms} children={children} selectedChild={selectedChild} selectChild={setSelectedChild} navigate={navigate} onCreate={()=>void createRoom()}/>}
  </div>;
}
