import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
  app.enableCors({ origin: webOrigin, credentials: true });
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  Logger.log(
    `後端已就緒 → http://localhost:${port}（WebSocket namespace /planning-poker）`,
    'Bootstrap',
  );
}
bootstrap();
