'use client';

import { useState } from 'react';

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
