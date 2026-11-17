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
  abrirDiario(@UsuarioAtual() u: UsuarioAutenticado) {
    return this.pacotes.abrirPacoteDiario(u.id);
  }

  @Post('balcao')
  @HttpCode(200)
  balcao(@UsuarioAtual() u: UsuarioAutenticado, @Body() corpo: unknown) {
    return this.pacotes.trocarNoBalcao(u.id, v.codigoFigurinha(v.objeto(corpo)));
  }
}
