import { setMenuButton } from '@/lib/telegram';

const MINI_APP_URL = process.env.NEXT_PUBLIC_MINI_APP_URL;

export async function GET(req) {
  const secret = req.headers.get('x-setup-secret');
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!MINI_APP_URL) {
    return Response.json({ error: 'NEXT_PUBLIC_MINI_APP_URL not set' }, { status: 500 });
  }

  const result = await setMenuButton(MINI_APP_URL);
  return Response.json({ ok: true, result });
}
