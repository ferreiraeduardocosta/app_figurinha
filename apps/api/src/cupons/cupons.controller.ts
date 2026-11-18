import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminGuard, AuthGuard, UsuarioAtual } from '../auth/auth.guard';
import { UsuarioAutenticado } from '../auth/auth.service';
import { CuponsService } from './cupons.service';
import { codigoCupom, validarNovoCupom } from './validacao-cupom';

@Controller('cupons')
@UseGuards(AuthGuard)
export class CuponsController {
  constructor(@Inject(CuponsService) private readonly cupons: CuponsService) {}

  /** Cupons feitos para o jogador e ainda não resgatados. */
  @Get()
  meus(@UsuarioAtual() u: UsuarioAutenticado) {
    return this.cupons.meus(u.id);
  }

  // Limite apertado: dificulta tentar códigos no chute.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('resgatar')
  @HttpCode(200)
  resgatar(@UsuarioAtual() u: UsuarioAutenticado, @Body() corpo: unknown) {
    const c = (typeof corpo === 'object' && corpo !== null ? corpo : {}) as Record<string, unknown>;
    return this.cupons.resgatar(u.id, codigoCupom(c.codigo));
  }
}

@Controller('admin/cupons')
@UseGuards(AdminGuard)
export class CuponsAdminController {
  constructor(@Inject(CuponsService) private readonly cupons: CuponsService) {}

  @Get()
  listar() {
    return this.cupons.listar();
  }

  @Post()
  criar(@UsuarioAtual() u: UsuarioAutenticado, @Body() corpo: unknown) {
    return this.cupons.criar(u, validarNovoCupom(corpo));
  }

  @Patch(':id')
  alterar(@Param('id') id: string, @Body() corpo: unknown) {
    const c = (typeof corpo === 'object' && corpo !== null ? corpo : {}) as Record<string, unknown>;
    if (typeof c.ativo !== 'boolean') throw new BadRequestException({ codigo: 'ENTRADA_INVALIDA', campo: 'ativo', mensagem: 'Informe ativo: true ou false.' });
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new BadRequestException({ codigo: 'ENTRADA_INVALIDA', mensagem: 'Cupom inválido.' });
    return this.cupons.definirAtivo(id, c.ativo);
  }
}
