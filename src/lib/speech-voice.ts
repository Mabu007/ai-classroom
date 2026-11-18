export type RecognitionError='not-allowed'|'service-not-allowed'|'no-speech'|'audio-capture'|'network'|'aborted'|'language-not-supported'|string;
export interface RecognitionInstance {
 lang:string;continuous:boolean;interimResults:boolean;maxAlternatives:number;
 onresult:((e:{results:ArrayLike<{isFinal:boolean;0:{transcript:string}}>;resultIndex:number})=>void)|null;
 onerror:((e:{error:RecognitionError})=>void)|null;
 onend:(()=>void)|null;
 start:()=>void;stop:()=>void;abort:()=>void;
}
type RecognitionFactory=new()=>RecognitionInstance;
export function recognitionAvailable():boolean {
 if(typeof window==='undefined')return false;
 const w=window as typeof window & {SpeechRecognition?:RecognitionFactory;webkitSpeechRecognition?:RecognitionFactory};
 return !!(w.SpeechRecognition||w.webkitSpeechRecognition);
}
export function newRecognition():RecognitionInstance|null {
 const w=window as typeof window & {SpeechRecognition?:RecognitionFactory;webkitSpeechRecognition?:RecognitionFactory};
 const Constructor=w.SpeechRecognition||w.webkitSpeechRecognition;
 if(!Constructor)return null;
 const recognition=new Constructor();
 recognition.lang='en-ZA';recognition.interimResults=true;recognition.continuous=false;recognition.maxAlternatives=1;
 return recognition;
}
export function playVoice(text:string, options:{rate?:number;pitch?:number;onEnd?:()=>void}={}) {
 if(!('speechSynthesis'in window)||typeof SpeechSynthesisUtterance==='undefined'){
  options.onEnd?.();return false;
 }
 window.speechSynthesis.cancel();
 const utterance=new SpeechSynthesisUtterance(text);
 utterance.lang='en-ZA';
 utterance.rate=options.rate??.96;utterance.pitch=options.pitch??1;
 const voices=window.speechSynthesis.getVoices();
 const voice=voices.find(x=>x.lang.toLowerCase()==='en-za')||
  voices.find(x=>x.lang.toLowerCase().startsWith('en-'))||null;
 if(voice)utterance.voice=voice;
 let finished=false;
 const done=()=>{if(!finished){finished=true;options.onEnd?.();}};
 utterance.onend=done;utterance.onerror=done;
 window.speechSynthesis.speak(utterance);
 return true;
}
export function stopVoice(){if('speechSynthesis'in window)window.speechSynthesis.cancel();}
export function microphoneError(error:string):string {
 switch(error){
  case 'not-allowed':
  case 'service-not-allowed':return 'Microphone permission was denied. Enable it in your browser site settings, or type your answer instead.';
  case 'no-speech':return 'We did not hear a clear response. Try again, or type it instead.';
  case 'audio-capture':return 'No working microphone was detected. You can use a headset or type your answer.';
  case 'network':return 'Your browser could not transcribe that speech. Check your connection or type instead.';
  case 'language-not-supported':return 'This device does not support the selected recognition language. Try typing instead.';
  default:return 'Speech recognition stopped unexpectedly. You can retry or type your answer.';
 }
}
