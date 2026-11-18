import {useEffect,useMemo,useState} from 'react';
import {ArrowRight,BookOpen,ChevronDown,ChevronRight,Clipboard,Clock3,Download,FileText,Headphones,RotateCcw,Trash2,X} from 'lucide-react';
import {challengeById} from '../../shared/catalog.mjs';
import {groupSessionsByChallenge,transcriptAsText} from '../../shared/session-history.mjs';
import type {Session,TranscriptTurn} from '../lib/speech-types';
import {formatDuration} from '../lib/speech-types';
import {gymApi} from '../lib/gym-api';
import Artwork from './Artwork';

type Props={
 sessions:Session[];onRetry:(id:string)=>void;onDelete:(id:string)=>Promise<void>;
 onRefresh:()=>void;onHistoryChange:()=>Promise<void>;
};
export default function MySessions({sessions,onRetry,onDelete,onRefresh,onHistoryChange}:Props){
 const groups=useMemo(()=>groupSessionsByChallenge(sessions),[sessions]);
 const [expanded,setExpanded]=useState<Record<string,boolean>>({});
 const [selected,setSelected]=useState<Session|null>(null);
 const [detail,setDetail]=useState<Session|null>(null);
 const [activeTab,setActiveTab]=useState<'transcript'|'review'|'info'>('transcript');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 useEffect(()=>{
  const close=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!busy){setSelected(null);setDetail(null);}};
  document.addEventListener('keydown',close);
  return()=>document.removeEventListener('keydown',close);
 },[busy]);
 useEffect(()=>{
  if(!groups.length)return;
  setExpanded(old=>Object.keys(old).length?old:{[groups[0].challengeId]:true});
 },[groups]);
 async function openSession(item:Session){
  setSelected(item);setDetail(null);setError('');setNotice('');setActiveTab('transcript');setBusy(true);
  try{
   const response=await gymApi<{session:Session}>('sessionDetail',{sessionId:item.id});
   setDetail(response.session);
  }catch(e){setError(e instanceof Error?e.message:'Unable to open session resources.');}
  finally{setBusy(false);}
 }
 async function removeSession(item:Session){
  if(!window.confirm('Permanently delete this attempt, its feedback and saved transcript?'))return;
  setBusy(true);setError('');
  try{
   await onDelete(item.id);
   setSelected(null);setDetail(null);
  }catch(e){setError(e instanceof Error?e.message:'Unable to delete this session.');}
  finally{setBusy(false);}
 }
 async function removeTranscript(){
  if(!detail||!window.confirm('Delete the saved transcript for this attempt? Coaching and session statistics will remain.'))return;
  setBusy(true);setError('');
  try{
   await gymApi('deleteTranscript',{sessionId:detail.id});
   setDetail(d=>d?{...d,transcript:[],hasTranscript:false,transcriptConsent:false}:d);
   setNotice('Transcript deleted. Your coaching notes are still saved.');
   await onHistoryChange();
  }catch(e){setError(e instanceof Error?e.message:'Unable to delete transcript.');}
  finally{setBusy(false);}
 }
 async function copyTranscript(){
  if(!detail)return;
  const c=challengeById(detail.challengeId);
  try{
   await navigator.clipboard.writeText(transcriptAsText(c?.title??'Speech Gym',detail));
   setNotice('Transcript copied to clipboard.');
  }catch{setError('Copy is unavailable in this browser. Select the transcript text instead.');}
 }
 function downloadTranscript(){
  if(!detail)return;
  const c=challengeById(detail.challengeId);
  const blob=new Blob([transcriptAsText(c?.title??'Speech Gym',detail)],{type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=(detail.challengeId+'-'+detail.id.slice(0,8)+'-transcript.txt');
  document.body.appendChild(a);a.click();a.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 const completed=sessions.filter(s=>s.status==='completed');
 return <main className="sg-content-page sg-history-page">
  <div className="sg-page-heading"><span className="sg-eyebrow">YOUR TRAINING JOURNAL</span><h1>My Sessions<span>.</span></h1>
   <p>All your attempts, organized by challenge. Open any session to view coaching notes and saved transcripts.</p>
  </div>
  <div className="sg-session-stats">
   <div><strong>{completed.length}</strong><span>Completed workouts</span></div>
   <div><strong>{groups.length}</strong><span>Challenges trained</span></div>
   <div><strong>{Math.floor(sessions.reduce((sum,s)=>sum+s.durationSeconds,0)/60)}m</strong><span>Practice time</span></div>
  </div>
  {!groups.length?<div className="sg-empty-state"><Headphones size={38}/>
   <h2>Your first rep awaits.</h2><p>Choose a challenge and start speaking. Your history will appear here.</p>
   <button className="sg-btn sg-btn-primary" onClick={onRefresh}>Explore challenges <ArrowRight size={16}/></button>
  </div>:<div className="sg-history-groups">
   {groups.map((group,index)=>{
    const challenge=challengeById(group.challengeId);
    if(!challenge)return null;
    const isExpanded=expanded[group.challengeId]??(index===0);
    return <section className="sg-history-group" key={group.challengeId}>
     <div className="sg-history-group-header">
      <div className="sg-history-art"><Artwork challenge={challenge}/></div>
      <div className="sg-history-heading"><span>{challenge.difficulty.toUpperCase()} · {challenge.category.replace('-',' ').toUpperCase()}</span>
       <h2>{challenge.title}</h2><p>{group.attempts.length} session{group.attempts.length===1?'':'s'} · {group.completed} completed</p>
      </div>
      <button className="sg-history-group-toggle" aria-expanded={isExpanded}
       onClick={()=>setExpanded(old=>({...old,[group.challengeId]:!isExpanded}))}>
       {isExpanded?'Hide attempts':'View attempts'} {isExpanded?<ChevronDown size={18}/>:<ChevronRight size={18}/>}
      </button>
      <button className="sg-btn sg-btn-primary sg-history-retry" onClick={()=>onRetry(group.challengeId)}>
       <RotateCcw size={15}/> New rep
      </button>
     </div>
     {isExpanded&&<div className="sg-attempt-list">
      {group.attempts.map((item,i)=><div className="sg-attempt-row" key={item.id}>
       <div className="sg-attempt-number">{String(group.attempts.length-i).padStart(2,'0')}</div>
       <div className="sg-attempt-info"><strong>{new Date(item.startedAt||Date.now()).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})}</strong>
        <div><span><Clock3 size={13}/> {formatDuration(item.durationSeconds)}</span>
         <span>{item.turnsCount} replies</span>
         {item.hasTranscript&&<span><FileText size={13}/> Transcript saved</span>}
        </div>
       </div>
       <span className={'sg-attempt-status '+(item.status==='completed'?'completed':'')}>{item.status==='completed'?'Completed':item.status==='abandoned'?'Exited early':item.paused?'Paused':Date.now()-item.startedAt>24*60*60_000?'Interrupted':'In progress'}</span>
       <button className="sg-btn sg-btn-outline sg-attempt-view" onClick={()=>void openSession(item)}>
        <BookOpen size={15}/> View resources
       </button>
       <button className="sg-attempt-delete" title="Delete this session" aria-label="Delete attempt" onClick={()=>void removeSession(item)}><Trash2 size={18}/></button>
      </div>)}
     </div>}
    </section>;
   })}
  </div>}
  {selected&&<div className="sg-modal-backdrop sg-session-backdrop" role="presentation">
   <section className="sg-modal sg-session-modal" role="dialog" aria-modal="true" aria-label="Session resources">
    <header className="sg-session-modal-header">
     <div><span className="sg-eyebrow">TRAINING RESOURCES</span>
      <h2>{challengeById(selected.challengeId)?.title??'Your session'}</h2>
      <p>{new Date(selected.startedAt||Date.now()).toLocaleString(undefined,{dateStyle:'long',timeStyle:'short'})}</p>
     </div>
     <button className="sg-modal-close" onClick={()=>{setSelected(null);setDetail(null);}} aria-label="Close session details"><X size={21}/></button>
    </header>
    {error&&<div className="sg-error" role="alert">{error}</div>}
    {notice&&<div className="sg-notice" role="status">{notice}</div>}
    {busy&&!detail?<p className="sg-session-loading">Loading your session securely…</p>:detail&&<>
     <div className="sg-resource-tabs" role="tablist" aria-label="Resources">
      <button role="tab" aria-selected={activeTab==='transcript'} className={activeTab==='transcript'?'active':''} onClick={()=>setActiveTab('transcript')}><FileText size={16}/> Transcript</button>
      <button role="tab" aria-selected={activeTab==='review'} className={activeTab==='review'?'active':''} onClick={()=>setActiveTab('review')}><BookOpen size={16}/> Coaching</button>
      <button role="tab" aria-selected={activeTab==='info'} className={activeTab==='info'?'active':''} onClick={()=>setActiveTab('info')}><Clock3 size={16}/> Details</button>
     </div>
     <div className="sg-resource-content">
      {activeTab==='transcript'&&(!detail.transcript?.length?
       <div className="sg-resource-empty"><FileText size={30}/><h3>No transcript was saved</h3>
        <p>For new experiences, choose Save transcript on the instructions screen. Previously unsaved speech cannot be reconstructed.</p>
       </div>:
       <><div className="sg-resource-toolbar"><span>{detail.transcript.length} dialogue entries · text only, no audio</span>
        <div><button disabled={busy} onClick={()=>void copyTranscript()}><Clipboard size={15}/> Copy</button>
         <button disabled={busy} onClick={downloadTranscript}><Download size={15}/> Download</button>
         <button className="danger" disabled={busy} onClick={()=>void removeTranscript()}><Trash2 size={15}/> Delete transcript</button></div>
       </div>
       <div className="sg-transcript-log">
        {detail.transcript.map((t:TranscriptTurn,i)=><div className={'sg-transcript-entry '+(t.role==='user'?'user':'character')} key={i}>
         <span>{t.role==='user'?'YOU':t.source==='guided'?'CHARACTER · GUIDED PROMPT':'CHARACTER'}</span>
         <p>{t.text}</p>
        </div>)}
       </div></>)}
      {activeTab==='review'&&(!detail.review?
       <div className="sg-resource-empty"><BookOpen size={30}/><h3>No coaching review yet</h3>
        <p>This attempt ended before a coaching review was completed.</p></div>:
       <div className="sg-resource-coaching">
        <article><span>WHAT WENT WELL</span><p>{detail.review.strength}</p></article>
        <article><span>WHAT TO IMPROVE</span><p>{detail.review.improvement}</p></article>
        <article><span>YOUR NEXT REP</span><p>{detail.review.nextRep}</p></article>
        <small>{detail.review.disclaimer}</small>
       </div>)}
      {activeTab==='info'&&<div className="sg-session-metadata">
       <div><span>Status</span><strong>{detail.status}</strong></div>
       <div><span>Session version</span><strong>v{detail.challengeVersion}</strong></div>
       <div><span>Practice time</span><strong>{formatDuration(detail.durationSeconds)}</strong></div>
       <div><span>Speaking responses</span><strong>{detail.turnsCount}</strong></div>
       <div><span>Raw audio</span><strong>Not stored</strong></div>
       <div><span>Transcript</span><strong>{detail.transcript?.length?'Saved':'Not stored'}</strong></div>
      </div>}
     </div>
     <footer className="sg-session-modal-actions">
      <button className="sg-btn sg-btn-outline sg-session-danger" disabled={busy} onClick={()=>void removeSession(detail)}><Trash2 size={16}/> Delete session</button>
      <button className="sg-btn sg-btn-primary" onClick={()=>onRetry(detail.challengeId)}><RotateCcw size={16}/> Retry challenge <ArrowRight size={16}/></button>
     </footer>
    </>}
   </section>
  </div>}
 </main>;
}
