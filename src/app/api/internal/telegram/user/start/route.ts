import {ok, err, catchErr} from '@/lib/apiResponse';
import {telegramUserManager} from '@/lib/telegramUserManager';
import prisma from '@/db';
import {decryptSession} from '@/lib/sessionCrypto';

function authorized(req: Request) {
  return req.headers.get('x-webhook-secret') === process.env.INTERNAL_WEBHOOK_SECRET;
}

export async function POST(req: Request) {
  if (!authorized(req)) return err('Unauthorized', 401);

  const body = await req.json().catch(() => null);
  if (!body?.channelId) return err('Missing channelId', 400);

  try {
    await telegramUserManager.init();

    const auth = await prisma.telegramUserAuth.findUnique({
      where: {channelId: body.channelId},
      include: {channel: {select: {companyId: true}}},
    });
    if (!auth || !auth.sessionString) return err('No active session found', 404);

    const rawSession = decryptSession(auth.sessionString);
    await telegramUserManager.startClient(
      auth.channelId,
      auth.channel.companyId,
      auth.apiId,
      auth.apiHash,
      rawSession,
    );

    return ok({started: true});
  } catch (e) {
    return catchErr(e);
  }
}
