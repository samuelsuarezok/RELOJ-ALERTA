// Utilidades de tiempo. Todo se calcula sobre la zona horaria configurada,
// así el cartel muestra la hora correcta sin importar dónde corra el navegador.

const cache = new Map();

function formatter(timezone, options) {
  const key = timezone + JSON.stringify(options);
  if (!cache.has(key)) {
    cache.set(key, new Intl.DateTimeFormat('en-US', { timeZone: timezone, ...options }));
  }
  return cache.get(key);
}

const DIAS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** Descompone una fecha en partes según la zona horaria indicada. */
export function partes(date, timezone) {
  let fmt;
  try {
    fmt = formatter(timezone, {
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
  } catch {
    fmt = formatter('UTC', {
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
  }
  const p = {};
  for (const { type, value } of fmt.formatToParts(date)) p[type] = value;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    second: Number(p.second),
    weekday: DIAS.indexOf(String(p.weekday).toLowerCase().slice(0, 3)),
  };
}

export const dosDigitos = (n) => String(n).padStart(2, '0');

/** "martes, 28/7/2026" */
export function fechaLarga(date, timezone, locale) {
  const p = partes(date, timezone);
  let dia = '';
  try {
    dia = new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      weekday: 'long',
    }).format(date);
  } catch {
    dia = '';
  }
  return `${dia}, ${p.day}/${p.month}/${p.year}`;
}

export const claveMinuto = (p) =>
  `${p.year}${dosDigitos(p.month)}${dosDigitos(p.day)}-${dosDigitos(p.hour)}${dosDigitos(p.minute)}`;

/** ¿Esta alerta debe sonar en este preciso minuto y segundo cero? */
export function coincide(alert, p) {
  if (!alert.enabled) return false;
  if (!alert.days.includes(p.weekday)) return false;
  const [h, m] = alert.time.split(':').map(Number);
  return p.hour === h && p.minute === m;
}

export const NOMBRE_DIAS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

export const ZONAS = [
  'America/Argentina/Buenos_Aires',
  'America/Santiago',
  'America/Montevideo',
  'America/Sao_Paulo',
  'America/Bogota',
  'America/Lima',
  'America/Mexico_City',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/Madrid',
  'Europe/London',
  'UTC',
];
