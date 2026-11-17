import { Body, Controller, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import * as v from '../comum/validacao';
import { AuthGuard, UsuarioAtual } from './auth.guard';
import { AuthService, UsuarioAutenticado } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  // Limite mais apertado nas rotas de login, contra tentativa e erro de senhas.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('cadastro')
  cadastrar(@Body() corpo: unknown) {
    const c = v.objeto(corpo);
    return this.auth.cadastrar(v.apelido(c), v.email(c), v.senha(c));
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('entrar')
  @HttpCode(200)
  entrar(@Body() corpo: unknown) {
    const c = v.objeto(corpo);
    return this.auth.entrar(v.email(c), v.senha(c));
  }

  @Post('sair')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async sair(@UsuarioAtual() usuario: UsuarioAutenticado) {
    await this.auth.sair(usuario.sessaoId);
  }
}
