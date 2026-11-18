import { Controller, Get, Inject } from '@nestjs/common';
import { LigaService } from './liga.service';

/** Craques da Várzea: classificação, rodadas, artilharia e figurinha "Em alta". Pública. */
@Controller('liga')
export class LigaController {
  constructor(@Inject(LigaService) private readonly liga: LigaService) {}

  @Get()
  painel() {
    return this.liga.painel();
  }
}
