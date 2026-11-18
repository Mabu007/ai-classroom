import {useEffect,useRef} from 'react';
import {Check,RotateCcw,Sparkles,ArrowRight,Home,Trophy} from 'lucide-react';
import type {Review} from '../lib/speech-types';
import {formatDuration} from '../lib/speech-types';

export default function ReviewModal({review,title,turns,duration,onRetry,onHome}:{
 review:Review;title:string;turns:number;duration:number;
 onRetry:()=>void;onHome:()=>void
}){
 const focusRef=useRef<HTMLButtonElement>(null);
 useEffect(()=>{focusRef.current?.focus();},[]);
 return <div className="sg-modal-backdrop sg-review-backdrop" role="presentation">
  <section className="sg-modal sg-review-modal" role="dialog" aria-modal="true"
   aria-label="Workout review" aria-describedby="review-summary">
   <div className="sg-review-modal-header"><span className="sg-eyebrow"><Trophy size={15}/> WORKOUT COMPLETE</span>
    <h2>Every rep <em>counts.</em></h2>
    <p id="review-summary">{title} · {turns} responses · {formatDuration(duration)} practice</p>
    <span className="sg-review-source">{review.source==='ai_transcript_review'?'AI-ASSISTED TRANSCRIPT REVIEW':'TRANSCRIPT-BASED OBSERVATIONS'}</span>
   </div>
   <div className="sg-review-modal-results">
    <article className="sg-feedback-card"><span className="sg-feedback-no">01 / STRENGTH</span>
     <span className="sg-feedback-symbol sg-positive"><Check size={21}/></span>
     <h3>What you did well</h3><p>{review.strength}</p>
    </article>
    <article className="sg-feedback-card"><span className="sg-feedback-no">02 / SHARPEN</span>
     <span className="sg-feedback-symbol sg-warning"><Sparkles size={21}/></span>
     <h3>What to improve</h3><p>{review.improvement}</p>
    </article>
    <article className="sg-feedback-card sg-feedback-next"><span className="sg-feedback-no">03 / YOUR NEXT REP</span>
     <span className="sg-feedback-symbol"><RotateCcw size={21}/></span>
     <h3>Your next rep</h3><p>{review.nextRep}</p>
    </article>
   </div>
   <p className="sg-review-modal-disclaimer">{review.disclaimer}</p>
   <div className="sg-modal-actions"><button className="sg-btn sg-btn-outline" onClick={onHome}><Home size={17}/> Go home</button>
    <button ref={focusRef} className="sg-btn sg-btn-primary" onClick={onRetry}><RotateCcw size={17}/> Retry challenge <ArrowRight size={16}/></button>
   </div>
  </section>
 </div>;
}
