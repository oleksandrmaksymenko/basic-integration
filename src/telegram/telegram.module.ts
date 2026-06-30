import { Module } from '@nestjs/common';
import { TelegramUserManager } from './telegram-user.manager';
import { InternalTelegramController } from './internal/internal-telegram.controller';
import { UserbotController } from './userbot/userbot.controller';

@Module({
  controllers: [InternalTelegramController, UserbotController],
  providers: [TelegramUserManager],
})
export class TelegramModule {}
