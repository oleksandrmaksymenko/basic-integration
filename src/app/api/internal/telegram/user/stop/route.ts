import {ok, err, catchErr} from '@/lib/apiResponse';
import {telegramUserManager} from '@/lib/telegramUserManager';

function authorized(req: Request) {
  return req.headers.get('x-webhook-secret') === process.env.INTERNAL_WEBHOOK_SECRET;
}

export async function POST(req: Request) {
  if (!authorized(req)) return err('Unauthorized', 401);

  const body = await req.json().catch(() => null);
  if (!body?.channelId) return err('Missing channelId', 400);

  try {
    await telegramUserManager.init();
    await telegramUserManager.stopClient(body.channelId);
    return ok({stopped: true});
  } catch (e) {
    return catchErr(e);
  }
}
