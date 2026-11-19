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

  /** Temporadas publicadas. */
  @Get('temporadas')
  temporadas() {
    return this.prisma.temporada.findMany({
      where: { publicada: true },
      orderBy: { numero: 'asc' },
      select: { numero: true, nome: true, requisito: true },
    });
  }

  @Get('figurinhas')
  async listarFigurinhas() {
    // Só figurinhas de temporadas publicadas (as em montagem ficam escondidas).
    return (
      await this.prisma.figurinha.findMany({ where: { temporadaRef: { publicada: true } }, orderBy: [{ temporada: 'asc' }, { numero: 'asc' }] })
    ).map(comImagem);
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
