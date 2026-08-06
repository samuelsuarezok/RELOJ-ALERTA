import './globals.css';

export const metadata = {
  title: 'Reloj y alertas',
  description: 'Cartel horario con alertas programadas',
};

export const viewport = {
  themeColor: '#06080b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
