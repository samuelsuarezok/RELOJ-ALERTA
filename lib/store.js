const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const KEY = 'reloj:config:v1';

export const kvEnabled = Boolean(KV_URL && KV_TOKEN);

export { DEFAULT_CONFIG } from './defaults';
import { DEFAULT_CONFIG } from './defaults';

async function redis(command) {
  const res = await fetch(KV_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`KV ${res.status}`);
  const data = await res.json();
  return data.result;
}

globalThis.__relojMemoria = globalThis.__relojMemoria || null;

export async function readConfig() {
  if (!kvEnabled) {
    return globalThis.__relojMemoria || DEFAULT_CONFIG;
  }
  try {
    const raw = await redis(['GET', KEY]);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch (err) {
    console.error('No se pudo leer la configuración:', err.message);
    return globalThis.__relojMemoria || DEFAULT_CONFIG;
  }
}

export async function writeConfig(config) {
  const clean = sanitize(config);
  globalThis.__relojMemoria = clean;
  if (kvEnabled) {
    await redis(['SET', KEY, JSON.stringify(clean)]);
  }
  return clean;
}

const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

function sanitize(input) {
  const c = { ...DEFAULT_CONFIG, ...(input || {}) };
  const alerts = Array.isArray(c.alerts) ? c.alerts : [];
  return {
    timezone: String(c.timezone || DEFAULT_CONFIG.timezone),
    locale: String(c.locale || DEFAULT_CONFIG.locale),
    accent: String(c.accent || DEFAULT_CONFIG.accent).slice(0, 9),
    showSeconds: Boolean(c.showSeconds),
    showAnalog: Boolean(c.showAnalog),
    showDate: Boolean(c.showDate),
    header: String(c.header || '').slice(0, 60),
    alerts: alerts.slice(0, 100).map((a, i) => ({
      id: String(a.id || `a-${Date.now()}-${i}`),
      label: String(a.label || 'Alerta').slice(0, 60),
      enabled: Boolean(a.enabled),
      time: HORA.test(a.time) ? a.time : '00:00',
      days: Array.isArray(a.days)
        ? [...new Set(a.days.map(Number).filter((d) => d >= 0 && d <= 6))].sort()
        : [0, 1, 2, 3, 4, 5, 6],
      durationSec: Math.min(600, Math.max(1, Number(a.durationSec) || 20)),
      blink: Boolean(a.blink),
      takeover: Boolean(a.takeover),
      message: String(a.message || '').slice(0, 120),
      color: String(a.color || '#FF4D3D').slice(0, 9),
      sound: Boolean(a.sound),
      pattern: ['beep', 'chime', 'siren', 'tick'].includes(a.pattern)
        ? a.pattern
        : 'beep',
      volume: Math.min(1, Math.max(0, Number(a.volume) ?? 0.7)),
    })),
  };
}
