import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { TelegramModule } from './telegram/telegram.module';

@Module({
  imports: [PrismaModule, TelegramModule],
  controllers: [HealthController],
})
export class AppModule {}
