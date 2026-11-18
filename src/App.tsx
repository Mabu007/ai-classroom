import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {FormEvent,ReactNode} from 'react';
import type {User} from 'firebase/auth';
import {createUserWithEmailAndPassword,onAuthStateChanged,sendPasswordResetEmail,signInWithEmailAndPassword,signOut} from 'firebase/auth';
import {ArrowLeft,ArrowRight,AudioLines,BookOpen,Check,ChevronLeft,ChevronRight,Clock3,Headphones,LockKeyhole,LogOut,Menu,Mic,MicOff,Pause,Play,RotateCcw,Send,Shield,ShieldCheck,Sparkles,Square,Trash2,Trophy,Volume2,VolumeX,Waveform,X} from 'lucide-react';
import {auth} from './lib/firebase';
import {gymApi} from './lib/gym-api';
import {newRecognition,recognitionAvailable,playVoice,stopVoice,microphoneError} from './lib/speech-voice';
import type {RecognitionInstance} from './lib/speech-voice';
import {categories,challenges,challengeById} from '../shared/catalog.mjs';
import type {Challenge} from '../shared/catalog.mjs';

type Page='explore'|'sessions'|'profile'|'experience'|'review';
type AppRoute={page:Page;id?:string};
type Review={strength:string;improvement:string;nextRep:string;source:string;dimensions:string[];evidence:{turns:number;words:number;questions:number;developedAnswers:number};disclaimer:string};
type TranscriptTurn={role:'user'|'character';text:string;source?:string};
type Session={
 id:string;challengeId:string;challengeVersion:number;status:string;turnsCount:number;
 durationSeconds:number;review:Review|null;startedAt:number;updatedAt:number;transcriptConsent:boolean;transcript?:TranscriptTurn[];
};
type Profile={adultConfirmed?:boolean;transcriptConsent?:boolean}|null;

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
function AuthScreen(){
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
    await gymApi('confirmAdult',{confirm:'I_AM_18_OR_OLDER'}).catch(()=>{});
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
    <Logo/>
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
function Artwork({challenge,hero=false}:{challenge:Challenge;hero?:boolean}){
 return <div className={'sg-art sg-art-'+challenge.art+(hero?' sg-art-hero':'')} style={{'--accent':challenge.accent} as React.CSSProperties} aria-hidden="true">
  <div className="sg-art-texture"/>
  <div className="sg-art-halo"/>
  <div className="sg-art-silhouette"><span className="sg-head"/><span className="sg-body"/></div>
  <span className="sg-art-symbol">{challenge.icon}</span>
  <span className="sg-art-monogram">{challenge.title.split(' ').slice(0,2).map(w=>w[0]).join('')}</span>
  <div className="sg-art-shadow"/>
 </div>;
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
function AgeGate({onConfirm,busy,error}:{onConfirm:()=>void;busy:boolean;error:string}){
 return <div className="sg-gate"><div className="sg-gate-inner"><span className="sg-gate-icon"><ShieldCheck size={30}/></span><span className="sg-eyebrow">BEFORE YOUR FIRST REP</span><h2>Let's keep the gym safe.</h2><p>Speech Gym currently supports adults aged 18 and older. Characters are fictional and the app is for private speaking practice.</p>{error&&<div className="sg-error">{error}</div>}<button className="sg-btn sg-btn-primary" disabled={busy} onClick={onConfirm}>{busy?'Saving…':"I'm 18 or older"}<ArrowRight size={17}/></button></div></div>;
}
function Experience({challenge,adultConfirmed,transcriptConsent,onConfirmAdult,onComplete,onBack}:{
 challenge:Challenge;adultConfirmed:boolean;transcriptConsent:boolean;onConfirmAdult:()=>Promise<void>;
 onComplete:(id:string,review:Review)=>void;onBack:()=>void;
}){
 const [phase,setPhase]=useState<'opening'|'ready'|'listening'|'thinking'|'speaking'|'reviewing'|'error'>('opening');
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [adultBusy,setAdultBusy]=useState(false);
 const [caption,setCaption]=useState(challenge.opening);
 const [captions,setCaptions]=useState(true);
 const [typeMode,setTypeMode]=useState(false),[typed,setTyped]=useState('');
 const [micLevel,setMicLevel]=useState(0),[muted,setMuted]=useState(false);
 const [elapsed,setElapsed]=useState(0),[turns,setTurns]=useState(0);
 const [source,setSource]=useState<'ai'|'guided'|'opening'>('opening');
 const sessionRef=useRef<string|null>(null);
 const startedRef=useRef(false),closedRef=useRef(false),finishingRef=useRef(false),autoRef=useRef(true);
 const historyRef=useRef<TranscriptTurn[]>([]);
 const recognitionRef=useRef<RecognitionInstance|null>(null),recognizedRef=useRef('');
 const streamRef=useRef<MediaStream|null>(null),audioRef=useRef<AudioContext|null>(null),rafRef=useRef<number|null>(null);
 const startTime=useRef(0);
 const voiceOptions=challenge.voice;
 const stopMicrophone=useCallback(()=>{
  if(rafRef.current!==null)cancelAnimationFrame(rafRef.current);
  rafRef.current=null;
  streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;
  if(audioRef.current)void audioRef.current.close().catch(()=>{});audioRef.current=null;
  setMicLevel(0);
 },[]);
 const cancelCapture=useCallback(()=>{
  recognitionRef.current?.abort();recognitionRef.current=null;stopMicrophone();
 },[stopMicrophone]);
 const finish=useCallback(async()=>{
  if(finishingRef.current)return;
  finishingRef.current=true;closedRef.current=true;autoRef.current=false;
  cancelCapture();stopVoice();setPhase('reviewing');setError('');
  const sessionId=sessionRef.current;
  if(!sessionId){setError('The session did not start. Return and try again.');setPhase('error');return;}
  try{
   const response=await gymApi<{review:Review}>('finish',{
    sessionId,durationSeconds:Math.min(1200,Math.floor((Date.now()-startTime.current)/1000)),
    history:historyRef.current
   });
   onComplete(sessionId,response.review);
  }catch(e){setError(e instanceof Error?e.message:'Unable to save your review.');setPhase('error');finishingRef.current=false;}
 },[cancelCapture,onComplete]);
 const turn=useCallback(async(text:string)=>{
  if(closedRef.current||!sessionRef.current)return;
  const actual=text.trim();
  if(!actual){setPhase('ready');return;}
  stopMicrophone();setTypeMode(false);setTyped('');setNotice('');
  const next:TranscriptTurn[]=[...historyRef.current,{role:'user',text:actual}];
  historyRef.current=next;setCaption(actual);setPhase('thinking');
  try{
   const data=await gymApi<{reply:string;source:'ai'|'guided';notice:string|null;turn:number;shouldFinish:boolean}>('turn',{
    sessionId:sessionRef.current,text:actual,history:next
   });
   if(closedRef.current)return;
   historyRef.current=[...next,{role:'character',text:data.reply,source:data.source}];
   setTurns(data.turn);setCaption(data.reply);setSource(data.source);setNotice(data.notice??'');
   setPhase('speaking');
   if(!muted){
    playVoice(data.reply,{rate:voiceOptions.rate,pitch:voiceOptions.pitch,onEnd:()=>{
     if(closedRef.current)return;
     if(data.shouldFinish)void finish();
     else if(autoRef.current)void listen();
     else setPhase('ready');
    }});
   }else if(data.shouldFinish)void finish();
   else setPhase('ready');
  }catch(e){setError(e instanceof Error?e.message:'Unable to reach the character.');setPhase('ready');}
 },[stopMicrophone,muted,voiceOptions.rate,voiceOptions.pitch,finish]);
 const listen=useCallback(async()=>{
  if(closedRef.current||phase==='listening'||phase==='thinking'||phase==='reviewing')return;
  setError('');
  if(!recognitionAvailable()){setTypeMode(true);setPhase('ready');setNotice('Voice transcription is unavailable in this browser. You can type your answer or use Chrome or Edge.');return;}
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('not-allowed');
   const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
   if(closedRef.current){stream.getTracks().forEach(t=>t.stop());return;}
   streamRef.current=stream;
   try{
    const context=new AudioContext();audioRef.current=context;
    const analyser=context.createAnalyser();analyser.fftSize=512;
    context.createMediaStreamSource(stream).connect(analyser);
    const buffer=new Uint8Array(analyser.frequencyBinCount);
    let last=0;
    const meter=(time:number)=>{
     if(!streamRef.current)return;
     if(time-last>95){last=time;analyser.getByteFrequencyData(buffer);const max=Math.max(...buffer);
      setMicLevel(Math.min(100,max/2));}
     rafRef.current=requestAnimationFrame(meter);
    };rafRef.current=requestAnimationFrame(meter);
   }catch{/* Some browsers restrict audio meters; speech transcription can still work. */}
   const recognition=newRecognition();
   if(!recognition)throw new Error('not-supported');
   recognitionRef.current=recognition;recognizedRef.current='';
   recognition.onresult=e=>{
    let text='';
    for(let i=0;i<e.results.length;i++)text+=(e.results[i]?.[0]?.transcript??'')+' ';
    recognizedRef.current=text.trim();
    if(text.trim())setCaption(text.trim());
   };
   recognition.onerror=e=>{
    setError(microphoneError(e.error));
    if(e.error==='not-allowed')setTypeMode(true);
   };
   recognition.onend=()=>{
    recognitionRef.current=null;stopMicrophone();
    const heard=recognizedRef.current.trim();
    if(heard&&!closedRef.current)void turn(heard);
    else if(!closedRef.current)setPhase('ready');
   };
   recognition.start();setPhase('listening');
  }catch(e){
   stopMicrophone();setTypeMode(true);setPhase('ready');
   setError(microphoneError(e instanceof Error?e.message:'not-allowed'));
  }
 },[phase,stopMicrophone,turn]);
 // Stable loop adapters: Speech callbacks must use the latest implementation,
 // not the state captured by the first async server reply.
 const latestListen=useRef(listen),latestTurn=useRef(turn),latestFinish=useRef(finish);
 latestListen.current=listen;latestTurn.current=turn;latestFinish.current=finish;
 const start=useCallback(async()=>{
  if(startedRef.current||!adultConfirmed)return;
  startedRef.current=true;closedRef.current=false;setError('');
  try{
   const data=await gymApi<{sessionId:string;opening:string}>('start',{
    challengeId:challenge.id,transcriptConsent
   });
   if(closedRef.current)return;
   sessionRef.current=data.sessionId;startTime.current=Date.now();
   historyRef.current=[{role:'character',text:data.opening,source:'opening'}];
   setCaption(data.opening);setSource('opening');setPhase('speaking');
   playVoice(data.opening,{rate:voiceOptions.rate,pitch:voiceOptions.pitch,onEnd:()=>{
    if(!closedRef.current)void latestListen.current();
   }});
  }catch(e){startedRef.current=false;setError(e instanceof Error?e.message:'Unable to start this experience.');setPhase('error');}
 },[challenge.id,adultConfirmed,transcriptConsent,voiceOptions.rate,voiceOptions.pitch]);
 useEffect(()=>{if(adultConfirmed)void start();},[adultConfirmed,start]);
 useEffect(()=>{const timer=setInterval(()=>{if(startTime.current&&!closedRef.current)setElapsed(Math.floor((Date.now()-startTime.current)/1000));},1000);return()=>clearInterval(timer);},[]);
 useEffect(()=>()=>{closedRef.current=true;cancelCapture();stopVoice();},[cancelCapture]);
 // When the learner finishes speaking, the browser recognition callback invokes
 // the latest turn function. We never record raw microphone audio.
 async function confirmAdult(){
  setAdultBusy(true);setError('');
  try{await onConfirmAdult();}catch(e){setError(e instanceof Error?e.message:'Unable to confirm.');}
  finally{setAdultBusy(false);}
 }
 function speakAgain(){
  stopVoice();setPhase('speaking');
  playVoice(caption,{rate:voiceOptions.rate,pitch:voiceOptions.pitch,onEnd:()=>{if(!closedRef.current)void latestListen.current();}});
 }
 function submitTyped(e:FormEvent){
  e.preventDefault();if(typed.trim())void latestTurn.current(typed.trim());
 }
 function stopListening(){
  autoRef.current=false;recognitionRef.current?.stop();setPhase('ready');
 }
 const canSpeak=phase==='ready'||phase==='speaking'||phase==='error';
 const characterName=challenge.archetype.split(' — ')[0];
 return <main className="sg-experience" style={{'--accent':challenge.accent} as React.CSSProperties}>
  <Artwork challenge={challenge} hero/>
  <div className="sg-experience-vignette"/>
  <div className="sg-experience-top">
   <button className="sg-back-round" onClick={()=>{closedRef.current=true;onBack();}} aria-label="Leave experience"><ArrowLeft size={21}/></button>
   <div className="sg-experience-title"><span>NOW TRAINING</span><strong>{challenge.title}</strong></div>
   <span className="sg-experience-timer"><Clock3 size={15}/> {formatDuration(elapsed)}</span>
   <button className="sg-end-button" disabled={phase==='reviewing'} onClick={()=>void latestFinish.current()}><Square size={13} fill="currentColor"/> End & review</button>
  </div>
  <div className="sg-experience-center">
   <div className="sg-scene-eyebrow"><span className="sg-red-dot"/>{challenge.category.toUpperCase().replace('-',' ')} / IMMERSIVE EXPERIENCE</div>
   <h1>{characterName}</h1>
   <p className="sg-scene-desc">{challenge.objective}</p>
   <div className={'sg-voice-orb '+phase} aria-label={'Speech status: '+phase}>
    <div className="sg-orb-layer sg-orb-layer-outer"/><div className="sg-orb-layer sg-orb-layer-mid"/><div className="sg-orb-core"><AudioLines size={42}/></div>
   </div>
   <div className="sg-speaking-status"><span className={'sg-status-light '+phase}/>{phase==='listening'?'YOUR TURN · LISTENING':phase==='thinking'?'CHARACTER IS THINKING':phase==='speaking'?'CHARACTER IS SPEAKING':phase==='reviewing'?'YOUR COACH IS REVIEWING':phase==='error'?'CONNECTION NEEDS ATTENTION':'YOUR TURN · READY'}</div>
   <div className="sg-waveform" role="img" aria-label={phase==='listening'?'Microphone activity level':'Character voice activity indicator'}>{Array.from({length:33},(_,i)=><span key={i} className={phase} style={{height:(phase==='listening'?Math.max(6,Math.min(44,6+micLevel*(.14+Math.abs(Math.sin(i*1.3))*.36))):Math.max(5,Math.round(7+Math.abs(Math.sin(i*.65))*((phase==='speaking'||phase==='thinking')?32:8))))+'px',animationDelay:(i*43)+'ms'}}/>)}</div>
   {captions&&<div className="sg-live-caption"><span>{source==='guided'?'GUIDED PROMPT':source==='ai'?'AI CHARACTER':phase==='listening'?'YOUR WORDS':'SCENE DIALOGUE'}</span><p>{caption}</p></div>}
   {notice&&<div className="sg-voice-notice" role="status">{notice}</div>}
   {error&&<div className="sg-voice-error" role="alert">{error}</div>}
  </div>
  <div className="sg-experience-controls">
   <button className="sg-circle-button" aria-label={captions?'Hide captions':'Show captions'} onClick={()=>setCaptions(!captions)} title="Toggle captions"><BookOpen size={19}/></button>
   <button className={'sg-circle-button '+(muted?'sg-muted':'')} aria-label={muted?'Enable character voice':'Mute character voice'} onClick={()=>{setMuted(!muted);if(!muted)stopVoice();}}>{muted?<VolumeX size={21}/>:<Volume2 size={21}/>}</button>
   <button className={'sg-mic-button '+(phase==='listening'?'active':'')} disabled={phase==='thinking'||phase==='reviewing'} onClick={()=>phase==='listening'?stopListening():void latestListen.current()} aria-label={phase==='listening'?'Finish speaking':'Start speaking'}>{phase==='listening'?<Square size={25} fill="currentColor"/>:<Mic size={31}/>}<span>{phase==='listening'?'FINISH SPEAKING':'TAP TO SPEAK'}</span></button>
   <button className="sg-circle-button" onClick={speakAgain} title="Repeat the character" aria-label="Replay character"><RotateCcw size={20}/></button>
   <button className="sg-circle-button" onClick={()=>{setTypeMode(!typeMode);setError('');}} aria-label="Type instead" title="Type instead"><Menu size={20}/></button>
  </div>
  {typeMode&&<form className="sg-type-tray" onSubmit={submitTyped}><input value={typed} maxLength={1500} autoFocus placeholder="Type your response instead…" onChange={e=>setTyped(e.target.value)}/><button disabled={!typed.trim()||phase==='thinking'||phase==='reviewing'} aria-label="Send your answer"><Send size={21}/></button></form>}
  <div className="sg-experience-footer"><span>REP {Math.min(turns+1,challenge.maxTurns)} OF {challenge.maxTurns}</span><div className="sg-rep-progress">{Array.from({length:challenge.maxTurns},(_,i)=><span key={i} className={i<turns?'done':''}/>)}</div><span>PRIVATE SESSION · NO AUDIO SAVED</span></div>
  {!adultConfirmed&&<AgeGate busy={adultBusy} error={error} onConfirm={()=>void confirmAdult()}/>}
 </main>;
}
function Sessions({sessions,onRetry,onDelete,onRefresh}:{sessions:Session[];onRetry:(id:string)=>void;onDelete:(id:string)=>Promise<void>;onRefresh:()=>void}){
 const [removing,setRemoving]=useState('');
 return <main className="sg-content-page"><div className="sg-page-heading"><span className="sg-eyebrow">YOUR TRAINING JOURNAL</span><h1>My Sessions<span>.</span></h1><p>Every attempt is a rep. Repetition is how you get stronger.</p></div>
  <div className="sg-session-stats"><div><strong>{sessions.filter(x=>x.status==='completed').length}</strong><span>Completed workouts</span></div><div><strong>{new Set(sessions.map(x=>x.challengeId)).size}</strong><span>Challenges attempted</span></div><div><strong>{Math.floor(sessions.reduce((sum,x)=>sum+x.durationSeconds,0)/60)}m</strong><span>Practice time</span></div></div>
  {!sessions.length?<div className="sg-empty-state"><Headphones size={38}/><h2>Your first rep awaits.</h2><p>Choose a challenge, step into the scene, and start speaking.</p><button className="sg-btn sg-btn-primary" onClick={onRefresh}>Explore challenges <ArrowRight size={16}/></button></div>:
   <div className="sg-session-list">{sessions.map(s=>{const c=challengeById(s.challengeId);if(!c)return null;return <article className="sg-session-item" key={s.id}>
    <div className="sg-session-art"><Artwork challenge={c}/></div><div className="sg-session-details"><span>{new Date(s.startedAt||Date.now()).toLocaleDateString()} · {s.durationSeconds?formatDuration(s.durationSeconds):'Not finished'}</span><h3>{c.title}</h3><p>{s.review?.nextRep??'A workout in progress. Begin another rep when ready.'}</p><div className="sg-session-tags"><Pill>{s.status==='completed'?'COMPLETED':'NOT FINISHED'}</Pill><Pill>{c.difficulty}</Pill></div></div>
    <div className="sg-session-actions"><button className="sg-btn sg-btn-outline" onClick={()=>onRetry(c.id)}><RotateCcw size={16}/> Try again</button><button aria-label={'Delete '+c.title+' session'} disabled={!!removing} onClick={async()=>{if(!confirm('Delete this speaking session and its saved feedback?'))return;setRemoving(s.id);await onDelete(s.id).finally(()=>setRemoving(''));}}><Trash2 size={18}/></button></div>
   </article>})}</div>}
 </main>;
}
function ProfilePage({user,profile,sessions,onConfirm,onDeleteHistory,onDeleteAccount}:{user:User;profile:Profile;sessions:Session[];onConfirm:()=>Promise<void>;onDeleteHistory:()=>Promise<void>;onDeleteAccount:()=>Promise<void>}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const completed=sessions.filter(s=>s.status==='completed');
 const skills=Array.from(new Set(completed.flatMap(s=>s.review?.dimensions??[]))).slice(0,8);
 async function run(fn:()=>Promise<void>,text:string){setBusy(true);setMessage('');try{await fn();setMessage(text);}catch(e){setMessage(e instanceof Error?e.message:'Could not update settings.');}finally{setBusy(false);}}
 return <main className="sg-content-page sg-profile"><div className="sg-page-heading"><span className="sg-eyebrow">YOUR SPACE</span><h1>Profile<span>.</span></h1><p>A quiet place for your progress and privacy choices.</p></div>
  <div className="sg-profile-grid"><section className="sg-profile-card"><div className="sg-profile-avatar">{user.email?.charAt(0).toUpperCase()||'S'}</div><h2>{user.email?.split('@')[0]}</h2><p>{user.email}</p><span className="sg-profile-meta"><ShieldCheck size={15}/> PRIVATE TRAINING ACCOUNT</span>
   <div className="sg-profile-numbers"><div><strong>{completed.length}</strong><span>Reps</span></div><div><strong>{Math.floor(sessions.reduce((t,s)=>t+s.durationSeconds,0)/60)}m</strong><span>Practice</span></div></div></section>
   <section className="sg-profile-card sg-skill-card"><span className="sg-eyebrow">SKILLS YOU'VE PRACTISED</span><h2>Keep building.</h2>{skills.length?<div className="sg-skills">{skills.map(s=><Pill key={s}>{s}</Pill>)}</div>:<p>Complete a challenge to begin your training journal. No made-up scores, only practice you actually did.</p>}<div className="sg-profile-quote">"A stronger speaker is built, not born."</div></section></div>
  <section className="sg-settings"><h2>Privacy & account</h2><div className="sg-setting-row"><div><strong><LockKeyhole size={17}/> Account eligibility</strong><p>{profile?.adultConfirmed?'Confirmed 18+ for this private adult beta.':'You must confirm you are 18 or older to start a challenge.'}</p></div>{!profile?.adultConfirmed&&<button className="sg-btn sg-btn-outline" disabled={busy} onClick={()=>void run(onConfirm,'Eligibility confirmed.')}>Confirm 18+</button>}</div>
   <div className="sg-setting-row"><div><strong><MicOff size={17}/> Microphone & transcripts</strong><p>Speech recognition comes from your browser and may use the browser provider's services. Speech Gym does not save raw audio or transcripts by default. Your AI responses are generated server-side.</p></div><Pill>NO AUDIO RECORDING</Pill></div>
   <div className="sg-setting-row"><div><strong><Trash2 size={17}/> Clear speaking history</strong><p>Delete completed sessions, reviews and any opt-in transcripts. Your sign-in remains intact.</p></div><button className="sg-btn sg-btn-outline" disabled={busy} onClick={()=>{if(confirm('Permanently delete your Speech Gym workout history?'))void run(onDeleteHistory,'Speaking history deleted.');}}>Delete history</button></div>
   <div className="sg-setting-row"><div><strong><Shield size={17}/> Delete account</strong><p>Delete your login and Speech Gym data. Some data from the old AI Classroom may require separate removal.</p></div><button className="sg-btn sg-btn-danger" disabled={busy} onClick={()=>{const value=prompt('Type DELETE to permanently delete your account.');if(value==='DELETE')void run(onDeleteAccount,'Account deleted.');}}>Delete account</button></div>
   {message&&<p className="sg-setting-message" role="status">{message}</p>}
  </section>
 </main>;
}
function ReviewPage({session,onRetry,onHome}:{session:Session|undefined;onRetry:(id:string)=>void;onHome:()=>void}){
 if(!session?.review)return <main className="sg-content-page"><div className="sg-empty-state"><h2>Review unavailable</h2><p>Complete a workout to receive coaching.</p><button className="sg-btn sg-btn-primary" onClick={onHome}>Explore</button></div></main>;
 const c=challengeById(session.challengeId);const r=session.review;
 return <main className="sg-content-page sg-review"><div className="sg-review-head"><span className="sg-eyebrow"><Trophy size={15}/> WORKOUT COMPLETE</span><h1>Every rep <em>counts.</em></h1><p>{c?.title} · {session.turnsCount} response{session.turnsCount===1?'':'s'} · {formatDuration(session.durationSeconds)} practice</p><span className="sg-review-source">{r.source==='ai_transcript_review'?'AI-ASSISTED TRANSCRIPT REVIEW':'OBSERVATIONS FROM YOUR TRANSCRIPT'}</span></div>
  <div className="sg-feedback-grid"><article className="sg-feedback-card"><span className="sg-feedback-no">01 / STRENGTH</span><span className="sg-feedback-symbol sg-positive"><Check size={24}/></span><h2>What you did well.</h2><p>{r.strength}</p></article><article className="sg-feedback-card"><span className="sg-feedback-no">02 / IMPROVE</span><span className="sg-feedback-symbol sg-warning"><Sparkles size={24}/></span><h2>What to sharpen.</h2><p>{r.improvement}</p></article><article className="sg-feedback-card sg-feedback-next"><span className="sg-feedback-no">03 / NEXT REP</span><span className="sg-feedback-symbol"><RotateCcw size={24}/></span><h2>Your next rep.</h2><p>{r.nextRep}</p></article></div>
  <div className="sg-review-foot"><p>{r.disclaimer}</p><div><button className="sg-btn sg-btn-outline" onClick={onHome}>Explore more</button><button className="sg-btn sg-btn-primary" onClick={()=>onRetry(session.challengeId)}><RotateCcw size={16}/> Try again <ArrowRight size={16}/></button></div></div>
 </main>;
}
export default function App(){
 const [user,setUser]=useState<User|null>(null),[authReady,setAuthReady]=useState(false);
 const [route,setRoute]=useState<AppRoute>(readRoute());
 const [profile,setProfile]=useState<Profile>(null),[sessions,setSessions]=useState<Session[]>([]);
 const [loadingData,setLoadingData]=useState(false);
 const [mobileNav,setMobileNav]=useState(false);
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
 useEffect(()=>{const handler=()=>setRoute(readRoute());addEventListener('popstate',handler);return()=>removeEventListener('popstate',handler);},[]);
 const navigate=useCallback((path:string)=>{
  history.pushState({},'',path);setRoute(readRoute());setMobileNav(false);window.scrollTo(0,0);
 },[]);
 const start=(id:string)=>navigate('/experience/'+id);
 const afterWorkout=useCallback((sessionId:string,review:Review)=>{
  setSessions(old=>old.some(s=>s.id===sessionId)?old.map(s=>s.id===sessionId?{...s,status:'completed',review}:s):
   [{id:sessionId,challengeId:readRoute().id??'unknown',challengeVersion:1,status:'completed',turnsCount:review.evidence.turns,durationSeconds:0,review,startedAt:Date.now(),updatedAt:Date.now(),transcriptConsent:false},...old]);
  navigate('/review/'+sessionId);void load();
 },[navigate,load]);
 const confirmAdult=useCallback(async()=>{await gymApi('confirmAdult',{confirm:'I_AM_18_OR_OLDER'});setProfile(p=>({...p,adultConfirmed:true}));},[]);
 async function deleteSession(id:string){await gymApi('deleteSession',{sessionId:id});setSessions(s=>s.filter(x=>x.id!==id));}
 async function deleteHistory(){let more=true;while(more){const result=await gymApi<{more:boolean}>('deleteHistory');more=result.more;}setSessions([]);}
 async function deleteAccount(){await gymApi('deleteAccount',{confirm:'DELETE_MY_ACCOUNT'});await signOut(auth);navigate('/explore');}
 if(!authReady)return <div className="sg-boot"><Logo/><span>PREPARING YOUR TRAINING FLOOR…</span></div>;
 if(!user)return <AuthScreen/>;
 const challenge=route.id?challengeById(route.id):null;
 if(route.page==='experience'&&challenge)return <Experience key={challenge.id} challenge={challenge}
   adultConfirmed={!!profile?.adultConfirmed} transcriptConsent={!!profile?.transcriptConsent}
   onConfirmAdult={confirmAdult} onComplete={afterWorkout} onBack={()=>navigate('/explore')}/>;
 return <div className="sg-app"><header className="sg-header"><button className="sg-logo-button" onClick={()=>navigate('/explore')} aria-label="Go to Explore"><Logo/></button>
  <nav className={'sg-nav '+(mobileNav?'open':'')} aria-label="Main"><button className={route.page==='explore'?'active':''} onClick={()=>navigate('/explore')}>Explore</button><button className={route.page==='sessions'?'active':''} onClick={()=>navigate('/sessions')}>My Sessions</button><button className={route.page==='profile'?'active':''} onClick={()=>navigate('/profile')}>Profile</button></nav>
  <div className="sg-header-right"><span className="sg-header-reps"><AudioLines size={16}/> {sessions.filter(s=>s.status==='completed').length} reps</span><button className="sg-user-avatar" title={user.email??'Account'} onClick={()=>navigate('/profile')}>{user.email?.charAt(0).toUpperCase()}</button><button className="sg-sign-out" title="Sign out" aria-label="Sign out" onClick={()=>void signOut(auth)}><LogOut size={19}/></button><button className="sg-mobile-toggle" onClick={()=>setMobileNav(!mobileNav)} aria-label="Open menu">{mobileNav?<X size={22}/>:<Menu size={22}/>}</button></div>
 </header>
 {route.page==='explore'?<Explore sessions={sessions} onStart={start}/>:
  route.page==='sessions'?<Sessions sessions={sessions} onRetry={start} onDelete={deleteSession} onRefresh={()=>navigate('/explore')}/>:
  route.page==='profile'?<ProfilePage user={user} profile={profile} sessions={sessions} onConfirm={confirmAdult} onDeleteHistory={deleteHistory} onDeleteAccount={deleteAccount}/>:
  route.page==='review'?<ReviewPage session={sessions.find(s=>s.id===route.id)} onRetry={start} onHome={()=>navigate('/explore')}/>:
  <Explore sessions={sessions} onStart={start}/>}
 <nav className="sg-bottom-nav" aria-label="Mobile navigation"><button className={route.page==='explore'?'active':''} onClick={()=>navigate('/explore')}><Sparkles size={20}/>Explore</button><button className={route.page==='sessions'?'active':''} onClick={()=>navigate('/sessions')}><Clock3 size={20}/>Sessions</button><button className={route.page==='profile'?'active':''} onClick={()=>navigate('/profile')}><Shield size={20}/>Profile</button></nav>
 <footer className="sg-site-footer"><Logo/><span>TRAIN YOUR VOICE. SHARPEN YOUR MIND.</span><span>PRIVATE BETA · 18+</span></footer>
 {loadingData&&<div className="sg-loading-indicator" aria-label="Syncing sessions"/>}
 </div>;
}
