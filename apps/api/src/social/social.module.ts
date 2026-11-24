import { Module } from '@nestjs/common';
import { PacotesModule } from '../pacotes/pacotes.module';
import { AmigosService } from './amigos.service';
import { BafoService } from './bafo.service';
import { EventosService } from './eventos.service';
import { RodaService } from './roda.service';
import { RankingService } from './ranking.service';
import { SocialController } from './social.controller';
import { TrocasService } from './trocas.service';

@Module({
  imports: [PacotesModule],
  controllers: [SocialController],
  providers: [AmigosService, TrocasService, RankingService, BafoService, RodaService, EventosService],
  exports: [BafoService, RodaService, EventosService],
})
export class SocialModule {}
