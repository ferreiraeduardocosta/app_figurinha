import { Controller, Get, HttpCode, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { AuthGuard, UsuarioAtual } from '../auth/auth.guard';
import { UsuarioAutenticado } from '../auth/auth.service';
import { MissoesService } from './missoes.service';

@Controller('missoes')
@UseGuards(AuthGuard)
export class MissoesController {
  constructor(@Inject(MissoesService) private readonly missoes: MissoesService) {}

  @Get()
  listar(@UsuarioAtual() u: UsuarioAutenticado) {
    return this.missoes.listar(u.id);
  }

  @Post(':id/resgatar')
  @HttpCode(200)
  resgatar(@UsuarioAtual() u: UsuarioAutenticado, @Param('id') id: string) {
    if (!/^[a-z0-9_]{1,40}$/.test(id)) throw new BadRequestException({ codigo: 'ENTRADA_INVALIDA', mensagem: 'Missão inválida.' });
    return this.missoes.resgatar(u.id, id);
  }
}
