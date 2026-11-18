import React from 'react';
import {createRoot} from 'react-dom/client';
import './styles/speech.css';
type FirebaseWebConfig={apiKey:string;authDomain:string;projectId:string;appId:string};
type RuntimeGlobal=typeof globalThis&{__AI_CLASSROOM_FIREBASE_CONFIG__?:FirebaseWebConfig};
const root=createRoot(document.getElementById('root')!);
async function boot(){
 try{
  let config:FirebaseWebConfig={
   apiKey:import.meta.env.VITE_FIREBASE_API_KEY??'',
   authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN??'',
   projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID??'',
   appId:import.meta.env.VITE_FIREBASE_APP_ID??''
  };
  if(!Object.values(config).every(Boolean)){
   const response=await fetch('/api/firebase-config',{cache:'no-store'});
   if(!response.ok)throw new Error('Firebase web configuration unavailable');
   config=await response.json() as FirebaseWebConfig;
  }
  if(!Object.values(config).every(Boolean))throw new Error('Incomplete authentication configuration');
  (globalThis as RuntimeGlobal).__AI_CLASSROOM_FIREBASE_CONFIG__=config;
  const {default:App}=await import('./App');
  root.render(<React.StrictMode><App/></React.StrictMode>);
 }catch(err){
  console.error('Speech Gym bootstrap failed:',err instanceof Error?err.name:'unknown');
  root.render(<main className="bootstrap-error"><h1>Unable to open Speech Gym</h1><p>We couldn’t connect to authentication right now.</p><button onClick={()=>location.reload()}>Try again</button></main>);
 }
}
void boot();
