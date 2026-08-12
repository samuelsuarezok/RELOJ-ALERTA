/* Convierte el blanco de un PNG en transparencia, para que el logo se apoye
   sobre el fondo negro del cartel sin el recuadro blanco.

   Uso:  node scripts/quitar-fondo.mjs <entrada.png> [salida.png]

   No usa dependencias: decodifica el PNG con el zlib de Node, calcula el alfa
   de cada píxel a partir de cuánto se aleja del blanco y desmultiplica el color
   para que los bordes suavizados queden limpios. */

import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

const FIRMA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/* ── CRC32, necesario para escribir los trozos del PNG ── */
const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABLA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/* ── Lectura ── */
function leerTrozos(buf) {
  if (!buf.subarray(0, 8).equals(FIRMA)) throw new Error('El archivo no es un PNG.');
  const trozos = [];
  let i = 8;
  while (i < buf.length) {
    const largo = buf.readUInt32BE(i);
    const tipo = buf.toString('ascii', i + 4, i + 8);
    trozos.push({ tipo, datos: buf.subarray(i + 8, i + 8 + largo) });
    i += 12 + largo;
  }
  return trozos;
}

function desfiltrar(cruda, ancho, alto, canales) {
  const paso = ancho * canales;
  const salida = Buffer.alloc(paso * alto);
  let previa = Buffer.alloc(paso);

  for (let y = 0; y < alto; y++) {
    const filtro = cruda[y * (paso + 1)];
    const fila = cruda.subarray(y * (paso + 1) + 1, (y + 1) * (paso + 1));
    const actual = salida.subarray(y * paso, (y + 1) * paso);

    for (let x = 0; x < paso; x++) {
      const a = x >= canales ? actual[x - canales] : 0;
      const b = previa[x];
      const c = x >= canales ? previa[x - canales] : 0;
      let v = fila[x];
      switch (filtro) {
        case 0: break;
        case 1: v += a; break;
        case 2: v += b; break;
        case 3: v += (a + b) >> 1; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          break;
        }
        default: throw new Error(`Filtro PNG desconocido: ${filtro}`);
      }
      actual[x] = v & 0xff;
    }
    previa = actual;
  }
  return salida;
}

function aRGBA(buf) {
  const trozos = leerTrozos(buf);
  const ihdr = trozos.find((t) => t.tipo === 'IHDR');
  if (!ihdr) throw new Error('PNG sin IHDR.');

  const ancho = ihdr.datos.readUInt32BE(0);
  const alto = ihdr.datos.readUInt32BE(4);
  const bits = ihdr.datos[8];
  const tipoColor = ihdr.datos[9];
  const entrelazado = ihdr.datos[12];

  if (bits !== 8) throw new Error(`Solo se admiten PNG de 8 bits por canal (este es de ${bits}).`);
  if (entrelazado) throw new Error('No se admiten PNG entrelazados (Adam7).');

  const canalesPorTipo = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const canales = canalesPorTipo[tipoColor];
  if (!canales) throw new Error(`Tipo de color PNG no admitido: ${tipoColor}`);

  const idat = Buffer.concat(trozos.filter((t) => t.tipo === 'IDAT').map((t) => t.datos));
  const plano = desfiltrar(inflateSync(idat), ancho, alto, canales);

  const paleta = trozos.find((t) => t.tipo === 'PLTE')?.datos;
  const trns = trozos.find((t) => t.tipo === 'tRNS')?.datos;

  const rgba = Buffer.alloc(ancho * alto * 4);
  for (let i = 0, n = ancho * alto; i < n; i++) {
    const s = i * canales;
    const d = i * 4;
    let r, g, b, a = 255;
    switch (tipoColor) {
      case 0: r = g = b = plano[s]; break;
      case 2: [r, g, b] = [plano[s], plano[s + 1], plano[s + 2]]; break;
      case 3: {
        const idx = plano[s];
        if (!paleta) throw new Error('PNG con paleta pero sin PLTE.');
        [r, g, b] = [paleta[idx * 3], paleta[idx * 3 + 1], paleta[idx * 3 + 2]];
        if (trns && idx < trns.length) a = trns[idx];
        break;
      }
      case 4: r = g = b = plano[s]; a = plano[s + 1]; break;
      case 6: [r, g, b, a] = [plano[s], plano[s + 1], plano[s + 2], plano[s + 3]]; break;
    }
    rgba[d] = r; rgba[d + 1] = g; rgba[d + 2] = b; rgba[d + 3] = a;
  }
  return { ancho, alto, rgba };
}

/* ── Blanco → transparente ──
   El alfa sale de cuánto se aparta el píxel del blanco: el blanco puro
   desaparece, el rojo pleno queda opaco y los bordes suavizados conservan un
   alfa intermedio con el color desmultiplicado. */
function blancoATransparente(rgba, umbral) {
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] === 0) continue;
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    const min = Math.min(r, g, b);
    if (min >= umbral) {
      rgba[i + 3] = 0;
      continue;
    }
    const alfa = 255 - min;
    rgba[i] = Math.min(255, Math.round(255 - ((255 - r) * 255) / alfa));
    rgba[i + 1] = Math.min(255, Math.round(255 - ((255 - g) * 255) / alfa));
    rgba[i + 2] = Math.min(255, Math.round(255 - ((255 - b) * 255) / alfa));
    rgba[i + 3] = Math.round((alfa * rgba[i + 3]) / 255);
  }
}

/* ── Recorte del margen transparente, para que el logo llene su caja ── */
function recortar({ ancho, alto, rgba }) {
  let x0 = ancho, y0 = alto, x1 = -1, y1 = -1;
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      if (rgba[(y * ancho + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return { ancho, alto, rgba };

  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const salida = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    rgba.copy(salida, y * w * 4, ((y + y0) * ancho + x0) * 4, ((y + y0) * ancho + x1 + 1) * 4);
  }
  return { ancho: w, alto: h, rgba: salida };
}

/* ── Escritura ── */
function trozo(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

function escribirPNG({ ancho, alto, rgba }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8;   // bits por canal
  ihdr[9] = 6;   // RGBA
  ihdr[10] = 0;  // compresión
  ihdr[11] = 0;  // filtro
  ihdr[12] = 0;  // sin entrelazado

  const paso = ancho * 4;
  const cruda = Buffer.alloc((paso + 1) * alto);
  for (let y = 0; y < alto; y++) {
    cruda[y * (paso + 1)] = 0; // sin filtro
    rgba.copy(cruda, y * (paso + 1) + 1, y * paso, (y + 1) * paso);
  }

  return Buffer.concat([
    FIRMA,
    trozo('IHDR', ihdr),
    trozo('IDAT', deflateSync(cruda, { level: 9 })),
    trozo('IEND', Buffer.alloc(0)),
  ]);
}

/* ── Programa ── */
const [entrada, salida = entrada.replace(/\.png$/i, '') + '-transparente.png'] =
  process.argv.slice(2);

if (!entrada) {
  console.error('Uso: node scripts/quitar-fondo.mjs <entrada.png> [salida.png]');
  process.exit(1);
}

const UMBRAL = Number(process.env.UMBRAL || 246); // 0-255: qué tan claro cuenta como fondo

const imagen = aRGBA(readFileSync(entrada));
blancoATransparente(imagen.rgba, UMBRAL);
const recortada = recortar(imagen);
writeFileSync(salida, escribirPNG(recortada));

console.log(
  `${entrada} (${imagen.ancho}×${imagen.alto}) → ${salida} (${recortada.ancho}×${recortada.alto}), fondo transparente.`
);
