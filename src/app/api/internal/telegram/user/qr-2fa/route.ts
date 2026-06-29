import 'dotenv/config';
import {ok, err, catchErr} from '@/lib/apiResponse';
import {telegramUserManager} from '@/lib/telegramUserManager';

function authorized(req: Request) {
  return req.headers.get('x-webhook-secret') === process.env.INTERNAL_WEBHOOK_SECRET;
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return err('Unauthorized', 401);
  }

  const body = await req.json().catch(() => null);

  if (!body?.channelId || !body?.password) {
    return err('Missing channelId or password', 400);
  }

  try {
    telegramUserManager.submitQrPassword(body.channelId, body.password);
    return ok({submitted: true});
  } catch (e: any) {
    if ((e as {status?: number}).status === 409) {
      return err(e.message, 409);
    }
    return catchErr(e);
  }
}