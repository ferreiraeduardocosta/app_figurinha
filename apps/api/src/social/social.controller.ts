import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, UsuarioAtual } from '../auth/auth.guard';
import { UsuarioAutenticado } from '../auth/auth.service';
import * as v from '../comum/validacao';
import { AmigosService } from './amigos.service';
import { TrocasService } from './trocas.service';

const uuid = new ParseUUIDPipe({ version: '4' });

/** Amigos e trocas. Todas as rotas exigem login. */
@Controller()
@UseGuards(AuthGuard)
export class SocialController {
  constructor(
    @Inject(AmigosService) private readonly amigos: AmigosService,
    @Inject(TrocasService) private readonly trocas: TrocasService,
  ) {}

  @Get('amigos')
  listarAmigos(@UsuarioAtual() u: UsuarioAutenticado) {
    return this.amigos.listar(u.id);
  }

  @Post('amigos')
  pedirAmizade(@UsuarioAtual() u: UsuarioAutenticado, @Body() corpo: unknown) {
    return this.amigos.pedir(u.id, v.apelido(v.objeto(corpo)));
  }

  @Post('amigos/:id/aceitar')
  @HttpCode(200)
  aceitarAmizade(@UsuarioAtual() u: UsuarioAutenticado, @Param('id', uuid) id: string) {
    return this.amigos.aceitar(u.id, id);
  }

  @Delete('amigos/:id')
  @HttpCode(204)
  async removerAmizade(@UsuarioAtual() u: UsuarioAutenticado, @Param('id', uuid) id: string) {
    await this.amigos.remover(u.id, id);
  }

  @Get('trocas')
  listarTrocas(@UsuarioAtual() u: UsuarioAutenticado) {
    return this.trocas.listar(u.id);
  }

  @Get('trocas/sugestoes')
  sugestoes(@UsuarioAtual() u: UsuarioAutenticado) {
    return this.trocas.sugestoes(u.id);
  }

  @Post('trocas')
  propor(@UsuarioAtual() u: UsuarioAutenticado, @Body() corpo: unknown) {
    const c = v.objeto(corpo);
    return this.trocas.propor(u.id, {
      paraId: v.idObrigatorio(c, 'paraId'),
      oferta: v.itensTroca(c, 'oferta'),
      pedido: v.itensTroca(c, 'pedido'),
      respostaA: v.idOpcional(c, 'respostaA'),
    });
  }

  @Post('trocas/:id/aceitar')
  @HttpCode(200)
  aceitar(@UsuarioAtual() u: UsuarioAutenticado, @Param('id', uuid) id: string) {
    return this.trocas.aceitar(u.id, id);
  }

  @Post('trocas/:id/recusar')
  @HttpCode(200)
  recusar(@UsuarioAtual() u: UsuarioAutenticado, @Param('id', uuid) id: string) {
    return this.trocas.recusar(u.id, id);
  }

  @Post('trocas/:id/cancelar')
  @HttpCode(200)
  cancelar(@UsuarioAtual() u: UsuarioAutenticado, @Param('id', uuid) id: string) {
    return this.trocas.cancelar(u.id, id);
  }
}
