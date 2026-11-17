import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AuthGuard, UsuarioAtual } from '../auth/auth.guard';
import { UsuarioAutenticado } from '../auth/auth.service';
import * as v from '../comum/validacao';
import { LojaService } from './loja.service';

@Controller('loja')
export class LojaController {
  constructor(@Inject(LojaService) private readonly loja: LojaService) {}

  @Get()
  @UseGuards(AuthGuard)
  catalogo(@UsuarioAtual() u: UsuarioAutenticado) {
    return this.loja.catalogo(u.id);
  }

  @Post('nascimento')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  nascimento(@UsuarioAtual() u: UsuarioAutenticado, @Body() corpo: unknown) {
    const c = v.objeto(corpo);
    const texto = typeof c.dataNascimento === 'string' ? c.dataNascimento : '';
    const data = /^\d{4}-\d{2}-\d{2}$/.test(texto) ? new Date(`${texto}T00:00:00Z`) : null;
    if (!data || Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== texto) {
      throw new BadRequestException({ codigo: 'ENTRADA_INVALIDA', campo: 'dataNascimento', mensagem: 'Use o formato AAAA-MM-DD.' });
    }
    return this.loja.declararNascimento(u.id, data);
  }

  /** Só existe com LOJA_TESTE=1 fora de produção. */
  @Post('compra-teste')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  compraTeste(@UsuarioAtual() u: UsuarioAutenticado, @Body() corpo: unknown) {
    const c = v.objeto(corpo);
    if (typeof c.produtoId !== 'string') throw new BadRequestException({ codigo: 'ENTRADA_INVALIDA', campo: 'produtoId', mensagem: 'Informe o produto.' });
    return this.loja.compraTeste(u.id, c.produtoId);
  }

  /** Avisos de compra e reembolso enviados pelo RevenueCat. */
  @Post('webhook/revenuecat')
  @HttpCode(200)
  @SkipThrottle()
  webhook(@Headers('authorization') autorizacao: string | undefined, @Body() corpo: unknown) {
    return this.loja.webhookRevenueCat(autorizacao, corpo);
  }
}
