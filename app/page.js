'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { partes, dosDigitos, fechaLarga, claveMinuto, coincide } from '@/lib/clock';
import { DEFAULT_CONFIG } from '@/lib/defaults';
import { desbloquear, audioListo, reproducir, detener } from '@/lib/sonido';
import Marca from './marca';

const CACHE = 'reloj:config:cache';
const DISPARADAS = 'reloj:disparadas';

export default function Pantalla() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [ahora, setAhora] = useState(() => Date.now());
  const [alerta, setAlerta] = useState(null);
  const [necesitaAudio, setNecesitaAudio] = useState(false);
  const [enLinea, setEnLinea] = useState(true);

  const desfase = useRef(0);
  const configRef = useRef(config);
  const alertaRef = useRef(null);
  const disparadas = useRef(new Set());

  configRef.current = config;
  alertaRef.current = alerta;

  useEffect(() => {
    try {
      const guardada = localStorage.getItem(CACHE);
      if (guardada) setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(guardada) });
      const previas = localStorage.getItem(DISPARADAS);
      if (previas) disparadas.current = new Set(JSON.parse(previas));
    } catch {}
  }, []);

  const traerConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config', { cache: 'no-store' });
      const data = await res.json();
      if (data?.config) {
        setConfig(data.config);
        localStorage.setItem(CACHE, JSON.stringify(data.config));
      }
      if (data?.serverNow) desfase.current = data.serverNow - Date.now();
      setEnLinea(true);
    } catch {
      setEnLinea(false);
    }
  }, []);

  useEffect(() => {
    traerConfig();
    const id = setInterval(traerConfig, 20000);
    return () => clearInterval(id);
  }, [traerConfig]);

  useEffect(() => {
    const sincronizar = async () => {
      try {
        const t0 = Date.now();
        const res = await fetch('/api/time', { cache: 'no-store' });
        const { now } = await res.json();
        const viaje = (Date.now() - t0) / 2;
        desfase.current = now + viaje - Date.now();
      } catch {}
    };
    sincronizar();
    const id = setInterval(sincronizar, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now() + desfase.current), 200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const cfg = configRef.current;
    const p = partes(new Date(ahora), cfg.timezone);
    const activa = alertaRef.current;

    if (activa && ahora >= activa.hasta) {
      detener();
      setAlerta(null);
      return;
    }
    if (activa) return;

    for (const a of cfg.alerts || []) {
      if (!coincide(a, p)) continue;
      const clave = `${a.id}@${claveMinuto(p)}`;
      if (disparadas.current.has(clave)) continue;
      disparadas.current.add(clave);
      try {
        const arr = [...disparadas.current].slice(-200);
        disparadas.current = new Set(arr);
        localStorage.setItem(DISPARADAS, JSON.stringify(arr));
      } catch {}
      setAlerta({ alert: a, hasta: ahora + a.durationSec * 1000 });
      if (a.sound) {
        if (audioListo()) reproducir(a.pattern, a.volume, a.durationSec);
        else setNecesitaAudio(true);
      }
      break;
    }
  }, [ahora]);

  useEffect(() => {
    let lock = null;
    const pedir = async () => {
      try {
        if ('wakeLock' in navigator) lock = await navigator.wakeLock.request('screen');
      } catch {}
    };
    pedir();
    const alVolver = () => document.visibilityState === 'visible' && pedir();
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      document.removeEventListener('visibilitychange', alVolver);
      lock?.release?.().catch(() => {});
    };
  }, []);

  useEffect(() => {
    let vivo = true;
    const intentar = async () => {
      if (!vivo) return;
      const ok = await desbloquear();
      setNecesitaAudio(!ok);
    };
    intentar();
    const id = setInterval(intentar, 5000);
    const eventos = ['pointerdown', 'keydown', 'touchstart', 'visibilitychange'];
    eventos.forEach((e) => window.addEventListener(e, intentar));
    return () => {
      vivo = false;
      clearInterval(id);
      eventos.forEach((e) => window.removeEventListener(e, intentar));
    };
  }, []);

  const activarAudio = async () => {
    const ok = await desbloquear();
    setNecesitaAudio(!ok);
  };

  const pantallaCompleta = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const p = partes(new Date(ahora), config.timezone);
  const hayAlerta = Boolean(alerta);
  const parpadea = hayAlerta && alerta.alert.blink;
  const toma = hayAlerta && alerta.alert.takeover;
  const conMensaje = hayAlerta && Boolean(toma || alerta.alert.message);

  const estilo = {
    '--acento': config.accent,
    '--alarma': hayAlerta ? alerta.alert.color : '#ff4d3d',
  };

  return (
    <main
      className={`pantalla${hayAlerta ? ' alerta' : ''}${conMensaje ? ' con-mensaje' : ''}`}
      style={estilo}
    >
      {toma ? (
        <div className={`toma${parpadea ? ' parpadeo' : ''}`}>
          <div className="titular">{alerta.alert.message || alerta.alert.label}</div>
          <div className="hora-chica">
            <Segmentos texto={`${dosDigitos(p.hour)}:${dosDigitos(p.minute)}:${dosDigitos(p.second)}`} />
          </div>
        </div>
      ) : (
        <>
          <div className={`cartel${parpadea ? ' parpadeo' : ''}`}>
            {config.showAnalog && <Esfera p={p} />}
            <div className="lectura">
              {config.header && <div className="rotulo">{config.header}</div>}
              <div className="digitos">
                <Segmentos texto={`${dosDigitos(p.hour)}:${dosDigitos(p.minute)}`} />
                {config.showSeconds && (
                  <Segmentos className="segundos" texto={dosDigitos(p.second)} />
                )}
              </div>
              {config.showDate && (
                <div className="fecha">
                  {fechaLarga(new Date(ahora), config.timezone, config.locale)}
                </div>
              )}
            </div>
          </div>
          {hayAlerta && alerta.alert.message && (
            <div className="mensaje">{alerta.alert.message}</div>
          )}
        </>
      )}

      <div className="barra">
        <button className="chip" onClick={pantallaCompleta}>
          Pantalla completa
        </button>
        <a className="chip" href="/admin">
          Panel
        </a>
      </div>

      {necesitaAudio && (
        <button className="aviso-audio" onClick={activarAudio} title="El navegador está bloqueando el audio">
          Sonido en espera
        </button>
      )}

      {!enLinea && <div className="sin-conexion">Sin conexión · usando la última configuración</div>}

      <Marca className="logo" />
    </main>
  );
}

