import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { CatalogoController } from './catalogo/catalogo.controller';
import { LojaModule } from './loja/loja.module';
import { PacotesModule } from './pacotes/pacotes.module';
import { PrismaModule } from './prisma/prisma.module';
import { SocialModule } from './social/social.module';

@Controller()
class SaudeController {
  @Get('saude')
  saude() {
    return { status: 'ok' };
  }
}

@Module({
  imports: [
    // Limite geral por IP: 120 pedidos por minuto (rotas de login têm limite próprio, menor).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    PacotesModule,
    AdminModule,
    SocialModule,
    LojaModule,
  ],
  controllers: [SaudeController, CatalogoController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
