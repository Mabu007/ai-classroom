import {useCallback,useEffect,useRef,useState} from 'react';
import type {CSSProperties,FormEvent} from 'react';
import {
 ArrowLeft,ArrowRight,AudioLines,BookOpen,CheckCircle2,Clock3,
 Headphones,Keyboard,Mic,Pause,Play,RotateCcw,Send,ShieldCheck,Square,
 Volume2,VolumeX
} from 'lucide-react';
import type {Challenge} from '../../shared/catalog.mjs';
import type {Review,TranscriptTurn} from '../lib/speech-types';
import {formatDuration} from '../lib/speech-types';
import {gymApi} from '../lib/gym-api';
import {microphoneError,newRecognition,playVoice,recognitionAvailable,stopVoice} from '../lib/speech-voice';
import type {RecognitionInstance} from '../lib/speech-voice';
import Artwork from './Artwork';
import {createWorkoutClock} from '../../shared/workout-clock.mjs';
import ReviewModal from './ReviewModal';

type Phase='intro'|'connecting'|'ready'|'listening'|'thinking'|'speaking'|'paused'|'reviewing'|'done';
type Reply={reply:string;source:'ai'|'guided';notice:string|null;turn:number;shouldFinish:boolean};
type Source='ai'|'guided'|'opening'|'user';
interface Props{
 challenge:Challenge;adultConfirmed:boolean;defaultSaveTranscript:boolean;
 onConfirmAdult:()=>Promise<void>;
 onComplete:(sessionId:string,challengeId:string,review:Review)=>void;
 onRetry:()=>void;onHome:()=>void;
}
export default function Experience({
 challenge,adultConfirmed,defaultSaveTranscript,onConfirmAdult,onComplete,onRetry,onHome
}:Props){
 const [instructions,setInstructions]=useState(true);
 const [saveTranscript,setSaveTranscript]=useState(defaultSaveTranscript);
 const [adultChecked,setAdultChecked]=useState(adultConfirmed);
 const [starting,setStarting]=useState(false);
 const [phase,setPhase]=useState<Phase>('intro');
 const [paused,setPaused]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [caption,setCaption]=useState(challenge.opening);
 const [source,setSource]=useState<Source>('opening');
 const [captions,setCaptions]=useState(true);
 const [typeMode,setTypeMode]=useState(false);
 const [draft,setDraft]=useState('');
 const [muted,setMuted]=useState(false);
 const [micLevel,setMicLevel]=useState(0);
 const [turns,setTurns]=useState(0);
 const [elapsed,setElapsed]=useState(0);
 const [review,setReview]=useState<Review|null>(null);
 const sessionRef=useRef<string|null>(null);
 const closedRef=useRef(false);
 const pauseRef=useRef(false);
 const phaseRef=useRef<Phase>('intro');
 const mutedRef=useRef(false);
 const startedRef=useRef(false);
 const finishRef=useRef(false);
 const workingRef=useRef(false);
 const recognitionRef=useRef<RecognitionInstance|null>(null);
 const captureSerial=useRef(0);
 const speechSerial=useRef(0);
 const transcriptRef=useRef<TranscriptTurn[]>([]);
 const recognisedRef=useRef('');
 const streamRef=useRef<MediaStream|null>(null);
 const audioContextRef=useRef<AudioContext|null>(null);
 const rafRef=useRef<number|null>(null);
 const clockRef=useRef(createWorkoutClock());
 const pendingResponseRef=useRef<Reply|null>(null);
 const pendingSpeechDone=useRef<(()=>void)|null>(null);
 const pausedFromRef=useRef<Phase>('ready');
 const lastCharacterRef=useRef(challenge.opening);
 const lastCharacterSourceRef=useRef<Source>('opening');
 const listenRef=useRef<()=>void>(()=>{});
 const turnRef=useRef<(text:string)=>void>(()=>{});
 const finishNowRef=useRef<()=>void>(()=>{});
 const mountedRef=useRef(true);

 function phaseTo(next:Phase){phaseRef.current=next;setPhase(next);}
 function activeSeconds(){return clockRef.current.seconds();}
 const stopMicrophone=useCallback(()=>{
  if(rafRef.current!==null)cancelAnimationFrame(rafRef.current);
  rafRef.current=null;
  streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;
  if(audioContextRef.current)void audioContextRef.current.close().catch(()=>{});
  audioContextRef.current=null;setMicLevel(0);
 },[]);
 const cancelCapture=useCallback(()=>{
  captureSerial.current++;
  const r=recognitionRef.current;recognitionRef.current=null;
  if(r){r.onend=null;r.onerror=null;r.onresult=null;try{r.abort();}catch{}}
  stopMicrophone();
 },[stopMicrophone]);
 const stopSpeech=useCallback(()=>{
  speechSerial.current++;
  pendingSpeechDone.current=null;
  stopVoice();
 },[]);
 const listen=useCallback(async()=>{
  if(!sessionRef.current||pauseRef.current||closedRef.current||workingRef.current)return;
  if(phaseRef.current==='listening'||phaseRef.current==='reviewing'||phaseRef.current==='done')return;
  setError('');
  stopSpeech();
  if(!recognitionAvailable()){
   setTypeMode(true);phaseTo('ready');
   setNotice('Speech recognition is not available in this browser. Type your response, or try Chrome or Edge.');
   return;
  }
  const serial=++captureSerial.current;
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('audio-capture');
   const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
   if(serial!==captureSerial.current||closedRef.current||pauseRef.current){
    stream.getTracks().forEach(t=>t.stop());return;
   }
   streamRef.current=stream;
   try{
    const ctx=new AudioContext();audioContextRef.current=ctx;
    const analyser=ctx.createAnalyser();analyser.fftSize=512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const bins=new Uint8Array(analyser.frequencyBinCount);
    let lastTime=0;
    const sample=(timestamp:number)=>{
     if(serial!==captureSerial.current||!streamRef.current)return;
     if(timestamp-lastTime>=100){lastTime=timestamp;analyser.getByteFrequencyData(bins);
      setMicLevel(Math.min(100,Math.max(...bins)/2));}
     rafRef.current=requestAnimationFrame(sample);
    };
    rafRef.current=requestAnimationFrame(sample);
   }catch{/* Voice transcription may still be available without an audio meter. */}
   const recognition=newRecognition();
   if(!recognition)throw new Error('language-not-supported');
   recognitionRef.current=recognition;
   recognisedRef.current='';phaseTo('listening');
   recognition.onresult=e=>{
    if(serial!==captureSerial.current||pauseRef.current)return;
    let words='';
    for(let i=0;i<e.results.length;i++)words+=(e.results[i]?.[0]?.transcript??'')+' ';
    recognisedRef.current=words.trim();
    if(words.trim()){setCaption(words.trim());setSource('user');}
   };
   recognition.onerror=e=>{
    if(serial!==captureSerial.current)return;
    setError(microphoneError(e.error));
    if(['not-allowed','audio-capture','service-not-allowed'].includes(e.error))setTypeMode(true);
   };
   recognition.onend=()=>{
    if(serial!==captureSerial.current)return;
    recognitionRef.current=null;
    stopMicrophone();
    const words=recognisedRef.current.trim();
    if(closedRef.current||pauseRef.current)return;
    phaseTo('ready');
    if(words)turnRef.current(words);
   };
   recognition.start();
  }catch(e){
   if(serial!==captureSerial.current)return;
   cancelCapture();setTypeMode(true);phaseTo('ready');
   setError(microphoneError(e instanceof Error?e.message:'audio-capture'));
  }
 },[cancelCapture,stopMicrophone,stopSpeech]);
 listenRef.current=()=>{void listen();};

 function announce(text:string,origin:Source,onEnd:()=>void){
  if(closedRef.current)return;
  lastCharacterRef.current=text;lastCharacterSourceRef.current=origin;
  setCaption(text);setSource(origin);phaseTo('speaking');
  const serial=++speechSerial.current;
  pendingSpeechDone.current=onEnd;
  if(mutedRef.current){
   phaseTo('ready');pendingSpeechDone.current=null;onEnd();return;
  }
  const success=playVoice(text,{rate:challenge.voice.rate,pitch:challenge.voice.pitch,onEnd:()=>{
   if(serial!==speechSerial.current||closedRef.current)return;
   if(pauseRef.current)return; // resume will run the deferred transition
   pendingSpeechDone.current=null;onEnd();
  }});
  if(!success && !pauseRef.current)phaseTo('ready');
 }
 function handleReply(data:Reply){
  if(closedRef.current)return;
  setTurns(data.turn);
  setNotice(data.notice??'');
  transcriptRef.current.push({role:'character',text:data.reply,source:data.source,turn:data.turn});
  if(pauseRef.current){pendingResponseRef.current=data;return;}
  announce(data.reply,data.source,()=>{
   if(data.shouldFinish)finishNowRef.current();
   else listenRef.current();
  });
 }
 const sendTurn=useCallback(async(raw:string)=>{
  const text=raw.trim();
  if(!text||closedRef.current||pauseRef.current||!sessionRef.current||workingRef.current)return;
  workingRef.current=true;setError('');setDraft('');setTypeMode(false);
  cancelCapture();
  const next:TranscriptTurn[]=[...transcriptRef.current,{role:'user',text}];
  transcriptRef.current=next;
  setCaption(text);setSource('user');phaseTo('thinking');
  try{
   const data=await gymApi<Reply>('turn',{sessionId:sessionRef.current,text,history:next});
   if(closedRef.current)return;
   workingRef.current=false;
   handleReply(data);
  }catch(e){
   workingRef.current=false;
   if(closedRef.current)return;
   setError(e instanceof Error?e.message:'The character did not respond.');
   setNotice('Your words were heard. Try ending the session for a review, or continue with a new answer.');
   if(!pauseRef.current)phaseTo('ready');
  }
 },[cancelCapture]);
 turnRef.current=(text:string)=>{void sendTurn(text);};

 const finish=useCallback(async()=>{
  if(finishRef.current||!sessionRef.current||review)return;
  finishRef.current=true;closedRef.current=true;pauseRef.current=false;setPaused(false);
  cancelCapture();stopSpeech();phaseTo('reviewing');setError('');setNotice('');
  clockRef.current.pause();
  try{
   const response=await gymApi<{review:Review}>('finish',{
    sessionId:sessionRef.current,
    durationSeconds:clockRef.current.seconds(),
    history:transcriptRef.current
   });
   if(!mountedRef.current)return;
   setReview(response.review);phaseTo('done');
   onComplete(sessionRef.current,challenge.id,response.review);
  }catch(e){
   finishRef.current=false;closedRef.current=false;
   if(!mountedRef.current)return;
   setError(e instanceof Error?e.message:'Your review could not be saved. Please try again.');
   phaseTo('ready');
  }
 },[cancelCapture,stopSpeech,onComplete,challenge.id,review]);
 finishNowRef.current=()=>{void finish();};

 async function start(){
  if(startedRef.current||starting||!adultChecked)return;
  startedRef.current=true;setStarting(true);setError('');
  try{
   if(!adultConfirmed)await onConfirmAdult();
   const data=await gymApi<{sessionId:string;opening:string}>('start',{
    challengeId:challenge.id,transcriptConsent:saveTranscript
   });
   if(closedRef.current){
    void gymApi('abandon',{sessionId:data.sessionId}).catch(()=>{});
    return;
   }
   sessionRef.current=data.sessionId;
   clockRef.current.start();
   transcriptRef.current=[{role:'character',text:data.opening,source:'opening',turn:0}];
   setInstructions(false);setNotice('');setStarting(false);
   announce(data.opening,'opening',()=>listenRef.current());
  }catch(e){
   startedRef.current=false;setStarting(false);
   setError(e instanceof Error?e.message:'Could not start the workout.');
  }
 }
 function pauseSession(){
  if(pauseRef.current||!sessionRef.current||phaseRef.current==='done'||phaseRef.current==='reviewing')return;
  pauseRef.current=true;setPaused(true);
  pausedFromRef.current=phaseRef.current;
  clockRef.current.pause();
  if(phaseRef.current==='listening'){
   // Aborting must never submit a half-finished utterance as a complete answer.
   if(recognisedRef.current.trim()){setDraft(recognisedRef.current);setTypeMode(true);}
   cancelCapture();
  }
  if(phaseRef.current==='speaking'&&'speechSynthesis'in window)window.speechSynthesis.pause();
  phaseTo('paused');
 }
 function resumeSession(){
  if(!pauseRef.current)return;
  pauseRef.current=false;setPaused(false);
  clockRef.current.resume();
  if(pendingResponseRef.current){
   const data=pendingResponseRef.current;pendingResponseRef.current=null;
   announce(data.reply,data.source,()=>{
    if(data.shouldFinish)finishNowRef.current();
    else listenRef.current();
   });
   return;
  }
  if(pausedFromRef.current==='speaking'){
   phaseTo('speaking');
   if('speechSynthesis'in window&&window.speechSynthesis.paused){
    window.speechSynthesis.resume();
    return;
   }
   // The browser cancelled its utterance while paused. Replay the line.
   announce(lastCharacterRef.current,lastCharacterSourceRef.current,()=>listenRef.current());
   return;
  }
  if(pausedFromRef.current==='thinking'){
   phaseTo('thinking');return;
  }
  phaseTo('ready');
  if(pausedFromRef.current==='listening')
   setNotice('Your unfinished words are kept as a draft. Tap to speak again or send the draft.');
 }
 function manualListen(){
  if(paused||phaseRef.current==='reviewing'||phaseRef.current==='done'||!sessionRef.current)return;
  if(phaseRef.current==='listening'){
   recognitionRef.current?.stop();return;
  }
  if(phaseRef.current==='thinking')return;
  void listen();
 }
 function replay(){
  if(paused||!sessionRef.current||phaseRef.current==='thinking'||phaseRef.current==='reviewing')return;
  cancelCapture();stopSpeech();
  announce(lastCharacterRef.current,lastCharacterSourceRef.current,()=>{phaseTo('ready');});
 }
 function toggleMute(){
  const value=!mutedRef.current;mutedRef.current=value;setMuted(value);
  if(value&&(phaseRef.current==='speaking'||pauseRef.current)){
   stopSpeech();
   if(pauseRef.current)pausedFromRef.current='ready';
   else phaseTo('ready');
  }
 }
 async function leave(){
  closedRef.current=true;cancelCapture();stopSpeech();
  if(sessionRef.current&&!review){
   // Fire and forget is safe: the server scopes every operation to this user.
   void gymApi('abandon',{sessionId:sessionRef.current}).catch(()=>{});
  }
  onHome();
 }
 useEffect(()=>{
  const timer=window.setInterval(()=>{
   if(mountedRef.current&&sessionRef.current&&!pauseRef.current&&phaseRef.current!=='reviewing'&&phaseRef.current!=='done')
    setElapsed(activeSeconds());
  },1000);
  return()=>window.clearInterval(timer);
 },[]);
 useEffect(()=>{
  // React StrictMode mounts effects twice in development. Reset both guards
  // on each setup; otherwise the first cleanup permanently blocks start.
  mountedRef.current=true;closedRef.current=false;
  return()=>{
  mountedRef.current=false;closedRef.current=true;
  const r=recognitionRef.current;
  if(r){r.onend=null;r.onresult=null;r.onerror=null;try{r.abort();}catch{}}
  streamRef.current?.getTracks().forEach(t=>t.stop());
  if(rafRef.current!==null)cancelAnimationFrame(rafRef.current);
  if(audioContextRef.current)void audioContextRef.current.close().catch(()=>{});
  speechSerial.current++;stopVoice();
  };
 },[]);
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&instructions&&!starting)onHome();};
  document.addEventListener('keydown',key);
  return()=>document.removeEventListener('keydown',key);
 },[instructions,starting,onHome]);
 const characterName=challenge.archetype.split(' — ')[0];
 return <main className="sg-experience sg-training-v2" style={{'--accent':challenge.accent} as CSSProperties}>
  <Artwork challenge={challenge} hero/><div className="sg-experience-vignette"/>
  <header className="sg-experience-top">
   <button className="sg-back-round" onClick={()=>void leave()} aria-label="Back to Explore"><ArrowLeft size={20}/></button>
   <div className="sg-experience-title"><span>TRAINING IN PROGRESS</span><strong>{challenge.title}</strong></div>
   <span className="sg-experience-timer"><Clock3 size={16}/> {formatDuration(elapsed)}</span>
   <button className="sg-pause-button" disabled={!sessionRef.current||phase==='reviewing'||phase==='done'}
    onClick={paused?resumeSession:pauseSession} aria-label={paused?'Resume experience':'Pause experience'}>
    {paused?<Play size={16} fill="currentColor"/>:<Pause size={16} fill="currentColor"/>}
    <span>{paused?'Resume':'Pause'}</span>
   </button>
   <button className="sg-end-button" disabled={!sessionRef.current||phase==='reviewing'||phase==='done'} onClick={()=>void finish()}>
    <Square size={12} fill="currentColor"/> End & review
   </button>
  </header>
  <section className="sg-experience-center sg-stage-content" aria-live="polite">
   <div className="sg-scene-eyebrow"><span className="sg-red-dot"/>{challenge.category.replace('-',' ').toUpperCase()} / LIVE WORKOUT</div>
   <h1>{characterName}</h1>
   <p className="sg-scene-desc">{challenge.objective}</p>
   <div className={'sg-voice-orb '+phase} aria-label={'Speech status: '+phase}>
    <div className="sg-orb-layer sg-orb-layer-outer"/><div className="sg-orb-layer sg-orb-layer-mid"/>
    <div className="sg-orb-core">{paused?<Pause size={37}/>:<AudioLines size={42}/>}</div>
   </div>
   <div className="sg-speaking-status"><span className={'sg-status-light '+phase}/>
    {paused?'SESSION PAUSED':phase==='listening'?'YOUR TURN · LISTENING':phase==='thinking'?'CHARACTER IS THINKING':
    phase==='speaking'?'CHARACTER SPEAKING':phase==='reviewing'?'BUILDING YOUR REVIEW':
    phase==='done'?'WORKOUT COMPLETE':phase==='connecting'?'PREPARING THE SCENE':'READY FOR YOUR RESPONSE'}
   </div>
   <div className="sg-waveform" role="img" aria-label="Speech activity">
    {Array.from({length:29},(_,i)=><span key={i} className={phase}
     style={{height:(phase==='listening'?Math.max(6,Math.min(42,6+micLevel*(.12+Math.abs(Math.sin(i*1.3))*.36))):
      Math.max(5,Math.round(7+Math.abs(Math.sin(i*.65))*((phase==='speaking'||phase==='thinking')?27:6))))+'px',animationDelay:i*43+'ms'}}/>)}
   </div>
   {captions&&<div className="sg-live-caption sg-caption-v2" aria-label="Current conversation line">
    <span>{source==='user'?'YOU SAID':source==='guided'?'GUIDED PROMPT':source==='ai'?'AI CHARACTER':'SCENE DIALOGUE'}</span>
    <p>{caption}</p>
   </div>}
   {notice&&<div className="sg-voice-notice" role="status">{notice}</div>}
   {error&&<div className="sg-voice-error" role="alert">{error}</div>}
  </section>
  <div className="sg-experience-bottom">
   <div className="sg-experience-controls sg-controls-v2">
    <button className="sg-circle-button" aria-label={captions?'Hide captions':'Show captions'} title="Toggle captions" onClick={()=>setCaptions(!captions)}>
     <BookOpen size={19}/>
    </button>
    <button className="sg-circle-button" aria-label={muted?'Unmute character':'Mute character'} onClick={toggleMute}>
     {muted?<VolumeX size={20}/>:<Volume2 size={20}/>}
    </button>
    <button className={'sg-mic-button '+(phase==='listening'?'active':'')} aria-label={phase==='listening'?'Finish speaking':'Tap to speak'}
     disabled={!sessionRef.current||paused||phase==='thinking'||phase==='reviewing'||phase==='done'}
     onClick={manualListen}>
     {phase==='listening'?<Square size={22} fill="currentColor"/>:<Mic size={26}/>}
     <span>{phase==='listening'?'FINISH':'TAP TO SPEAK'}</span>
    </button>
    <button className="sg-circle-button" title="Replay character" aria-label="Replay character" disabled={!sessionRef.current||paused||phase==='thinking'} onClick={replay}>
     <RotateCcw size={19}/>
    </button>
    <button className="sg-circle-button" title="Type a response" aria-label="Type a response"
     disabled={!sessionRef.current||paused||phase==='thinking'||phase==='reviewing'||phase==='done'}
     onClick={()=>{cancelCapture();stopSpeech();phaseTo('ready');setTypeMode(v=>!v);}}>
     <Keyboard size={20}/>
    </button>
   </div>
   {typeMode&&<form className="sg-type-tray sg-type-v2" onSubmit={(e:FormEvent)=>{
    e.preventDefault();if(draft.trim())void sendTurn(draft);
   }}>
    <input autoFocus value={draft} maxLength={1500} onChange={e=>setDraft(e.target.value)}
     placeholder="Type your response…" aria-label="Type your response"/>
    <button disabled={!draft.trim()||paused||phase==='thinking'} aria-label="Send response"><Send size={18}/></button>
   </form>}
   <div className="sg-experience-footer sg-footer-v2">
    <span>REP {Math.min(turns+1,challenge.maxTurns)} / {challenge.maxTurns}</span>
    <div className="sg-rep-progress">{Array.from({length:challenge.maxTurns},(_,i)=><span className={i<turns?'done':''} key={i}/>)}</div>
    <span>{saveTranscript?'TRANSCRIPT SAVED TO YOUR SESSION':'TRANSCRIPT NOT SAVED'}</span>
   </div>
  </div>
  {instructions&&<div className="sg-modal-backdrop" role="presentation">
   <section className="sg-modal sg-intro-modal" role="dialog" aria-modal="true" aria-labelledby="sg-instructions-title" aria-describedby="sg-instructions-desc">
    <div className="sg-intro-hero"><Artwork challenge={challenge}/><span className="sg-intro-number">SPEECH GYM · WORKOUT</span></div>
    <div className="sg-intro-body">
     <span className="sg-eyebrow">BEFORE YOU STEP INSIDE</span>
     <h2 id="sg-instructions-title">{challenge.title}</h2>
     <p id="sg-instructions-desc">{challenge.tagline}</p>
     <div className="sg-intro-facts"><span><Clock3 size={15}/> {challenge.minutes} min</span><span>{challenge.difficulty}</span><span>{challenge.maxTurns} speaking reps</span></div>
     <div className="sg-intro-target"><span>YOUR GOAL</span><p>{challenge.objective}</p></div>
     <div className="sg-intro-how">
      <div><Headphones size={17}/><span>Listen to your fictional character.</span></div>
      <div><Mic size={17}/><span>Speak naturally. You can pause or type at any time.</span></div>
      <div><CheckCircle2 size={17}/><span>Finish for coaching, then retry to improve.</span></div>
     </div>
     <label className="sg-intro-consent"><input type="checkbox" checked={saveTranscript} onChange={e=>setSaveTranscript(e.target.checked)}/>
      <span><strong>Save this session's transcript to My Sessions</strong><small>View, copy or delete it later. No raw audio is recorded. Your browser's speech recognition and the AI service process the transcribed words.</small></span>
     </label>
     {!adultConfirmed&&<label className="sg-intro-consent"><input type="checkbox" checked={adultChecked} onChange={e=>setAdultChecked(e.target.checked)}/>
      <span><strong>I confirm I am 18 or older.</strong><small>Speech Gym is currently a private adult beta.</small></span>
     </label>}
     {error&&<div className="sg-error" role="alert">{error}</div>}
     <div className="sg-modal-actions"><button className="sg-btn sg-btn-outline" onClick={onHome} disabled={starting}>Back to Explore</button>
      <button autoFocus className="sg-btn sg-btn-primary" disabled={starting||!adultChecked} onClick={()=>void start()}>
       {starting?'Entering experience…':'Start Experience'} <ArrowRight size={17}/>
      </button>
     </div>
    </div>
   </section>
  </div>}
  {phase==='reviewing'&&<div className="sg-modal-backdrop" role="status"><div className="sg-review-processing">
   <span className="sg-orb-small"/><h2>Building your coaching review</h2><p>Looking at the words you used and the structure of your responses.</p>
  </div></div>}
  {review&&<ReviewModal title={challenge.title} review={review} turns={turns}
   duration={activeSeconds()} onRetry={onRetry} onHome={onHome}/>}
 </main>;
}
