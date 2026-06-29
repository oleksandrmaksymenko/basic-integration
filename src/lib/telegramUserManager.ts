import 'dotenv/config';
import {Api, TelegramClient, sessions} from 'telegram';
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

interface PendingQrEntry {
  client: TelegramClient;
  abort: () => void;
  provide2fa: ((password: string) => void) | null;
  reject2fa: ((err: Error) => void) | null;
}

class TelegramUserManager {
  private clients = new Map<string, TelegramClient>();
  private pending = new Map<string, PendingEntry>();
  private pendingQr = new Map<string, PendingQrEntry>();
  private initialized = false;
  private API_ID = Number(process.env.TELEGRAM_API_ID ?? 0);
  private API_HASH  = process.env.TELEGRAM_API_HASH ?? ''

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
        this.API_ID,
        this.API_HASH,
        raw,
      ).catch(e => console.error(`[TgUser] Failed to start ${auth.channelId}:`, e));
    }

    console.log(`[TgUser] Initialized ${this.clients.size}/${active.length} clients`);
  }

  async sendCode(channelId: string, phoneNumber: string, apiId: number, apiHash: string) {
    const session = new sessions.StringSession('');
    const client = new TelegramClient(session, apiId, apiHash, {connectionRetries: 3});
    await client.connect();

    let result: Api.auth.SentCode;
    try {
      result = (await client.invoke(
        new Api.auth.SendCode({
          phoneNumber,
          apiId,
          apiHash,
          settings: new Api.CodeSettings({}),
        }),
      )) as Api.auth.SentCode;
    } catch (e: any) {
      console.error(`[TgUser] sendCode: invoke failed — ${e?.errorMessage ?? e?.message ?? e}`);
      throw e;
    }

    const codeType = result.type?.className ?? 'SentCodeTypeApp';

    this.pending.set(channelId, {client, phoneNumber, apiId: this.API_ID, apiHash: this.API_HASH, need2fa: false});
    return {phoneCodeHash: result.phoneCodeHash, codeType};
  }

  async verify(channelId: string, code: string, phoneCodeHash: string, password?: string) {
    const entry = this.pending.get(channelId);
    if (!entry) throw new Error('No pending auth for this channel — resend the code');

    const {client, phoneNumber} = entry;

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

    const rawSession = (client.session as sessions.StringSession).save();

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
      await this.startClient(channelId, auth.channel.companyId, this.API_ID, this.API_HASH, rawSession);
    }

    return {ok: true as const};
  }

  async startQrAuth(
    channelId: string,
    onToken: (url: string) => void,
    on2faNeeded: (hint: string | undefined) => void,
  ) {
    // Cancel any existing pending QR for this channel
    this.cancelQrAuth(channelId);

    const session = new sessions.StringSession('');
    const client = new TelegramClient(session, this.API_ID, this.API_HASH, {connectionRetries: 3});

    const entry: PendingQrEntry = {
      client,
      abort: () => { client.disconnect().catch(() => {}); },
      provide2fa: null,
      reject2fa: null,
    };
    this.pendingQr.set(channelId, entry);

    try {
      await client.start({
        qrCode: async (qrCode) => {
          const token = Buffer.from(qrCode.token).toString('base64url');
          onToken(`tg://login?token=${token}`);
        },
        phoneNumber: async () => { throw new Error('QR-only auth'); },
        phoneCode: async () => { throw new Error('QR-only auth'); },
        password: async (hint) => {
          on2faNeeded(hint);
          return new Promise<string>((resolve, reject) => {
            const current = this.pendingQr.get(channelId);
            if (current) {
              current.provide2fa = resolve;
              current.reject2fa = reject;
            }
          });
        },
        onError: (err: Error) => {
          console.error(`[TgUser] QR auth error for ${channelId}:`, err.message);
        },
      });
    } finally {
      this.pendingQr.delete(channelId);
    }

    const rawSession = (client.session as sessions.StringSession).save();

    const me = (await client.getMe()) as any;
    const phoneNumber = me.phone ? `+${me.phone}` : '';

    const upserted = await prisma.telegramUserAuth.upsert({
      where: {channelId},
      update: {
        sessionString: encryptSession(rawSession),
        status: 'ACTIVE',
        phoneNumber,
      },
      create: {
        channelId,
        phoneNumber,
        apiId: this.API_ID,
        apiHash: this.API_HASH,
        sessionString: encryptSession(rawSession),
        status: 'ACTIVE',
      },
      include: {channel: {select: {companyId: true}}},
    });

    await prisma.chatChannel.update({
      where: {id: channelId},
      data: {status: 'ACTIVE'},
    });

    await this.startClient(channelId, upserted.channel.companyId, this.API_ID, this.API_HASH, rawSession);
  }

  submitQrPassword(channelId: string, password: string) {
    const entry = this.pendingQr.get(channelId);
    if (!entry?.provide2fa) {
      throw Object.assign(new Error('No pending 2FA'), {status: 409});
    }
    entry.provide2fa(password);
  }

  cancelQrAuth(channelId: string) {
    const entry = this.pendingQr.get(channelId);
    if (entry) {
      entry.reject2fa?.(new Error('QR auth cancelled'));
      entry.abort();
      this.pendingQr.delete(channelId);
    }
  }

  async startClient(
    channelId: string,
    companyId: string,
    apiId: number,
    apiHash: string,
    rawSession: string,
  ) {
    await this.stopClient(channelId);

    const session = new sessions.StringSession(rawSession);
    const client = new TelegramClient(session, apiId, apiHash, {connectionRetries: 5});

    const NEXT_URL = process.env.TG_NEXT_URL!;
    const SECRET = process.env.INTERNAL_WEBHOOK_SECRET!;

    // Register handler BEFORE start() so no events are missed during init
    client.addEventHandler(async (event: NewMessageEvent) => {
      const msg = event.message;
      console.log('[TgUser] event:', event);
      const chatId = event.chatId?.toString();
      console.log(`[TgUser] NewMessage event — chatId=${chatId} out=${msg.out} text=${msg.message?.slice(0, 40)}`);
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

    // start() properly initialises the update loop (connect() alone does not).
    // With an active StringSession it skips re-auth and just begins receiving updates.
    await client.start({
      phoneNumber: async () => { throw new Error('re-auth required'); },
      phoneCode: async () => { throw new Error('re-auth required'); },
      password: async () => { throw new Error('re-auth required'); },
      onError: (err: Error) => { console.error('[TgUser] start error:', err.message); },
    });

    // Prime pts/qts update state so GramJS knows where to resume from.
    // Without this, the client silently skips events that arrived before it connected.
    await client.getDialogs({limit: 1}).catch(() => {});

    this.clients.set(channelId, client);
    console.log(`[TgUser] Client started: ${channelId} (company: ${companyId})`);
  }

  async sendMessage(channelId: string, chatId: string, text: string) {
    const client = this.clients.get(channelId);
    if (!client) throw new Error(`No active client for channel ${channelId}`);
    const result = await client.sendMessage(chatId, {message: text});
    return {messageId: result.id, date: result.date};
  }

  async startConversation(channelId: string, target: string, text: string) {
    const client = this.clients.get(channelId);
    if (!client) throw new Error(`No active client for channel ${channelId}`);

    // Resolve entity first to get name/username/chatId
    const entity = (await client.getEntity(target)) as any;
    const chatId: string = entity.id?.toString() ?? target;
    const name: string =
      [entity.firstName, entity.lastName].filter(Boolean).join(' ').trim() ||
      entity.username ||
      target;
    const username: string | null = entity.username ?? null;

    const result = await client.sendMessage(entity, {message: text});
    return {messageId: result.id, date: result.date, chatId, name, username};
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