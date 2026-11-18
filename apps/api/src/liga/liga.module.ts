import { Module } from '@nestjs/common';
import { LigaController } from './liga.controller';
import { LigaService } from './liga.service';

@Module({
  controllers: [LigaController],
  providers: [LigaService],
  exports: [LigaService],
})
export class LigaModule {}
