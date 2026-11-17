import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  // Origens liberadas para o app rodando no navegador (Expo web) em desenvolvimento.
  const origens = process.env.CORS_ORIGENS?.split(',').map((o) => o.trim()).filter(Boolean);
  if (origens?.length) app.enableCors({ origin: origens });
  const porta = Number(process.env.PORT ?? 3000);
  await app.listen(porta);
  console.log(`API da Liga Aurora em http://localhost:${porta}`);
}

bootstrap();
