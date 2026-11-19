import { Controller, Get, Inject, NotFoundException, Param } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { probabilidadesPublicas } from '../pacotes/economia';
import { comImagem, imagemDa } from './artes';

/** Dados públicos do álbum: não exigem login. */
@Controller()
export class CatalogoController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get('clubes')
  async listarClubes() {
    const clubes = await this.prisma.clube.findMany({ orderBy: { sigla: 'asc' } });
    // Escudo recortado (fundo transparente) para os ícones pequenos do app.
    return clubes.map((c) => ({ ...c, escudoImagem: imagemDa(`escudo-${c.sigla}`) }));
  }

  @Get('figurinhas')
  async listarFigurinhas() {
    return (await this.prisma.figurinha.findMany({ orderBy: { numero: 'asc' } })).map(comImagem);
  }

  @Get('figurinhas/:codigo')
  async buscarFigurinha(@Param('codigo') codigo: string) {
    const f = await this.prisma.figurinha.findUnique({ where: { codigo: codigo.toUpperCase() } });
    if (!f) throw new NotFoundException(`Figurinha ${codigo} não existe.`);
    return comImagem(f);
  }

  /** Probabilidades e garantia mínima: as lojas exigem mostrar isso antes da compra. */
  @Get('probabilidades')
  probabilidades() {
    return probabilidadesPublicas();
  }
}
