/**
 * Lightweight client grouping: challenge -> chronological attempts.
 * Does not combine transcripts, because every attempt is independently owned.
 */
export function groupSessionsByChallenge(sessions) {
 const map=new Map();
 for(const raw of Array.isArray(sessions)?sessions:[]){
  if(!raw||typeof raw.challengeId!=='string'||typeof raw.id!=='string')continue;
  if(!map.has(raw.challengeId))map.set(raw.challengeId,[]);
  map.get(raw.challengeId).push(raw);
 }
 return [...map.entries()].map(([challengeId,attempts])=>({
  challengeId,
  attempts:attempts.sort((a,b)=>Number(b.startedAt||0)-Number(a.startedAt||0)),
  lastPractised:Math.max(...attempts.map(s=>Number(s.startedAt||0)),0),
  completed:attempts.filter(s=>s.status==='completed').length
 })).sort((a,b)=>b.lastPractised-a.lastPractised);
}
export function transcriptAsText(challengeTitle,session){
 const lines=[challengeTitle,'Speech Gym · Session transcript',''];
 for(const t of Array.isArray(session?.transcript)?session.transcript:[]){
  if(!t||typeof t.text!=='string')continue;
  lines.push((t.role==='user'?'YOU':'CHARACTER')+(t.source==='guided'?' (GUIDED PROMPT)':'')+': '+t.text);
  lines.push('');
 }
 return lines.join('\n').trim();
}
