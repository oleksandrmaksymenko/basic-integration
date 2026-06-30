import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { InternalAuthGuard } from '../../common/guards/internal-auth.guard';

interface WebhookBody {
  chatId?: string;
  messageId?: number;
  text?: string | null;
  senderName?: string | null;
  chatTitle?: string | null;
  chatUsername?: string | null;
  date?: number;
  direction?: 'IN' | 'OUT';
}

@Controller('telegram/userbot/webhook')
@UseGuards(InternalAuthGuard)
export class UserbotController {
  constructor(private prisma: PrismaService) {}

  @Post(':channelId')
  async handleWebhook(@Param('channelId') channelId: string, @Body() body: WebhookBody) {
    if (!body?.chatId || body.messageId == null)
      throw Object.assign(new Error('Missing required fields'), { status: 400 });

    const channel = await this.prisma.chatChannel.findUnique({ where: { id: channelId } });
    if (!channel) throw Object.assign(new Error('Channel not found'), { status: 404 });

    const externalDate = body.date ? new Date(body.date * 1000) : new Date();

    const conversation = await this.prisma.conversations.upsert({
      where: { channelId_externalChatId: { channelId, externalChatId: body.chatId } },
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
        ...(body.chatTitle && { title: body.chatTitle }),
        ...(body.chatUsername && { username: body.chatUsername }),
        ...(body.direction === 'IN' && {
          unreadCount: { increment: 1 },
          lastInboundAt: externalDate,
        }),
      },
    });

    await this.prisma.chatMessages.upsert({
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
        direction: body.direction ?? 'IN',
        text: body.text ?? null,
        senderName: body.senderName ?? null,
        externalDate,
      },
      update: {},
    });

    return { ok: true };
  }
}