/* Dígitos de siete segmentos dibujados a mano, con el mismo criterio que la
   esfera y que los sonidos: sin tipografías ni archivos externos, así el cartel
   se ve igual aunque no haya red. Una fuente que no cargue degradaría a Arial
   y el reloj volvería al aspecto anterior sin que nadie se entere. */

const ANCHO_DIGITO = 100;
const ANCHO_COLON = 45;
const ALTO_DIGITO = 180;
const SEPARACION = 16;

const GRUESO = 15;
const BORDE = 5;
const CORTE = 5; // hueco en diagonal entre segmentos vecinos

const EJE_IZQ = BORDE + GRUESO / 2;
const EJE_DER = ANCHO_DIGITO - BORDE - GRUESO / 2;
const EJE_SUP = BORDE + GRUESO / 2;
const EJE_MED = ALTO_DIGITO / 2;
const EJE_INF = ALTO_DIGITO - BORDE - GRUESO / 2;

const punta = GRUESO / 2;

const acostado = (cy) => {
  const x0 = EJE_IZQ + CORTE;
  const x1 = EJE_DER - CORTE;
  return `${x0},${cy} ${x0 + punta},${cy - punta} ${x1 - punta},${cy - punta} ${x1},${cy} ${x1 - punta},${cy + punta} ${x0 + punta},${cy + punta}`;
};

const parado = (cx, arriba, abajo) => {
  const y0 = arriba + CORTE;
  const y1 = abajo - CORTE;
  return `${cx},${y0} ${cx + punta},${y0 + punta} ${cx + punta},${y1 - punta} ${cx},${y1} ${cx - punta},${y1 - punta} ${cx - punta},${y0 + punta}`;
};

const FORMAS = {
  a: acostado(EJE_SUP),
  g: acostado(EJE_MED),
  d: acostado(EJE_INF),
  f: parado(EJE_IZQ, EJE_SUP, EJE_MED),
  b: parado(EJE_DER, EJE_SUP, EJE_MED),
  e: parado(EJE_IZQ, EJE_MED, EJE_INF),
  c: parado(EJE_DER, EJE_MED, EJE_INF),
};

const ORDEN = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

const ENCENDIDOS = {
  0: 'abcdef',
  1: 'bc',
  2: 'abged',
  3: 'abgcd',
  4: 'fgbc',
  5: 'afgcd',
  6: 'afgedc',
  7: 'abc',
  8: 'abcdefg',
  9: 'abcfgd',
};

function Segmentos({ texto, className }) {
  const piezas = [];
  let x = 0;

  for (const caracter of texto) {
    if (caracter === ':') {
      piezas.push(
        <g key={piezas.length} transform={`translate(${x},0)`}>
          <circle className="punto" cx={ANCHO_COLON / 2} cy={EJE_MED - 30} r="9" />
          <circle className="punto" cx={ANCHO_COLON / 2} cy={EJE_MED + 30} r="9" />
        </g>
      );
      x += ANCHO_COLON + SEPARACION;
      continue;
    }

    const prendidos = ENCENDIDOS[caracter] || '';
    piezas.push(
      <g key={piezas.length} transform={`translate(${x},0)`}>
        {ORDEN.map((s) => (
          <polygon
            key={s}
            className={`segmento${prendidos.includes(s) ? ' prendido' : ''}`}
            points={FORMAS[s]}
          />
        ))}
      </g>
    );
    x += ANCHO_DIGITO + SEPARACION;
  }

  const ancho = Math.max(x - SEPARACION, 1);

  return (
    <svg
      className={`segmentera${className ? ` ${className}` : ''}`}
      viewBox={`0 0 ${ancho} ${ALTO_DIGITO}`}
      role="presentation"
    >
      {piezas}
    </svg>
  );
}

function Esfera({ p }) {
  const anguloHora = ((p.hour % 12) + p.minute / 60) * 30 - 90;
  const anguloMin = (p.minute + p.second / 60) * 6 - 90;
  const rad = (g) => (g * Math.PI) / 180;
  const punta = (ang, largo) => [50 + Math.cos(rad(ang)) * largo, 50 + Math.sin(rad(ang)) * largo];
  const [hx, hy] = punta(anguloHora, 22);
  const [mx, my] = punta(anguloMin, 33);

  return (
    <svg className="esfera" viewBox="0 0 100 100" aria-hidden="true">
      {Array.from({ length: 12 }, (_, i) => {
        const a = i * 30 - 90;
        const [x1, y1] = punta(a, 33);
        const [x2, y2] = punta(a, 46);
        return <line key={i} className="marca" x1={x1} y1={y1} x2={x2} y2={y2} />;
      })}
      <line className="aguja" x1="50" y1="50" x2={hx} y2={hy} strokeWidth="4" />
      <line className="aguja" x1="50" y1="50" x2={mx} y2={my} strokeWidth="2.5" />
    </svg>
  );
}
