import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AmigosService } from './amigos.service';

export type EscopoRanking = 'geral' | 'amigos';

interface LinhaBruta {
  id: string;
  apelido: string;
  coladas: bigint;
  lendarias: bigint;
  campeao: boolean;
  posicao: bigint;
}

const TOP = 50;

/**
 * Ranking de colecionadores: mais figurinhas coladas; desempate pelas
 * Lendárias e, depois, por quem chegou primeiro àquele total.
 * Só mostra apelidos. Contas excluídas e quem ainda não colou nada ficam de fora.
 */
@Injectable()
export class RankingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AmigosService) private readonly amigos: AmigosService,
  ) {}

  async ranking(eu: string, escopo: EscopoRanking) {
    const filtro =
      escopo === 'amigos'
        ? Prisma.sql`AND u."id" IN (${Prisma.join([eu, ...(await this.amigos.idsDosAmigos(eu))])})`
        : Prisma.empty;

    const linhas = await this.prisma.$queryRaw<LinhaBruta[]>`
      WITH placar AS (
        SELECT u."id", u."apelido",
               COUNT(i."figurinhaCodigo") FILTER (WHERE i."quantidade" > 0) AS coladas,
               COUNT(i."figurinhaCodigo") FILTER (WHERE i."quantidade" > 0 AND f."raridade" = 'LENDARIA') AS lendarias,
               MAX(i."primeiraEm") AS ultima,
               EXISTS (SELECT 1 FROM "Recompensa" r WHERE r."usuarioId" = u."id" AND r."tipo" = 'ALBUM') AS campeao
        FROM "Usuario" u
        LEFT JOIN "ItemAlbum" i ON i."usuarioId" = u."id"
        LEFT JOIN "Figurinha" f ON f."codigo" = i."figurinhaCodigo"
        WHERE u."excluidoEm" IS NULL ${filtro}
        GROUP BY u."id"
      ),
      ordenado AS (
        SELECT *, RANK() OVER (ORDER BY coladas DESC, lendarias DESC, ultima ASC) AS posicao
        FROM placar WHERE coladas > 0
      )
      SELECT "id", "apelido", coladas, lendarias, campeao, posicao FROM ordenado
      WHERE posicao <= ${TOP} OR "id" = ${eu}
      ORDER BY posicao ASC, "apelido" ASC`;

    const total = await this.prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(DISTINCT u."id") AS n FROM "Usuario" u JOIN "ItemAlbum" i ON i."usuarioId" = u."id" AND i."quantidade" > 0
      WHERE u."excluidoEm" IS NULL ${filtro}`;

    const lista = linhas.map((l) => ({
      posicao: Number(l.posicao),
      apelido: l.apelido,
      coladas: Number(l.coladas),
      lendarias: Number(l.lendarias),
      campeao: l.campeao,
      souEu: l.id === eu,
    }));
    const eu_ = lista.find((l) => l.souEu) ?? null;
    return {
      escopo,
      participantes: Number(total[0]?.n ?? 0),
      // O top 50 e, se o jogador estiver fora dele, a linha dele separada.
      lista: lista.filter((l) => l.posicao <= TOP),
      eu: eu_,
    };
  }
}
