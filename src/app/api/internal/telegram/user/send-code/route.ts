import {ok, err, catchErr} from '@/lib/apiResponse';
import {telegramUserManager} from '@/lib/telegramUserManager';

function authorized(req: Request) {
  return req.headers.get('x-webhook-secret') === process.env.INTERNAL_WEBHOOK_SECRET;
}

export async function POST(req: Request) {
  if (!authorized(req)) return err('Unauthorized', 401);

  const body = await req.json().catch(() => null);
  if (!body?.channelId || !body?.phoneNumber || !body?.apiId || !body?.apiHash) {
    return err('Missing required fields', 400);
  }

  try {
    await telegramUserManager.init();
    const result = await telegramUserManager.sendCode(
      body.channelId,
      body.phoneNumber,
      Number(body.apiId),
      body.apiHash,
    );
    return ok(result);
  } catch (e) {
    return catchErr(e);
  }
}
