import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { probabilidadesPublicas } from '../pacotes/economia';

/** Dados públicos do álbum: não exigem login. */
@Controller()
export class CatalogoController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('clubes')
  listarClubes() {
    return this.prisma.clube.findMany({ orderBy: { sigla: 'asc' } });
  }

  @Get('figurinhas')
  listarFigurinhas() {
    return this.prisma.figurinha.findMany({ orderBy: { numero: 'asc' } });
  }

  @Get('figurinhas/:codigo')
  async buscarFigurinha(@Param('codigo') codigo: string) {
    const f = await this.prisma.figurinha.findUnique({ where: { codigo: codigo.toUpperCase() } });
    if (!f) throw new NotFoundException(`Figurinha ${codigo} não existe.`);
    return f;
  }

  /** Probabilidades e garantia mínima: as lojas exigem mostrar isso antes da compra. */
  @Get('probabilidades')
  probabilidades() {
    return probabilidadesPublicas();
  }
}
