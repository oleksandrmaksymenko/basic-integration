import 'dotenv/config';
import {telegramUserManager} from '@/lib/telegramUserManager';

function authorized(req: Request) {
  return req.headers.get('x-webhook-secret') === process.env.INTERNAL_WEBHOOK_SECRET;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return new Response(JSON.stringify({message: 'Unauthorized'}), {status: 401});
  }

  const channelId = new URL(req.url).searchParams.get('channelId');
  if (!channelId) {
    return new Response(JSON.stringify({message: 'Missing channelId'}), {status: 400});
  }

  await telegramUserManager.init();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      function enqueue(payload: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      }

      telegramUserManager
        .startQrAuth(
          channelId,
          (url) => { enqueue({type: 'qr', url}); },
          (hint) => { enqueue({type: 'need2fa', hint: hint ?? null}); },
        )
        .then(() => {
          enqueue({type: 'success'});
          controller.close();
        })
        .catch((e: Error) => {
          if (!e.message.includes('cancelled')) {
            enqueue({type: 'error', message: e.message});
          }
          controller.close();
        });
    },
    cancel() {
      telegramUserManager.cancelQrAuth(channelId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}