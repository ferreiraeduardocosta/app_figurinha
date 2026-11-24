import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, UsuarioAtual } from '../auth/auth.guard';
import { UsuarioAutenticado } from '../auth/auth.service';
import * as v from '../comum/validacao';
import { AmigosService } from './amigos.service';
import { BafoService } from './bafo.service';
import { EventosService } from './eventos.service';
import { RodaService } from './roda.service';
import { RankingService } from './ranking.service';
import { TrocasService } from './trocas.service';

const uuid = new ParseUUIDPipe({ version: '4' });

/** Amigos e trocas. Todas as rotas exigem login. */
@Controller()
@UseGuards(AuthGuard)
export class SocialController {
  constructor(
    @Inject(AmigosService) private readonly amigos: AmigosService,
    @Inject(TrocasService) private readonly trocas: TrocasService,
    @Inject(RankingService) private readonly rankingService: RankingService,
    @Inject(BafoService) private readonly bafo: BafoService,
    @Inject(RodaService) private readonly rodas: RodaService,
    @Inject(EventosService) private readonly eventos: EventosService,
  ) {}

  /** Ranking de colecionadores: ?escopo=geral (padrão) ou amigos. */
  @Get('ranking')
  ranking(@UsuarioAtual() u: UsuarioAutenticado, @Query('escopo') escopo?: string) {
    return this.rankingService.ranking(u.id, escopo === 'amigos' ? 'amigos' : 'geral');
  }

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

  // ---------------- Bafo ----------------

  @Get('bafo')
  listarBafo(@UsuarioAtual() u: UsuarioAutenticado) {
    return this.bafo.listar(u.id);
  }

  /** Eventos de bafo: agora, em breve e encerrados há pouco, com ranking. */
  @Get('bafo/eventos')
  eventosBafo(@UsuarioAtual() u: UsuarioAutenticado) {
    return this.eventos.listar(u.id);
  }

  // ---------------- Rodinha de bafo ----------------

  @Get('bafo/rodas')
  listarRodas(@UsuarioAtual() u: UsuarioAutenticado) {
    return this.rodas.listar(u.id);
  }

  @Get('bafo/rodas/:id')
  verRoda(@UsuarioAtual() u: UsuarioAutenticado, @Param('id', uuid) id: string) {
    return this.rodas.ver(u.id, id);
  }

  @Post('bafo/rodas')
  criarRoda(@UsuarioAtual() u: UsuarioAutenticado, @Body() corpo: unknown) {
    const c = v.objeto(corpo);
    return this.rodas.criar(u.id, v.convidados(c), v.figurinhasBafo(c));
  }

  @Post('bafo/rodas/:id/entrar')
  @HttpCode(200)
  entrarRoda(@UsuarioAtual() u: UsuarioAutenticado, @Param('id', uuid) id: string, @Body() corpo: unknown) {
    return this.rodas.entrar(u.id, id, v.figurinhasBafo(v.objeto(corpo)));
  }

  @Post('bafo/rodas/:id/recusar')
  @HttpCode(200)
  recusarRoda(@UsuarioAtual() u: UsuarioAutenticado, @Param('id', uuid) id: string) {
    return this.rodas.recusar(u.id, id);
  }

  @Post('bafo/rodas/:id/comecar')
  @HttpCode(200)
  comecarRoda(@UsuarioAtual() u: UsuarioAutenticado, @Param('id', uuid) id: string) {
    return this.rodas.comecar(u.id, id);
  }

  @Post('bafo/rodas/:id/cancelar')
  @HttpCode(200)
  cancelarRoda(@UsuarioAtual() u: UsuarioAutenticado, @Param('id', uuid) id: string) {
    return this.rodas.cancelar(u.id, id);
  }

  @Post('bafo/rodas/:id/bater')
  @HttpCode(200)
  baterRoda(@UsuarioAtual() u: UsuarioAutenticado, @Param('id', uuid) id: string, @Body() corpo: unknown) {
    return this.rodas.bater(u.id, id, v.precisao(v.objeto(corpo)));
  }

  @Get('bafo/:id')
  verBafo(@UsuarioAtual() u: UsuarioAutenticado, @Param('id', uuid) id: string) {
    return this.bafo.ver(u.id, id);
  }

  @Post('bafo/computador')
  bafoComputador(@UsuarioAtual() u: UsuarioAutenticado, @Body() corpo: unknown) {
    return this.bafo.contraComputador(u.id, v.figurinhasBafo(v.objeto(corpo)));
  }

  @Post('bafo/desafios')
  desafiarBafo(@UsuarioAtual() u: UsuarioAutenticado, @Body() corpo: unknown) {
    const c = v.objeto(corpo);
    return this.bafo.desafiar(u.id, v.idObrigatorio(c, 'adversarioId'), v.figurinhasBafo(c));
  }

  @Post('bafo/:id/aceitar')
  @HttpCode(200)
  aceitarBafo(@UsuarioAtual() u: UsuarioAutenticado, @Param('id', uuid) id: string, @Body() corpo: unknown) {
    return this.bafo.aceitar(u.id, id, v.figurinhasBafo(v.objeto(corpo)));
  }

  @Post('bafo/:id/recusar')
  @HttpCode(200)
  recusarBafo(@UsuarioAtual() u: UsuarioAutenticado, @Param('id', uuid) id: string) {
    return this.bafo.recusar(u.id, id);
  }

  @Post('bafo/:id/cancelar')
  @HttpCode(200)
  cancelarBafo(@UsuarioAtual() u: UsuarioAutenticado, @Param('id', uuid) id: string) {
    return this.bafo.cancelar(u.id, id);
  }

  @Post('bafo/:id/bater')
  @HttpCode(200)
  baterBafo(@UsuarioAtual() u: UsuarioAutenticado, @Param('id', uuid) id: string, @Body() corpo: unknown) {
    return this.bafo.bater(u.id, id, v.precisao(v.objeto(corpo)));
  }
}
