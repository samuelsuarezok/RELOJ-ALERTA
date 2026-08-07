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

**Sonido: el navegador tiene que abrirse en modo kiosco.** Por defecto los
navegadores bloquean el audio hasta que alguien toca la página, y un monitor
colgado en altura no lo toca nadie. Abriéndolo con la bandera de abajo el sonido
queda habilitado desde el arranque, sin intervención:

```bash
chromium --kiosk --autoplay-policy=no-user-gesture-required https://TU-APP.vercel.app/
```

Dejá ese comando en el arranque de sesión del equipo y el cartel vuelve solo
después de un corte de luz, con sonido y todo.

La pantalla reintenta habilitar el audio sola cada 5 segundos. Si aun así el
navegador lo bloquea (porque se abrió a mano, sin la bandera), aparece abajo a la
derecha una marca chica que dice *Sonido en espera*: con un toque en cualquier
parte de la pantalla queda habilitado. En modo kiosco esa marca nunca se ve.

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
