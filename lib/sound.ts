let context: AudioContext | undefined;
let volume = .45;
let lastHover = 0;
export function setSoundVolume(value: number) { volume = Math.max(0, Math.min(1, value)); }

export function unlockSound() {
  try { context ??= new AudioContext(); void context.resume().catch(() => {}); } catch {}
}
export function playSound(kind: 'draw' | 'item' | 'burst' | 'win' | 'turn' | 'hover' | 'cardHover' | 'click') {
  if (!volume || !context || context.state !== 'running') return;
  if (kind === 'hover' || kind === 'cardHover') { if (performance.now() - lastHover < 55) return; lastHover = performance.now(); }
  const soft = kind === 'hover' || kind === 'cardHover';
  const duration = soft ? .055 : kind === 'click' ? .10 : .24;
  const notes = {draw:[540,760], item:[440,660,880], burst:[180,120,65], win:[523,659,784,1047], turn:[660,880], hover:[1000], cardHover:[740,960], click:[480,720]}[kind];
  notes.forEach((frequency, i) => {
    const oscillator = context!.createOscillator(), gain = context!.createGain();
    const start = context!.currentTime + i * (kind === 'win' ? .16 : .09);
    oscillator.type = kind === 'burst' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume * (soft ? .025 : .10), start + .008);
    gain.gain.exponentialRampToValueAtTime(.001, start + duration);
    oscillator.connect(gain); gain.connect(context!.destination);
    oscillator.start(start); oscillator.stop(start + duration + .01);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  });
}
