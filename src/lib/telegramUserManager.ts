import {Api, TelegramClient} from 'telegram';
import {StringSession} from 'telegram/sessions';
import {NewMessage} from 'telegram/events';
import type {NewMessageEvent} from 'telegram/events/NewMessage';
import prisma from '@/db';
import {encryptSession, decryptSession} from '@/lib/sessionCrypto';

interface PendingEntry {
  client: TelegramClient;
  phoneNumber: string;
  apiId: number;
  apiHash: string;
  // true after SESSION_PASSWORD_NEEDED — skip SignIn on next verify call
  need2fa: boolean;
}

class TelegramUserManager {
  private clients = new Map<string, TelegramClient>();
  private pending = new Map<string, PendingEntry>();
  private initialized = false;

  async init() {
    if (this.initialized) return;
    this.initialized = true;

    const active = await prisma.telegramUserAuth.findMany({
      where: {status: 'ACTIVE'},
      include: {channel: {select: {companyId: true}}},
    });

    for (const auth of active) {
      const raw = auth.sessionString ? decryptSession(auth.sessionString) : '';
      await this.startClient(
        auth.channelId,
        auth.channel.companyId,
        auth.apiId,
        auth.apiHash,
        raw,
      ).catch(e => console.error(`[TgUser] Failed to start ${auth.channelId}:`, e));
    }

    console.log(`[TgUser] Initialized ${this.clients.size}/${active.length} clients`);
  }

  async sendCode(channelId: string, phoneNumber: string, apiId: number, apiHash: string) {
    const session = new StringSession('');
    const client = new TelegramClient(session, apiId, apiHash, {connectionRetries: 3});
    await client.connect();

    const result = (await client.invoke(
      new Api.auth.SendCode({
        phoneNumber,
        apiId,
        apiHash,
        settings: new Api.CodeSettings({}),
      }),
    )) as Api.auth.SentCode;

    this.pending.set(channelId, {client, phoneNumber, apiId, apiHash, need2fa: false});
    return {phoneCodeHash: result.phoneCodeHash};
  }

  async verify(channelId: string, code: string, phoneCodeHash: string, password?: string) {
    const entry = this.pending.get(channelId);
    if (!entry) throw new Error('No pending auth for this channel — resend the code');

    const {client, phoneNumber, apiId, apiHash} = entry;

    // If a previous call already hit SESSION_PASSWORD_NEEDED, skip SignIn —
    // the code was consumed and calling SignIn again would throw PHONE_CODE_INVALID.
    if (!entry.need2fa) {
      try {
        await client.invoke(
          new Api.auth.SignIn({phoneNumber, phoneCodeHash, phoneCode: code}),
        );
      } catch (e: any) {
        if (e.errorMessage === 'SESSION_PASSWORD_NEEDED') {
          entry.need2fa = true;
          this.pending.set(channelId, entry);
          if (!password) return {need2fa: true as const};
        } else {
          throw e;
        }
      }
    } else if (!password) {
      return {need2fa: true as const};
    }

    if (entry.need2fa && password) {
      const passwordInfo = await client.invoke(new Api.account.GetPassword());
      const {computeCheck} = await import('telegram/Password');
      const checkPassword = await computeCheck(passwordInfo, password);
      await client.invoke(new Api.auth.CheckPassword({password: checkPassword}));
    }

    const rawSession = (client.session as StringSession).save();

    await prisma.telegramUserAuth.update({
      where: {channelId},
      data: {sessionString: encryptSession(rawSession), status: 'ACTIVE'},
    });
    await prisma.chatChannel.update({
      where: {id: channelId},
      data: {status: 'ACTIVE'},
    });

    this.pending.delete(channelId);

    const auth = await prisma.telegramUserAuth.findUnique({
      where: {channelId},
      include: {channel: {select: {companyId: true}}},
    });
    if (auth) {
      await this.startClient(channelId, auth.channel.companyId, apiId, apiHash, rawSession);
    }

    return {ok: true as const};
  }

  async startClient(
    channelId: string,
    companyId: string,
    apiId: number,
    apiHash: string,
    rawSession: string,
  ) {
    await this.stopClient(channelId);

    const session = new StringSession(rawSession);
    const client = new TelegramClient(session, apiId, apiHash, {connectionRetries: 5});
    await client.connect();

    const NEXT_URL = process.env.TG_NEXT_URL!;
    const SECRET = process.env.INTERNAL_WEBHOOK_SECRET!;

    client.addEventHandler(async (event: NewMessageEvent) => {
      const msg = event.message;
      const chatId = event.chatId?.toString();
      if (!chatId) return;

      const sender = msg.sender as any;
      const chat = msg.chat as any;
      const senderName =
        [sender?.firstName, sender?.lastName].filter(Boolean).join(' ').trim() || null;

      await fetch(`${NEXT_URL}/api/telegram/userbot/webhook/${channelId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': SECRET,
        },
        body: JSON.stringify({
          chatId,
          messageId: msg.id,
          text: msg.message ?? null,
          senderName,
          chatTitle: chat?.title ?? null,
          chatUsername: chat?.username ?? null,
          date: msg.date,
          direction: msg.out ? 'OUT' : 'IN',
        }),
      }).catch(e => console.error(`[TgUser] Webhook POST failed for ${channelId}:`, e));
    }, new NewMessage({}));

    this.clients.set(channelId, client);
    console.log(`[TgUser] Client started: ${channelId} (company: ${companyId})`);
  }

  async sendMessage(channelId: string, chatId: string, text: string) {
    const client = this.clients.get(channelId);
    if (!client) throw new Error(`No active client for channel ${channelId}`);
    const result = await client.sendMessage(chatId, {message: text});
    return {messageId: result.id, date: result.date};
  }

  async stopClient(channelId: string) {
    const client = this.clients.get(channelId);
    if (client) {
      await client.disconnect().catch(() => {});
      this.clients.delete(channelId);
      console.log(`[TgUser] Client stopped: ${channelId}`);
    }
  }

  isActive(channelId: string) {
    return this.clients.has(channelId);
  }
}

const globalForTg = globalThis as unknown as {tgUserManager: TelegramUserManager | undefined};
export const telegramUserManager =
  globalForTg.tgUserManager ?? new TelegramUserManager();
if (process.env.NODE_ENV !== 'production') {
  globalForTg.tgUserManager = telegramUserManager;
}