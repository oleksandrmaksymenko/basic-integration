import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppExceptionFilter } from './common/filters/app-exception.filter';

async function bootstrap() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalFilters(new AppExceptionFilter());

  const port = process.env.PORT ?? 3002;
  await app.listen(port);
  console.log(`Server listening on port ${port}`);
}

bootstrap();
