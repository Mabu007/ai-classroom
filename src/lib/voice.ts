export function speak(text: string, onEnd?: () => void) {
  if (!('speechSynthesis' in window)) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = .94; utterance.pitch = 1.02; utterance.lang = 'en-ZA';
  utterance.onend = () => onEnd?.(); utterance.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utterance);
}
export function stopSpeech() { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }
