'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { partes, dosDigitos, NOMBRE_DIAS, ZONAS } from '@/lib/clock';
import { desbloquear, reproducir, detener } from '@/lib/sonido';

const PATRONES = [
  ['beep', 'Bip doble'],
  ['chime', 'Campanada'],
  ['siren', 'Sirena'],
  ['tick', 'Clic corto'],
];

const COLORES = [
  ['#FF4D3D', 'Rojo'],
  ['#F2A93B', 'Ámbar'],
  ['#7FE9DC', 'Menta'],
  ['#5B4BE8', 'Violeta'],
];

export default function Panel() {
  const [clave, setClave] = useState('');
  const [autorizado, setAutorizado] = useState(false);
  const [config, setConfig] = useState(null);
  const [almacen, setAlmacen] = useState('');
  const [estado, setEstado] = useState({ texto: '', tipo: '' });
  const [guardando, setGuardando] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());
  const [abiertas, setAbiertas] = useState({});
  const [verAjustes, setVerAjustes] = useState(false);
  const original = useRef('');

  useEffect(() => {
    const g = sessionStorage.getItem('reloj:clave');
    if (g) {
      setClave(g);
      setAutorizado(true);
    }
    fetch('/api/config', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setConfig(d.config);
        setAlmacen(d.storage);
        original.current = JSON.stringify(d.config);
      })
      .catch(() => setEstado({ texto: 'No se pudo cargar la configuración', tipo: 'mal' }));
  }, []);

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const sucio = useMemo(
    () => Boolean(config) && JSON.stringify(config) !== original.current,
    [config]
  );

  if (!autorizado) {
    return (
      <form
        className="acceso"
        onSubmit={(e) => {
          e.preventDefault();
          sessionStorage.setItem('reloj:clave', clave);
          setAutorizado(true);
        }}
      >
        <div className="eyebrow" style={{ margin: 0 }}>Acceso</div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Panel del cartel</h1>
        <label className="campo">
          Clave
          <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoFocus />
        </label>
        <button className="btn primario" type="submit">Entrar</button>
        <a className="chip" href="/" style={{ textAlign: 'center' }}>Ver la pantalla</a>
      </form>
    );
  }

  if (!config) return <div className="consola">Cargando…</div>;

  const set = (parche) => setConfig((c) => ({ ...c, ...parche }));
  const setAlerta = (id, parche) =>
    setConfig((c) => ({
      ...c,
      alerts: c.alerts.map((a) => (a.id === id ? { ...a, ...parche } : a)),
    }));

  const agregar = () => {
    const id = `a-${Date.now()}`;
    setConfig((c) => ({
      ...c,
      alerts: [
        ...c.alerts,
        {
          id,
          label: 'Alerta nueva',
          enabled: true,
          time: '09:00',
          days: [1, 2, 3, 4, 5],
          durationSec: 20,
          blink: true,
          takeover: false,
          message: '',
          color: '#FF4D3D',
          sound: true,
          pattern: 'beep',
          volume: 0.7,
        },
      ],
    }));
    setAbiertas((a) => ({ ...a, [id]: true }));
  };

  const borrar = (id) => {
    if (!confirm('¿Eliminar esta alerta?')) return;
    setConfig((c) => ({ ...c, alerts: c.alerts.filter((a) => a.id !== id) }));
  };

  const probar = async (a) => {
    await desbloquear();
    reproducir(a.pattern, a.volume, Math.min(5, a.durationSec));
  };

  const guardar = async () => {
    setGuardando(true);
    setEstado({ texto: '', tipo: '' });
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': clave },
        body: JSON.stringify({ config }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');
      setConfig(data.config);
      original.current = JSON.stringify(data.config);
      setEstado({ texto: 'Guardado · la pantalla se actualiza en 20 s', tipo: 'ok' });
    } catch (err) {
      setEstado({ texto: err.message, tipo: 'mal' });
      if (/clave/i.test(err.message)) {
        sessionStorage.removeItem('reloj:clave');
        setAutorizado(false);
      }
    } finally {
      setGuardando(false);
    }
  };

  const p = partes(new Date(ahora), config.timezone);
  const posAhora = ((p.hour * 60 + p.minute) / 1440) * 100;
  const resumenDias = (days) => {
    if (days.length === 7) return 'Todos los días';
    if (days.join() === '1,2,3,4,5') return 'Lunes a viernes';
    if (days.join() === '0,6') return 'Fines de semana';
    return days.map((d) => NOMBRE_DIAS[d]).join(' ');
  };

  return (
    <div className="consola" style={{ '--acento': config.accent }}>
      <header className="tapa">
        <div>
          <div className="via">Panel de control</div>
          <h1>Reloj y alertas</h1>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="via">
            {dosDigitos(p.hour)}:{dosDigitos(p.minute)}:{dosDigitos(p.second)}
          </div>
          <a className="chip" href="/" style={{ marginTop: 8, display: 'inline-block' }}>
            Ver la pantalla
          </a>
        </div>
      </header>

      {almacen === 'memoria' && (
        <p className="nota">
          Los cambios se están guardando en memoria: al reiniciar el servidor se pierden.
          Conectá una base Vercel KV al proyecto para que persistan.
        </p>
      )}

      <div className="eyebrow">El día completo</div>
      <div className="franja">
        {Array.from({ length: 25 }, (_, h) => (
          <div key={h}>
            <div className="hora-marca" style={{ left: `${(h / 24) * 100}%` }} />
            {h % 3 === 0 && h < 24 && (
              <div className="hora-num" style={{ left: `${(h / 24) * 100}%` }}>{dosDigitos(h)}</div>
            )}
          </div>
        ))}
        {config.alerts.map((a) => {
          const [hh, mm] = a.time.split(':').map(Number);
          return (
            <div
              key={a.id}
              className={`pin${a.enabled ? '' : ' apagada'}`}
              style={{ left: `${((hh * 60 + mm) / 1440) * 100}%`, background: a.color }}
              title={`${a.time} · ${a.label}`}
            />
          );
        })}
        <div className="ahora" style={{ left: `${posAhora}%` }} />
      </div>

      <div className="eyebrow">Alertas</div>

      {config.alerts.length === 0 && (
        <p className="nota">Todavía no hay alertas. Agregá la primera con el botón de abajo.</p>
      )}

      {config.alerts.map((a) => {
        const abierta = abiertas[a.id];
        return (
          <section key={a.id} className={`tarjeta${a.enabled ? '' : ' off'}`}>
            <div className="resumen" onClick={() => setAbiertas((s) => ({ ...s, [a.id]: !abierta }))}>
              <label className="interruptor" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={a.enabled}
                  onChange={(e) => setAlerta(a.id, { enabled: e.target.checked })}
                />
              </label>
              <span className="resumen-nombre">{a.label}</span>
              <span className="resumen-dias">{resumenDias(a.days)}</span>
              <span className="resumen-hora" style={{ color: a.color }}>{a.time}</span>
              <span className="flecha">{abierta ? '▲' : '▼'}</span>
            </div>

            {abierta && (
              <div className="detalle">
                <div className="grilla">
                  <label className="campo">
                    Nombre
                    <input
                      type="text"
                      value={a.label}
                      onChange={(e) => setAlerta(a.id, { label: e.target.value })}
                    />
                  </label>
                  <label className="campo">
                    Hora
                    <input
                      type="time"
                      className="hora-grande"
                      value={a.time}
                      onChange={(e) => setAlerta(a.id, { time: e.target.value })}
                    />
                  </label>
                  <label className="campo">
                    Dura (segundos)
                    <input
                      type="number"
                      min="1"
                      max="600"
                      value={a.durationSec}
                      onChange={(e) => setAlerta(a.id, { durationSec: Number(e.target.value) })}
                    />
                  </label>
                </div>

                <div className="campo" style={{ marginTop: 16 }}>
                  Días
                  <div className="dias">
                    {NOMBRE_DIAS.map((n, i) => (
                      <button
                        key={i}
                        type="button"
                        className="dia"
                        aria-pressed={a.days.includes(i)}
                        onClick={() =>
                          setAlerta(a.id, {
                            days: a.days.includes(i)
                              ? a.days.filter((d) => d !== i)
                              : [...a.days, i].sort(),
                          })
                        }
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grilla" style={{ marginTop: 16 }}>
                  <label className="campo">
                    Mensaje en pantalla
                    <input
                      type="text"
                      placeholder="Opcional"
                      value={a.message}
                      onChange={(e) => setAlerta(a.id, { message: e.target.value })}
                    />
                  </label>
                  <label className="campo">
                    Cómo avisa
                    <select
                      value={a.takeover ? 'completa' : 'parpadeo'}
                      onChange={(e) =>
                        setAlerta(a.id, {
                          takeover: e.target.value === 'completa',
                          blink: true,
                        })
                      }
                    >
                      <option value="parpadeo">El reloj parpadea</option>
                      <option value="completa">Ocupa toda la pantalla</option>
                    </select>
                  </label>
                  <label className="campo">
                    Sonido
                    <select
                      value={a.sound ? a.pattern : 'ninguno'}
                      onChange={(e) =>
                        setAlerta(a.id, {
                          sound: e.target.value !== 'ninguno',
                          pattern: e.target.value === 'ninguno' ? a.pattern : e.target.value,
                        })
                      }
                    >
                      <option value="ninguno">Sin sonido</option>
                      {PATRONES.map(([v, n]) => (
                        <option key={v} value={v}>{n}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="campo" style={{ marginTop: 16 }}>
                  Color
                  <div className="colores">
                    {COLORES.map(([hex, nombre]) => (
                      <button
                        key={hex}
                        type="button"
                        className="muestra"
                        aria-pressed={a.color.toUpperCase() === hex}
                        style={{ background: hex }}
                        title={nombre}
                        onClick={() => setAlerta(a.id, { color: hex })}
                      />
                    ))}
                  </div>
                </div>

                <div className="fila" style={{ marginTop: 20 }}>
                  <button className="btn" type="button" onClick={() => probar(a)} disabled={!a.sound}>
                    Escuchar
                  </button>
                  <button className="btn" type="button" onClick={detener} disabled={!a.sound}>
                    Cortar
                  </button>
                  <button
                    className="btn peligro"
                    type="button"
                    style={{ marginLeft: 'auto' }}
                    onClick={() => borrar(a.id)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            )}
          </section>
        );
      })}

      <button className="btn agregar" type="button" onClick={agregar}>
        + Agregar alerta
      </button>

      <button className="desplegar" type="button" onClick={() => setVerAjustes(!verAjustes)}>
        {verAjustes ? '▲' : '▼'} Ajustes de la pantalla
      </button>

      {verAjustes && (
        <div style={{ marginTop: 16 }}>
          <div className="grilla">
            <label className="campo">
              Zona horaria
              <select value={config.timezone} onChange={(e) => set({ timezone: e.target.value })}>
                {ZONAS.map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </label>
            <label className="campo">
              Texto arriba de la hora
              <input
                type="text"
                placeholder="Opcional"
                value={config.header}
                onChange={(e) => set({ header: e.target.value })}
              />
            </label>
            <div className="campo">
              Color de los dígitos
              <div className="fila">
                <input
                  type="color"
                  value={config.accent}
                  onChange={(e) => set({ accent: e.target.value })}
                />
                <input
                  type="text"
                  value={config.accent}
                  onChange={(e) => set({ accent: e.target.value })}
                />
              </div>
            </div>
          </div>
          <div className="fila" style={{ marginTop: 18 }}>
            <label className="interruptor">
              <input
                type="checkbox"
                checked={config.showSeconds}
                onChange={(e) => set({ showSeconds: e.target.checked })}
              />
              Segundos
            </label>
            <label className="interruptor">
              <input
                type="checkbox"
                checked={config.showAnalog}
                onChange={(e) => set({ showAnalog: e.target.checked })}
              />
              Reloj de agujas
            </label>
            <label className="interruptor">
              <input
                type="checkbox"
                checked={config.showDate}
                onChange={(e) => set({ showDate: e.target.checked })}
              />
              Fecha
            </label>
          </div>
        </div>
      )}

      <div className="guardar">
        <button className="btn primario" onClick={guardar} disabled={guardando || !sucio}>
          {guardando ? 'Guardando…' : sucio ? 'Guardar cambios' : 'Sin cambios'}
        </button>
        {sucio && (
          <button className="btn" onClick={() => setConfig(JSON.parse(original.current))}>
            Descartar
          </button>
        )}
        {estado.texto && <span className={`estado ${estado.tipo}`}>{estado.texto}</span>}
      </div>
    </div>
  );
}
