import { Module } from '@nestjs/common';
import { JogoController } from './jogo.controller';
import { PacotesService } from './pacotes.service';

@Module({
  controllers: [JogoController],
  providers: [PacotesService],
  exports: [PacotesService],
})
export class PacotesModule {}
