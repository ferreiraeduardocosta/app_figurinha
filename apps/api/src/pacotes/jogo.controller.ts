import { Body, Controller, Get, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, UsuarioAtual } from '../auth/auth.guard';
import { UsuarioAutenticado } from '../auth/auth.service';
import * as v from '../comum/validacao';
import { PacotesService } from './pacotes.service';

/** Ações do jogador. Todas exigem login. */
@Controller()
@UseGuards(AuthGuard)
export class JogoController {
  constructor(@Inject(PacotesService) private readonly pacotes: PacotesService) {}

  @Get('eu')
  perfil(@UsuarioAtual() u: UsuarioAutenticado) {
    return this.pacotes.perfil(u.id);
  }

  @Get('album')
  album(@UsuarioAtual() u: UsuarioAutenticado) {
    return this.pacotes.album(u.id);
  }

  @Post('pacotes/diario')
  @HttpCode(200)
  abrirDiario(@UsuarioAtual() u: UsuarioAutenticado, @Body() corpo: unknown) {
    return this.pacotes.abrirPacoteDiario(u.id, v.temporada(corpo));
  }

  @Post('pacotes/bonus')
  @HttpCode(200)
  abrirBonus(@UsuarioAtual() u: UsuarioAutenticado, @Body() corpo: unknown) {
    return this.pacotes.abrirPacoteBonus(u.id, v.temporada(corpo));
  }

  @Post('pacotes/comprado')
  @HttpCode(200)
  abrirComprado(@UsuarioAtual() u: UsuarioAutenticado, @Body() corpo: unknown) {
    return this.pacotes.abrirPacoteComprado(u.id, v.temporada(corpo));
  }

  @Post('pacotes/moedas')
  @HttpCode(200)
  abrirComMoedas(@UsuarioAtual() u: UsuarioAutenticado, @Body() corpo: unknown) {
    return this.pacotes.abrirPacoteComMoedas(u.id, v.temporada(corpo));
  }

  @Post('balcao')
  @HttpCode(200)
  balcao(@UsuarioAtual() u: UsuarioAutenticado, @Body() corpo: unknown) {
    return this.pacotes.trocarNoBalcao(u.id, v.codigoFigurinha(v.objeto(corpo)));
  }
}
