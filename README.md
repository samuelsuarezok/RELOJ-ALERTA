# Reloj y alertas

Cartel horario para pantalla fija, con panel para programar alertas que hacen
parpadear el reloj y suenan a la hora indicada. Next.js, pensado para Vercel.

- `/` — la pantalla. Es lo que va en el televisor.
- `/admin` — el panel para cargar y editar las alertas.

## Cómo funciona

La pantalla toma la configuración de `/api/config` al abrirse y la vuelve a
pedir cada 20 segundos, así los cambios del panel llegan solos sin tocar el
televisor. También guarda una copia en el navegador: si se corta internet, el
reloj y las alertas siguen funcionando con la última configuración conocida.

La hora se calcula sobre la zona horaria elegida en el panel, no sobre la del
equipo, y se sincroniza contra el servidor cada 10 minutos para que no se
desfase con el correr de los días.

## Desplegar en Vercel

1. Subí esta carpeta a un repositorio de GitHub.
2. En Vercel: **Add New → Project**, importá el repo. Next.js se detecta solo,
   no hay que cambiar nada en la configuración de build.
3. En **Settings → Environment Variables** agregá `ADMIN_PASSWORD` con la clave
   del panel.
4. Para que las alertas se guarden de forma permanente, andá a la pestaña
   **Storage** del proyecto, creá una base **Upstash Redis (Vercel KV)** y
   conectala. Vercel escribe `KV_REST_API_URL` y `KV_REST_API_TOKEN` solo.
5. **Redeploy** y listo.

Sin la base conectada el sistema igual funciona, pero guarda en memoria y los
cambios se pierden cuando el servidor se recicla. El panel avisa cuando está en
ese modo.

## Correr en tu máquina

```bash
npm install
npm run dev
```

Abrí http://localhost:3000 y http://localhost:3000/admin. La clave por defecto
es `cambiame`; cambiala en un archivo `.env.local` (mirá `.env.example`).

## El televisor

Abrí `/` en el navegador del equipo y tocá **Pantalla completa**. La página pide
un *wake lock* para que la pantalla no se apague sola.

**Sonido:** los navegadores no dejan reproducir audio hasta que alguien toca la
página. La primera vez aparece un botón para activarlo; con un toque queda
habilitado mientras la pestaña siga abierta. Si el equipo se reinicia solo,
conviene abrir Chrome con `--autoplay-policy=no-user-gesture-required` para
saltear ese paso.

Para que arranque solo después de un corte de luz, lo más simple es dejar el
navegador en modo kiosco al inicio de sesión:

```bash
chromium --kiosk --autoplay-policy=no-user-gesture-required https://TU-APP.vercel.app/
```

## Alertas

Cada alerta tiene hora, días de la semana, duración y color. Podés combinar:

- **Parpadear** — el reloj late en el color de la alerta.
- **Ocupar toda la pantalla** — reemplaza el reloj por el mensaje en grande.
- **Sonido** — bip doble, campanada, sirena o clic, con volumen regulable.
  Se generan por código, no dependen de ningún archivo ni de la red.

El botón **Escuchar** del panel prueba el sonido antes de guardar.

La franja de 24 horas arriba de todo muestra dónde cae cada alerta en el día y
por dónde va la hora actual; sirve para ver de un vistazo si dos quedaron muy
pegadas.
