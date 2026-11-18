import { auth } from './firebase';
export async function classroomApi<T = unknown>(action: string, args: Record<string, unknown> = {}): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in first.');
  const token = await user.getIdToken();
  const response = await fetch('/api/classroom', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...args })
  });
  const data: unknown = await response.json();
  if (!response.ok) throw new Error((data as {error?:string}).error ?? `Request failed (${response.status}).`);
  return data as T;
}
