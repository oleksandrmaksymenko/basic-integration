import {NextRequest} from 'next/server';
import {randomUUID} from 'node:crypto';
import prisma from '@/db';

function authorized(req: NextRequest) {
  return req.headers.get('x-webhook-secret') === process.env.INTERNAL_WEBHOOK_SECRET;
}

export async function POST(
  req: NextRequest,
  {params}: {params: Promise<{channelId: string}>},
) {
  if (!authorized(req)) {
    return Response.json({message: 'Unauthorized'}, {status: 401});
  }

  const {channelId} = await params;

  const body = await req.json().catch(() => null) as {
    chatId: string;
    messageId: number;
    text: string | null;
    senderName: string | null;
    chatTitle: string | null;
    chatUsername: string | null;
    date: number;
    direction: 'IN' | 'OUT';
  } | null;

  if (!body?.chatId || body.messageId == null) {
    return Response.json({message: 'Missing required fields'}, {status: 400});
  }

  const channel = await prisma.chatChannel.findUnique({where: {id: channelId}});
  if (!channel) {
    return Response.json({message: 'Channel not found'}, {status: 404});
  }

  const externalDate = body.date ? new Date(body.date * 1000) : new Date();

  const conversation = await prisma.conversations.upsert({
    where: {channelId_externalChatId: {channelId, externalChatId: body.chatId}},
    create: {
      id: randomUUID(),
      channelId,
      companyId: channel.companyId,
      externalChatId: body.chatId,
      title: body.chatTitle ?? body.senderName ?? null,
      username: body.chatUsername ?? null,
      lastMessageAt: externalDate,
      unreadCount: body.direction === 'IN' ? 1 : 0,
      lastInboundAt: body.direction === 'IN' ? externalDate : null,
    },
    update: {
      lastMessageAt: externalDate,
      ...(body.chatTitle && {title: body.chatTitle}),
      ...(body.chatUsername && {username: body.chatUsername}),
      ...(body.direction === 'IN' && {
        unreadCount: {increment: 1},
        lastInboundAt: externalDate,
      }),
    },
  });

  await prisma.chatMessages.upsert({
    where: {
      conversationId_externalMessageId: {
        conversationId: conversation.id,
        externalMessageId: String(body.messageId),
      },
    },
    create: {
      id: randomUUID(),
      conversationId: conversation.id,
      externalMessageId: String(body.messageId),
      direction: body.direction,
      text: body.text ?? null,
      senderName: body.senderName ?? null,
      externalDate,
    },
    update: {},
  });

  return Response.json({ok: true});
}