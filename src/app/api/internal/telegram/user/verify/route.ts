import {ok, err, catchErr} from '@/lib/apiResponse';
import {telegramUserManager} from '@/lib/telegramUserManager';

function authorized(req: Request) {
  return req.headers.get('x-webhook-secret') === process.env.INTERNAL_WEBHOOK_SECRET;
}

export async function POST(req: Request) {
  if (!authorized(req)) return err('Unauthorized', 401);

  const body = await req.json().catch(() => null);
  if (!body?.channelId || !body?.code || !body?.phoneCodeHash) {
    return err('Missing required fields', 400);
  }

  try {
    await telegramUserManager.init();
    const result = await telegramUserManager.verify(
      body.channelId,
      body.code,
      body.phoneCodeHash,
      body.password,
    );
    return ok(result);
  } catch (e: any) {
    const msg: string = e?.errorMessage ?? e?.message ?? 'Unknown error';
    if (msg.includes('PHONE_CODE_INVALID') || msg.includes('PHONE_CODE_EXPIRED')) {
      return err(msg, 400);
    }
    return catchErr(e);
  }
}
