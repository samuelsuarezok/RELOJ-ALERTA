'use client';

import { useState } from 'react';

/* Logo de la empresa. Si el archivo todavía no está en /public simplemente no
   se dibuja, así el cartel nunca muestra el ícono de imagen rota. */
export default function Marca({ className }) {
  const [falta, setFalta] = useState(false);
  if (falta) return null;

  return (
    <img
      className={className}
      src="/denso.png"
      alt="DENSO"
      onError={() => setFalta(true)}
    />
  );
}
