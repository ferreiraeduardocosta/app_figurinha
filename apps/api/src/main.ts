import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const porta = Number(process.env.PORT ?? 3000);
  await app.listen(porta);
  console.log(`API da Liga Aurora em http://localhost:${porta}`);
}

bootstrap();
