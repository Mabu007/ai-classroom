export function countWords(text) {
  return typeof text==='string' ? (text.trim().match(/\b[\p{L}\p{N}']+\b/gu) ?? []).length : 0;
}
export function sanitizeConversation(turns) {
  if(!Array.isArray(turns))return [];
  return turns.slice(-14).filter(t=>t&&typeof t==='object'&&['user','character'].includes(t.role)&&typeof t.text==='string')
   .map(t=>({role:t.role,text:t.text.trim().slice(0,1200)}))
   .filter(t=>t.text.length>0);
}
export function guidedFollowUp(challenge,turnIndex) {
  const beat=challenge.beats[Math.min(Math.max(0,turnIndex),challenge.beats.length-1)];
  const starts=[
    'I hear you. Take that a little further.',
    'Interesting. Now let us test the idea.',
    'That gives us a starting point.',
    'Stay with me for one more question.'
  ];
  const prompt = turnIndex>=5 ? 'Give me your strongest closing sentence.'
    : 'Try this next: '+beat+'. What would you say?';
  return starts[turnIndex%starts.length]+' '+prompt;
}
export function deterministicReview(challenge,userTurns) {
  const answers=(Array.isArray(userTurns)?userTurns:[]).filter(t=>typeof t==='string'&&t.trim()).map(s=>s.trim().slice(0,1200));
  const totalWords=answers.reduce((sum,t)=>sum+countWords(t),0);
  const lengths=answers.map(countWords);
  const long=lengths.filter(n=>n>=25).length;
  const short=lengths.filter(n=>n<12).length;
  const questions=answers.filter(s=>/[?？]/.test(s)).length;
  let strength,improvement,nextRep;
  if(!answers.length){
    strength='You entered the experience and made space for practice.';
    improvement='There is no spoken response to assess yet.';
    nextRep='Try the challenge again and give at least one complete spoken answer.';
  }else if(short>=Math.ceil(answers.length/2)){
    strength='You made '+answers.length+' response'+(answers.length===1?'':'s')+' instead of avoiding the interaction.';
    improvement='Several responses were short. Develop one point with a reason and a concrete example.';
    nextRep='Retry. For your first answer, use three sentences: your point, why it matters, and an example.';
  }else if(long>=1){
    strength='You gave '+long+' developed response'+(long===1?'':'s')+' of at least 25 words.';
    improvement=questions===0 && ['conversations','negotiation'].includes(challenge.category)
      ? 'Try asking a genuine follow-up question before moving to your next point.'
      : 'Make the main point unmistakable early, then support it with one specific example.';
    nextRep=questions===0 && ['conversations','negotiation'].includes(challenge.category)
      ? 'Retry and include two genuine follow-up questions about what the character says.'
      : 'Retry with a one-sentence opening claim, one supporting example, and a clear close.';
  }else{
    strength='You contributed '+answers.length+' responses with '+totalWords+' transcribed words in total.';
    improvement='Your answers could benefit from stronger structure and one specific example.';
    nextRep='Retry and build your next reply in the order: point, reason, example.';
  }
  return {strength,improvement,nextRep,source:'transcript_heuristic',dimensions:challenge.rubric.slice(0,3),evidence:{
    turns:answers.length,words:totalWords,questions,developedAnswers:long
  },disclaimer:'Feedback is based on speech-to-text content, not audio acoustics, accent, intelligence or objective confidence.'};
}
export function validateAIReview(candidate,challenge,userTurns) {
  if(!candidate||typeof candidate!=='object')return null;
  for(const key of ['strength','improvement','nextRep']){
    if(typeof candidate[key]!=='string'||candidate[key].length<20||candidate[key].length>400)return null;
  }
  // Model-generated quotations are not trusted; do not display unverifiable quote fields.
  const base=deterministicReview(challenge,userTurns);
  return {...base,strength:candidate.strength,improvement:candidate.improvement,nextRep:candidate.nextRep,source:'ai_transcript_review'};
}
