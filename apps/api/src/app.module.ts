import { Controller, Get, Module } from '@nestjs/common';
import { CatalogoController } from './catalogo/catalogo.controller';
import { PacotesModule } from './pacotes/pacotes.module';
import { PrismaModule } from './prisma/prisma.module';

@Controller()
class SaudeController {
  @Get('saude')
  saude() {
    return { status: 'ok' };
  }
}

@Module({
  imports: [PrismaModule, PacotesModule],
  controllers: [SaudeController, CatalogoController],
})
export class AppModule {}
