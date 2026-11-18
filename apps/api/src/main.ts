import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configurarApp } from './configurar';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableShutdownHooks();
  configurarApp(app);
  const porta = Number(process.env.PORT ?? 3000);
  await app.listen(porta);
  console.log(`API do Craques da Várzea em http://localhost:${porta} (painel em /admin)`);
}

bootstrap();
