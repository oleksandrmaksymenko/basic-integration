import { Body, Controller, Post, Query, Sse, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { InternalAuthGuard } from '../../common/guards/internal-auth.guard';
import { TelegramUserManager } from '../telegram-user.manager';
import { PrismaService } from '../../prisma/prisma.service';
import { decryptSession } from '../session-crypto';

const APP_ID = Number(process.env.TELEGRAM_API_ID ?? 0);
const APP_HASH = process.env.TELEGRAM_API_HASH ?? '';

@Controller('internal/telegram/user')
@UseGuards(InternalAuthGuard)
export class InternalTelegramController {
  constructor(
    private manager: TelegramUserManager,
    private prisma: PrismaService,
  ) {}

  @Post('send-code')
  async sendCode(@Body() body: { channelId?: string; phoneNumber?: string }) {
    if (!body?.channelId || !body?.phoneNumber)
      throw Object.assign(new Error('Missing required fields'), { status: 400 });
    try {
      return { data: await this.manager.sendCode(body.channelId, body.phoneNumber, APP_ID, APP_HASH) };
    } catch (e: any) {
      console.error('[send-code] error:', e?.errorMessage ?? e?.message ?? e);
      throw e;
    }
  }

  @Post('verify')
  async verify(@Body() body: { channelId?: string; code?: string; phoneCodeHash?: string; password?: string }) {
    if (!body?.channelId || !body?.code || !body?.phoneCodeHash)
      throw Object.assign(new Error('Missing required fields'), { status: 400 });
    try {
      return { data: await this.manager.verify(body.channelId, body.code, body.phoneCodeHash, body.password) };
    } catch (e: any) {
      const msg: string = e?.errorMessage ?? e?.message ?? 'Unknown error';
      if (msg.includes('PHONE_CODE_INVALID') || msg.includes('PHONE_CODE_EXPIRED'))
        throw Object.assign(new Error(msg), { status: 400 });
      throw e;
    }
  }

  @Post('start')
  async start(@Body() body: { channelId?: string }) {
    if (!body?.channelId) throw Object.assign(new Error('Missing channelId'), { status: 400 });
    const auth = await this.prisma.telegramUserAuth.findUnique({
      where: { channelId: body.channelId },
      include: { channel: { select: { companyId: true } } },
    });
    if (!auth?.sessionString)
      throw Object.assign(new Error('No active session found'), { status: 404 });
    const rawSession = decryptSession(auth.sessionString);
    await this.manager.startClient(auth.channelId, auth.channel.companyId, auth.apiId, auth.apiHash, rawSession);
    return { data: { started: true } };
  }

  @Post('stop')
  async stop(@Body() body: { channelId?: string }) {
    if (!body?.channelId) throw Object.assign(new Error('Missing channelId'), { status: 400 });
    await this.manager.stopClient(body.channelId);
    return { data: { stopped: true } };
  }

  @Post('message')
  async sendMessage(@Body() body: { channelId?: string; chatId?: string; text?: string }) {
    if (!body?.channelId || !body?.chatId || !body?.text)
      throw Object.assign(new Error('Missing required fields'), { status: 400 });
    try {
      return { data: await this.manager.sendMessage(body.channelId, body.chatId, body.text) };
    } catch (e: any) {
      if (e?.message?.includes('No active client'))
        throw Object.assign(new Error(e.message), { status: 409 });
      throw e;
    }
  }

  @Post('start-conversation')
  async startConversation(@Body() body: { channelId?: string; target?: string; text?: string }) {
    if (!body?.channelId || !body?.target || !body?.text)
      throw Object.assign(new Error('Missing required fields'), { status: 400 });
    try {
      return { data: await this.manager.startConversation(body.channelId, body.target, body.text) };
    } catch (e: any) {
      if (e?.message?.includes('No active client'))
        throw Object.assign(new Error(e.message), { status: 409 });
      throw e;
    }
  }

  @Sse('qr-auth')
  qrAuth(@Query('channelId') channelId: string): Observable<{data: object}> {
    if (!channelId) throw Object.assign(new Error('Missing channelId'), { status: 400 });
    return new Observable((subscriber) => {
      this.manager
        .startQrAuth(
          channelId,
          (url) => subscriber.next({ data: { type: 'qr', url } }),
          (hint) => subscriber.next({ data: { type: 'need2fa', hint: hint ?? null } }),
        )
        .then(() => {
          subscriber.next({ data: { type: 'success' } });
          subscriber.complete();
        })
        .catch((e: Error) => {
          if (!e.message.includes('cancelled'))
            subscriber.next({ data: { type: 'error', message: e.message } });
          subscriber.complete();
        });
      return () => this.manager.cancelQrAuth(channelId);
    });
  }

  @Post('qr-2fa')
  qr2fa(@Body() body: { channelId?: string; password?: string }) {
    if (!body?.channelId || !body?.password)
      throw Object.assign(new Error('Missing channelId or password'), { status: 400 });
    this.manager.submitQrPassword(body.channelId, body.password);
    return { data: { submitted: true } };
  }
}
