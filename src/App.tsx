import {lazy,Suspense,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {FormEvent,ReactNode} from 'react';
import type {User} from 'firebase/auth';
import {createUserWithEmailAndPassword,onAuthStateChanged,sendPasswordResetEmail,signInWithEmailAndPassword,signOut} from 'firebase/auth';
import {ArrowRight,AudioLines,ChevronLeft,ChevronRight,Clock3,LockKeyhole,LogOut,MicOff,Moon,Play,Shield,ShieldCheck,Sparkles,Sun,Trash2} from 'lucide-react';
import {auth} from './lib/firebase';
import {gymApi} from './lib/gym-api';
import {newRecognition,recognitionAvailable,playVoice,stopVoice,microphoneError} from './lib/speech-voice';
import type {RecognitionInstance} from './lib/speech-voice';
import {categories,challenges,challengeById} from '../shared/catalog.mjs';
import type {Challenge} from '../shared/catalog.mjs';
const Experience=lazy(()=>import('./components/Experience'));
const MySessions=lazy(()=>import('./components/MySessions'));
import Artwork from './components/Artwork';
import type {Review,Session,Profile} from './lib/speech-types';

type Page='explore'|'sessions'|'profile'|'experience'|'review';
type AppRoute={page:Page;id?:string};
type Theme='dark'|'light';
function readRoute():AppRoute{
 const parts=location.pathname.split('/').filter(Boolean);
 if(parts[0]==='sessions')return {page:'sessions'};
 if(parts[0]==='profile')return {page:'profile'};
 if(parts[0]==='experience'&&parts[1])return {page:'experience',id:parts[1]};
 if(parts[0]==='review'&&parts[1])return {page:'review',id:parts[1]};
 return {page:'explore'};
}
function Logo(){return <div className="sg-logo"><span className="sg-logo-icon"><AudioLines size={22}/></span><span>SPEECH<span className="sg-logo-accent">GYM</span><small>.</small></span></div>;}
function Pill({children}: {children:ReactNode}){return <span className="sg-pill">{children}</span>;}
function formatDuration(seconds:number){const m=Math.floor(seconds/60);const s=Math.max(0,seconds%60);return m+':'+String(s).padStart(2,'0');}
function authErrorMessage(e:unknown){
 const code=e&&typeof e==='object'&&'code'in e?String((e as {code:unknown}).code):'';
 switch(code){
  case 'auth/email-already-in-use':return 'That email already has an account. Sign in instead.';
  case 'auth/weak-password':return 'Choose a password of at least six characters.';
  case 'auth/invalid-email':return 'Enter a valid email address.';
  case 'auth/invalid-credential':return 'Incorrect email or password.';
  case 'auth/too-many-requests':return 'Too many attempts. Try again later.';
  default:return 'Could not authenticate. Check your connection and try again.';
 }
}
function AuthScreen({theme,toggleTheme}:{theme:Theme;toggleTheme:()=>void}){
 const [mode,setMode]=useState<'login'|'signup'>('login');
 const [email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [adult,setAdult]=useState(false);
 async function submit(e:FormEvent){
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   if(mode==='signup'){
    if(!adult){setError('Speech Gym is currently available only to adults 18 and older.');return;}
    await createUserWithEmailAndPassword(auth,email.trim(),password);
    await gymApi('confirmAdult',{confirm:'I_AM_18_OR_OLDER'});window.dispatchEvent(new Event('speechgym:profile-updated'));
   }else await signInWithEmailAndPassword(auth,email.trim(),password);
  }catch(e){setError(authErrorMessage(e));}finally{setBusy(false);}
 }
 async function reset(){
  if(!email.trim()){setError('Enter your email address first.');return;}
  setBusy(true);setError('');
  try{await sendPasswordResetEmail(auth,email.trim());setNotice('If that address is registered, a reset email will arrive.');}
  catch(e){setError(authErrorMessage(e));}finally{setBusy(false);}
 }
 return <main className="sg-auth">
   <div className="sg-auth-glow"/>
   <div className="sg-auth-illustration">
    <div className="sg-auth-brandline"><Logo/><button className="sg-theme-switch" onClick={toggleTheme} aria-label={theme==='dark'?'Switch to light mode':'Switch to dark mode'}>{theme==='dark'?<Sun size={20}/>:<Moon size={20}/>}</button></div>
    <div className="sg-auth-poster">
     <span className="sg-eyebrow"><span className="sg-dot"/> YOUR VOICE IS YOUR POWER</span>
     <h1>Train your voice.<br/><em>Sharpen your mind.</em></h1>
     <p>Step into conversations. Defend bold ideas. Think on your feet. Become the speaker you want to be—one rep at a time.</p>
     <div className="sg-auth-rings"><span/><span/><span/><AudioLines size={86}/></div>
     <div className="sg-auth-categories"><Pill>18 immersive workouts</Pill><Pill>Real conversations</Pill><Pill>Coaching after every rep</Pill></div>
    </div>
    <span className="sg-legal-caption">PRIVATE SESSIONS. REAL PROGRESS.</span>
   </div>
   <div className="sg-auth-form-wrap"><div className="sg-auth-form">
    <div className="sg-auth-top-label"><span className="sg-orb-small"/><span>YOUR NEXT REP STARTS HERE</span></div>
    <h2>{mode==='login'?'Welcome back.':'Join the gym.'}</h2>
    <p className="sg-auth-sub">{mode==='login'?'Pick up where you left off. Your voice is ready.':'Create your account and jump into an experience.'}</p>
    {error&&<div className="sg-error" role="alert">{error}</div>}
    {notice&&<div className="sg-notice" role="status">{notice}</div>}
    <form onSubmit={submit} className="sg-form">
     <label>Email address<input type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)}/></label>
     <label>Password<input type="password" required minLength={6} autoComplete={mode==='signup'?'new-password':'current-password'} placeholder="Your password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
     {mode==='signup'&&<label className="sg-checkbox"><input type="checkbox" checked={adult} onChange={e=>setAdult(e.target.checked)}/><span>I confirm I am 18 or older and understand this is a private, AI-assisted speaking experience.</span></label>}
     <button className="sg-btn sg-btn-primary sg-btn-wide" disabled={busy} type="submit">{busy?'Connecting…':mode==='login'?'Enter Speech Gym':'Create my account'}<ArrowRight size={18}/></button>
    </form>
    <div className="sg-auth-switch">{mode==='login'?'New to Speech Gym?':'Already training with us?'} <button onClick={()=>{setMode(mode==='login'?'signup':'login');setError('');}}>{mode==='login'?'Create an account':'Sign in'}</button></div>
    {mode==='login'&&<button className="sg-forgot" disabled={busy} onClick={()=>void reset()}>Forgot your password?</button>}
    <div className="sg-auth-privacy"><ShieldCheck size={17}/> Your microphone audio is never stored by Speech Gym. Your browser provides speech recognition.</div>
   </div></div>
  </main>;
}
function ChallengeCard({challenge,onStart}:{challenge:Challenge;onStart:(id:string)=>void}){
 return <button className="sg-challenge-card" onClick={()=>onStart(challenge.id)} aria-label={'Start '+challenge.title}>
   <div className="sg-thumb"><Artwork challenge={challenge}/><span className="sg-card-top">{challenge.difficulty}</span><span className="sg-card-play"><Play size={23} fill="currentColor"/></span></div>
   <div className="sg-card-meta"><span>{challenge.minutes} MIN · {categories.find(c=>c.id===challenge.category)?.title.toUpperCase()}</span><strong>{challenge.title}</strong><p>{challenge.tagline}</p></div>
 </button>;
}
function CatalogueRow({title,subtitle,items,onStart}:{title:string;subtitle?:string;items:Challenge[];onStart:(id:string)=>void}){
 const ref=useRef<HTMLDivElement|null>(null);
 if(!items.length)return null;
 return <section className="sg-rail-section"><div className="sg-section-head"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><div className="sg-carousel-arrows">
  <button aria-label={'Scroll '+title+' left'} onClick={()=>ref.current?.scrollBy({left:-610,behavior:'smooth'})}><ChevronLeft size={19}/></button>
  <button aria-label={'Scroll '+title+' right'} onClick={()=>ref.current?.scrollBy({left:610,behavior:'smooth'})}><ChevronRight size={19}/></button>
 </div></div><div className="sg-horizontal" ref={ref}>{items.map(c=><ChallengeCard key={c.id} challenge={c} onStart={onStart}/>)}</div></section>;
}
function Explore({sessions,onStart}:{sessions:Session[];onStart:(id:string)=>void}){
 const featured=challenges.find(c=>c.id==='mafia-boss')??challenges[0];
 const [filter,setFilter]=useState('all');
 const recommendations=useMemo(()=>{
  const done=new Set(sessions.filter(s=>s.status==='completed').map(s=>s.challengeId));
  return challenges.filter(c=>!done.has(c.id)).slice(0,6);
 },[sessions]);
 const recent=useMemo(()=>sessions.slice(0,3).map(s=>challengeById(s.challengeId)).filter((c):c is Challenge=>!!c),[sessions]);
 return <main className="sg-explore">
  <div className="sg-hero"><Artwork challenge={featured} hero/><div className="sg-hero-overlay"/>
   <div className="sg-hero-copy">
    <span className="sg-featured-label"><Sparkles size={15}/> FEATURED EXPERIENCE <span className="sg-label-separator"/> CHALLENGE 12 / 18</span>
    <span className="sg-hero-kicker">SPEAK LIKE A CHARACTER</span>
    <h1>THE<br/><em>MAFIA</em><br/>BOSS<span className="sg-period">.</span></h1>
    <p>Calm under pressure. Every word deliberate. Enter a fictional cinematic scenario where presence matters more than volume.</p>
    <div className="sg-hero-details"><span><Clock3 size={15}/> 5 MIN</span><span>INTERMEDIATE</span><span>FICTIONAL SCENARIO</span></div>
    <button className="sg-btn sg-btn-primary sg-hero-cta" onClick={()=>onStart(featured.id)}><Play size={18} fill="currentColor"/> Start experience <ArrowRight size={18}/></button>
   </div>
   <span className="sg-hero-sideword">SPEECH / GYM / ORIGINALS</span>
   <span className="sg-hero-index">01 <span>/</span> 08</span>
  </div>
  <div className="sg-explore-body">
   <div className="sg-greeting"><div><span className="sg-eyebrow">YOUR TRAINING FLOOR</span><h2>What will you train <em>today?</em></h2></div><span className="sg-greeting-count">{challenges.length} curated experiences · 8 skill worlds</span></div>
   <div className="sg-chip-strip" role="group" aria-label="Filter challenge categories"><button className={filter==='all'?'selected':''} onClick={()=>setFilter('all')}>All experiences</button>{categories.map(c=><button className={filter===c.id?'selected':''} onClick={()=>setFilter(c.id)} key={c.id}>{c.title}</button>)}</div>
   {filter!=='all'?<CatalogueRow title={categories.find(c=>c.id===filter)?.title??'Experiences'} subtitle={categories.find(c=>c.id===filter)?.subtitle} items={challenges.filter(c=>c.category===filter)} onStart={onStart}/>:<>
    {recent.length>0&&<CatalogueRow title="Train it again" subtitle="Repetition creates skill." items={recent} onStart={onStart}/>}
    {recommendations.length>0&&<CatalogueRow title="Your next rep" subtitle="Handpicked from what you haven't tried." items={recommendations} onStart={onStart}/>}
    {categories.map(c=><CatalogueRow key={c.id} title={c.title} subtitle={c.subtitle} items={challenges.filter(x=>x.category===c.id)} onStart={onStart}/>)}
   </>}
   <div className="sg-bottom-manifesto"><span>THE ONLY WAY TO GET BETTER AT SPEAKING</span><strong>IS TO <em>SPEAK.</em></strong><span>ONE REP AT A TIME.</span></div>
  </div>
 </main>;
}
function ProfilePage({user,profile,sessions,onConfirm,onDeleteHistory,onDeleteAccount,onTranscriptPreference,theme,toggleTheme}:{user:User;profile:Profile;sessions:Session[];onConfirm:()=>Promise<void>;onDeleteHistory:()=>Promise<void>;onDeleteAccount:()=>Promise<void>;onTranscriptPreference:(consent:boolean)=>Promise<void>;theme:Theme;toggleTheme:()=>void}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const completed=sessions.filter(s=>s.status==='completed');
 const skills=Array.from(new Set(completed.flatMap(s=>s.review?.dimensions??[]))).slice(0,8);
 async function run(fn:()=>Promise<void>,text:string){setBusy(true);setMessage('');try{await fn();setMessage(text);}catch(e){setMessage(e instanceof Error?e.message:'Could not update settings.');}finally{setBusy(false);}}
 return <main className="sg-content-page sg-profile"><div className="sg-page-heading"><span className="sg-eyebrow">YOUR SPACE</span><h1>Profile<span>.</span></h1><p>A quiet place for your progress and privacy choices.</p></div>
  <div className="sg-profile-grid"><section className="sg-profile-card"><div className="sg-profile-avatar">{user.email?.charAt(0).toUpperCase()||'S'}</div><h2>{user.email?.split('@')[0]}</h2><p>{user.email}</p><span className="sg-profile-meta"><ShieldCheck size={15}/> PRIVATE TRAINING ACCOUNT</span>
   <div className="sg-profile-numbers"><div><strong>{completed.length}</strong><span>Reps</span></div><div><strong>{Math.floor(sessions.reduce((t,s)=>t+s.durationSeconds,0)/60)}m</strong><span>Practice</span></div></div></section>
   <section className="sg-profile-card sg-skill-card"><span className="sg-eyebrow">SKILLS YOU'VE PRACTISED</span><h2>Keep building.</h2>{skills.length?<div className="sg-skills">{skills.map(s=><Pill key={s}>{s}</Pill>)}</div>:<p>Complete a challenge to begin your training journal. No made-up scores, only practice you actually did.</p>}<div className="sg-profile-quote">"A stronger speaker is built, not born."</div></section></div>
  <section className="sg-settings"><h2>Preferences & privacy</h2><div className="sg-setting-row">
    <div><strong>{theme==='dark'?<Moon size={17}/>:<Sun size={17}/>} Appearance</strong><p>Choose a light or dark theme. Your preference is saved on this device.</p></div>
    <button className="sg-btn sg-btn-outline" onClick={toggleTheme}>{theme==='dark'?<Sun size={16}/>:<Moon size={16}/>} {theme==='dark'?'Light mode':'Dark mode'}</button>
   </div><div className="sg-setting-row"><div><strong><LockKeyhole size={17}/> Account eligibility</strong><p>{profile?.adultConfirmed?'Confirmed 18+ for this private adult beta.':'You must confirm you are 18 or older to start a challenge.'}</p></div>{!profile?.adultConfirmed&&<button className="sg-btn sg-btn-outline" disabled={busy} onClick={()=>void run(onConfirm,'Eligibility confirmed.')}>Confirm 18+</button>}</div>
   <div className="sg-setting-row"><div><strong><MicOff size={17}/> Microphone & transcripts</strong><p>Speech recognition comes from your browser and may use the browser provider's services. Your transcribed words are sent to the AI provider to respond. Speech Gym never saves raw audio. Choose whether to save a transcript on the instructions screen of each workout. This preference sets the default; individual transcripts can be deleted.</p></div><label className="sg-pref-toggle"><input type="checkbox" checked={profile?.transcriptConsent??true} disabled={busy} onChange={e=>void run(()=>onTranscriptPreference(e.target.checked),'Transcript preference updated.')}/><span>Default: save transcripts</span></label></div>
   <div className="sg-setting-row"><div><strong><Trash2 size={17}/> Clear speaking history</strong><p>Delete completed sessions, reviews and any opt-in transcripts. Your sign-in remains intact.</p></div><button className="sg-btn sg-btn-outline" disabled={busy} onClick={()=>{if(confirm('Permanently delete your Speech Gym workout history?'))void run(onDeleteHistory,'Speaking history deleted.');}}>Delete history</button></div>
   <div className="sg-setting-row"><div><strong><Shield size={17}/> Delete account</strong><p>Delete your login and Speech Gym data. Some data from the old AI Classroom may require separate removal.</p></div><button className="sg-btn sg-btn-danger" disabled={busy} onClick={()=>{const value=prompt('Type DELETE to permanently delete your account.');if(value==='DELETE')void run(onDeleteAccount,'Account deleted.');}}>Delete account</button></div>
   <div className="sg-setting-row"><div><strong><LogOut size={17}/> Sign out</strong><p>End this session on this device. Your saved workouts remain in your account.</p></div>
    <button className="sg-btn sg-btn-outline" onClick={()=>void signOut(auth)}><LogOut size={16}/> Sign out</button></div>
   {message&&<p className="sg-setting-message" role="status">{message}</p>}
  </section>
 </main>;
}
export default function App(){
 const [user,setUser]=useState<User|null>(null),[authReady,setAuthReady]=useState(false);
 const [route,setRoute]=useState<AppRoute>(readRoute());
 const [profile,setProfile]=useState<Profile>(null),[sessions,setSessions]=useState<Session[]>([]);
 const [loadingData,setLoadingData]=useState(false);
 const [theme,setTheme]=useState<Theme>(()=>{
  try{return localStorage.getItem('speechgym-theme')==='light'?'light':'dark';}catch{return 'dark';}
 });
 const [runNonce,setRunNonce]=useState(0);
 const toggleTheme=useCallback(()=>setTheme(t=>t==='dark'?'light':'dark'),[]);
 useEffect(()=>{
  document.documentElement.dataset.sgTheme=theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#101012':'#f5f3ef');
  try{localStorage.setItem('speechgym-theme',theme);}catch{}
 },[theme]);
 const load=useCallback(async()=>{
  if(!auth.currentUser)return;
  setLoadingData(true);
  try{
   const [p,s]=await Promise.all([
    gymApi<{profile:Profile}>('profile'),gymApi<{sessions:Session[]}>('list')
   ]);
   setProfile(p.profile);setSessions(s.sessions);
  }catch(e){console.warn('Speech Gym history unavailable:',e instanceof Error?e.name:'unknown');}
  finally{setLoadingData(false);}
 },[]);
 useEffect(()=>onAuthStateChanged(auth,u=>{setUser(u);setAuthReady(true);if(u)void load();else{setProfile(null);setSessions([]);}}),[load]);
 useEffect(()=>{const refresh=()=>void load();window.addEventListener('speechgym:profile-updated',refresh);return()=>window.removeEventListener('speechgym:profile-updated',refresh);},[load]);
 useEffect(()=>{const handler=()=>setRoute(readRoute());addEventListener('popstate',handler);return()=>removeEventListener('popstate',handler);},[]);
 const navigate=useCallback((path:string)=>{
  history.pushState({},'',path);setRoute(readRoute());window.scrollTo(0,0);
 },[]);
 const start=(id:string)=>{setRunNonce(n=>n+1);navigate('/experience/'+id);};
 const afterWorkout=useCallback((sessionId:string,challengeId:string,review:Review)=>{
  setSessions(old=>old.some(s=>s.id===sessionId)?
   old.map(s=>s.id===sessionId?{...s,status:'completed',review,turnsCount:review.evidence.turns}:s):
   [{id:sessionId,challengeId,challengeVersion:1,status:'completed',
     turnsCount:review.evidence.turns,durationSeconds:0,review,
     startedAt:Date.now(),updatedAt:Date.now(),transcriptConsent:true},...old]);
  void load();
 },[load]);
 const confirmAdult=useCallback(async()=>{await gymApi('confirmAdult',{confirm:'I_AM_18_OR_OLDER'});setProfile(p=>({...p,adultConfirmed:true}));},[]);
 async function deleteSession(id:string){await gymApi('deleteSession',{sessionId:id});setSessions(s=>s.filter(x=>x.id!==id));}
 async function saveTranscriptPreference(consent:boolean){await gymApi('setTranscriptPreference',{transcriptConsent:consent});setProfile(p=>({...p,transcriptConsent:consent}));}
 async function deleteHistory(){let more=true;while(more){const result=await gymApi<{more:boolean}>('deleteHistory');more=result.more;}setSessions([]);}
 async function deleteAccount(){await gymApi('deleteAccount',{confirm:'DELETE_MY_ACCOUNT'});await signOut(auth);navigate('/explore');}
 if(!authReady)return <div className="sg-boot"><Logo/><span>PREPARING YOUR TRAINING FLOOR…</span></div>;
 if(!user)return <AuthScreen theme={theme} toggleTheme={toggleTheme}/>;
 const challenge=route.id?challengeById(route.id):null;
 if(route.page==='experience'&&challenge)return <Suspense fallback={<div className="sg-boot"><Logo/><span>PREPARING YOUR EXPERIENCE…</span></div>}>
  <Experience
  key={challenge.id+'-'+runNonce} challenge={challenge}
  adultConfirmed={!!profile?.adultConfirmed} defaultSaveTranscript={profile?.transcriptConsent??true}
  onConfirmAdult={confirmAdult} onComplete={afterWorkout}
  onRetry={()=>setRunNonce(n=>n+1)} onHome={()=>navigate('/explore')}/>
 </Suspense>;
 return <div className="sg-app"><header className="sg-header"><button className="sg-logo-button" onClick={()=>navigate('/explore')} aria-label="Go to Explore"><Logo/></button>
  <nav className="sg-nav" aria-label="Main navigation">
   <button className={route.page==='explore'?'active':''} onClick={()=>navigate('/explore')}>Explore</button>
   <button className={route.page==='sessions'?'active':''} onClick={()=>navigate('/sessions')}>My Sessions</button>
   <button className={route.page==='profile'?'active':''} onClick={()=>navigate('/profile')}>Profile</button>
  </nav>
  <div className="sg-header-right">
   <span className="sg-header-reps"><AudioLines size={16}/> {sessions.filter(s=>s.status==='completed').length} reps</span>
   <button className="sg-theme-switch" onClick={toggleTheme} aria-label={theme==='dark'?'Switch to light mode':'Switch to dark mode'} title={theme==='dark'?'Light mode':'Dark mode'}>
    {theme==='dark'?<Sun size={20}/>:<Moon size={20}/>}
   </button>
   <button className="sg-user-avatar" title={user.email??'Account'} onClick={()=>navigate('/profile')}>{user.email?.charAt(0).toUpperCase()}</button>
   <button className="sg-sign-out" title="Sign out" aria-label="Sign out" onClick={()=>void signOut(auth)}><LogOut size={19}/></button>
  </div>
 </header>
 {route.page==='explore'?<Explore sessions={sessions} onStart={start}/>:
  route.page==='sessions'||route.page==='review'?<Suspense fallback={<div className="sg-content-page">Loading your sessions…</div>}><MySessions
    sessions={sessions} onRetry={start} onDelete={deleteSession} onRefresh={()=>navigate('/explore')} onHistoryChange={load}/></Suspense>:
  route.page==='profile'?<ProfilePage user={user} profile={profile} sessions={sessions}
    onConfirm={confirmAdult} onDeleteHistory={deleteHistory}
    onDeleteAccount={deleteAccount} onTranscriptPreference={saveTranscriptPreference}
    theme={theme} toggleTheme={toggleTheme}/>:
  <Explore sessions={sessions} onStart={start}/>}
 <nav className="sg-bottom-nav" aria-label="Mobile navigation"><button className={route.page==='explore'?'active':''} onClick={()=>navigate('/explore')}><Sparkles size={20}/>Explore</button><button className={route.page==='sessions'?'active':''} onClick={()=>navigate('/sessions')}><Clock3 size={20}/>Sessions</button><button className={route.page==='profile'?'active':''} onClick={()=>navigate('/profile')}><Shield size={20}/>Profile</button></nav>
 <footer className="sg-site-footer"><Logo/><span>TRAIN YOUR VOICE. SHARPEN YOUR MIND.</span><span>PRIVATE BETA · 18+</span></footer>
 {loadingData&&<div className="sg-loading-indicator" aria-label="Syncing sessions"/>}
 </div>;
}
