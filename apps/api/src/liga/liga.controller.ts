import { Controller, Get, Inject, Query } from '@nestjs/common';
import { LigaService } from './liga.service';

/** Craques da Várzea: classificação, rodadas, artilharia e figurinha "Em alta". Pública. */
@Controller('liga')
export class LigaController {
  constructor(@Inject(LigaService) private readonly liga: LigaService) {}

  @Get()
  painel(@Query('temporada') temporada?: string) {
    const t = Number(temporada ?? 1);
    return this.liga.painel(new Date(), Number.isInteger(t) && t >= 1 && t <= 99 ? t : 1);
  }
}
