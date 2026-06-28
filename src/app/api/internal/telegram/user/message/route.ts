import {ok, err, catchErr} from '@/lib/apiResponse';
import {telegramUserManager} from '@/lib/telegramUserManager';

function authorized(req: Request) {
  return req.headers.get('x-webhook-secret') === process.env.INTERNAL_WEBHOOK_SECRET;
}

export async function POST(req: Request) {
  if (!authorized(req)) return err('Unauthorized', 401);

  const body = await req.json().catch(() => null);
  if (!body?.channelId || !body?.chatId || !body?.text) {
    return err('Missing required fields', 400);
  }

  try {
    await telegramUserManager.init();
    const result = await telegramUserManager.sendMessage(body.channelId, body.chatId, body.text);
    return ok(result);
  } catch (e: any) {
    if (e?.message?.includes('No active client')) return err(e.message, 409);
    return catchErr(e);
  }
}
