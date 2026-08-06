import { readConfig, writeConfig, kvEnabled } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CLAVE = process.env.ADMIN_PASSWORD || 'cambiame';

export async function GET() {
  const config = await readConfig();
  return Response.json(
    { config, storage: kvEnabled ? 'kv' : 'memoria', serverNow: Date.now() },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(request) {
  if (request.headers.get('x-admin-key') !== CLAVE) {
    return Response.json({ error: 'Clave incorrecta' }, { status: 401 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }
  try {
    const config = await writeConfig(body.config);
    return Response.json({ config, storage: kvEnabled ? 'kv' : 'memoria' });
  } catch (err) {
    return Response.json(
      { error: `No se pudo guardar: ${err.message}` },
      { status: 500 }
    );
  }
}
