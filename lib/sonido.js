// Sonidos generados con Web Audio API: no dependen de ningún archivo,
// así el cartel funciona aunque la red se caiga.

let ctx = null;
let loop = null;

export function contexto() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

/** Los navegadores exigen un gesto del usuario antes de reproducir audio. */
export async function desbloquear() {
  const ac = contexto();
  if (!ac) return false;
  if (ac.state === 'suspended') await ac.resume();
  const o = ac.createOscillator();
  const g = ac.createGain();
  g.gain.value = 0.0001;
  o.connect(g).connect(ac.destination);
  o.start();
  o.stop(ac.currentTime + 0.01);
  return ac.state === 'running';
}

export const audioListo = () => Boolean(ctx && ctx.state === 'running');

function tono(ac, { freq, freqFin, inicio, dur, volumen, tipo = 'square' }) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(freq, inicio);
  if (freqFin) o.frequency.linearRampToValueAtTime(freqFin, inicio + dur);
  g.gain.setValueAtTime(0, inicio);
  g.gain.linearRampToValueAtTime(volumen, inicio + 0.012);
  g.gain.setValueAtTime(volumen, inicio + dur - 0.03);
  g.gain.linearRampToValueAtTime(0, inicio + dur);
  o.connect(g).connect(ac.destination);
  o.start(inicio);
  o.stop(inicio + dur + 0.02);
}

const PATRONES = {
  beep: (ac, t, v) => {
    tono(ac, { freq: 880, inicio: t, dur: 0.16, volumen: v });
    tono(ac, { freq: 880, inicio: t + 0.28, dur: 0.16, volumen: v });
    return 1.1;
  },
  chime: (ac, t, v) => {
    [659, 784, 1047].forEach((f, i) =>
      tono(ac, { freq: f, inicio: t + i * 0.18, dur: 0.4, volumen: v, tipo: 'sine' })
    );
    return 2.2;
  },
  siren: (ac, t, v) => {
    tono(ac, { freq: 440, freqFin: 1040, inicio: t, dur: 0.6, volumen: v * 0.8, tipo: 'sawtooth' });
    tono(ac, { freq: 1040, freqFin: 440, inicio: t + 0.6, dur: 0.6, volumen: v * 0.8, tipo: 'sawtooth' });
    return 1.3;
  },
  tick: (ac, t, v) => {
    tono(ac, { freq: 1600, inicio: t, dur: 0.05, volumen: v, tipo: 'triangle' });
    return 0.5;
  },
};

/** Reproduce un patrón en bucle durante `duracionSeg`. */
export function reproducir(patron = 'beep', volumen = 0.7, duracionSeg = 10) {
  const ac = contexto();
  if (!ac || ac.state !== 'running') return;
  detener();
  const hacer = PATRONES[patron] || PATRONES.beep;
  const fin = Date.now() + duracionSeg * 1000;
  const paso = () => {
    if (Date.now() >= fin) return detener();
    const espera = hacer(ac, ac.currentTime + 0.05, Math.min(1, volumen));
    loop = setTimeout(paso, espera * 1000);
  };
  paso();
}

export function detener() {
  if (loop) clearTimeout(loop);
  loop = null;
}
