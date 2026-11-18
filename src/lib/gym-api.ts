import {auth} from './firebase';
export class GymApiError extends Error {
 constructor(message:string,public status:number){super(message);this.name='GymApiError';}
}
export async function gymApi<T=unknown>(action:string,args:Record<string,unknown>={}):Promise<T>{
 const user=auth.currentUser;
 if(!user)throw new GymApiError('Sign in to continue.',401);
 const token=await user.getIdToken();
 const controller=new AbortController();
 const timer=window.setTimeout(()=>controller.abort(),28000);
 try{
  const response=await fetch('/api/speech-gym',{
   method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
   body:JSON.stringify({action,...args}),signal:controller.signal
  });
  const data:unknown=await response.json().catch(()=>null);
  if(!response.ok)throw new GymApiError(
   data&&typeof data==='object'&&'error'in data?String((data as {error:unknown}).error):'Something went wrong. Try again.',
   response.status);
  return data as T;
 }catch(e){
  if(e instanceof GymApiError)throw e;
  throw new GymApiError(e instanceof Error&&e.name==='AbortError'
   ?'The request timed out. Check your connection and retry.'
   :'Unable to reach Speech Gym. Check your connection and retry.',0);
 }finally{window.clearTimeout(timer);}
}
