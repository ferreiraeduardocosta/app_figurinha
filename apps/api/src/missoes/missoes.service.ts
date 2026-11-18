import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { diaLocal } from '../pacotes/dia';
import { apresentar, garantirMissoesDoDia, renovaEm } from './missoes';

@Injectable()
export class MissoesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listar(usuarioId: string, agora = new Date()) {
    const missoes = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${usuarioId} FOR UPDATE`;
      return garantirMissoesDoDia(tx, usuarioId, agora);
    });
    return { dia: diaLocal(agora), renovaEm: renovaEm(agora), missoes: missoes.map(apresentar) };
  }

  /** Resgata as moedas de uma missão de hoje já cumprida. Uma única vez. */
  async resgatar(usuarioId: string, missaoId: string, agora = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${usuarioId} FOR UPDATE`;
      await garantirMissoesDoDia(tx, usuarioId, agora);
      const chave = { usuarioId_dia_missaoId: { usuarioId, dia: diaLocal(agora), missaoId } };
      const m = await tx.missaoDia.findUnique({ where: chave });
      if (!m) throw new NotFoundException({ codigo: 'MISSAO_INEXISTENTE', mensagem: 'Essa missão não é de hoje.' });
      if (m.resgatadaEm) throw new ConflictException({ codigo: 'MISSAO_JA_RESGATADA', mensagem: 'Você já resgatou essa missão.' });
      if (m.progresso < m.meta) throw new ConflictException({ codigo: 'MISSAO_INCOMPLETA', mensagem: 'Essa missão ainda não foi cumprida.' });
      await tx.missaoDia.update({ where: chave, data: { resgatadaEm: agora } });
      const u = await tx.usuario.update({ where: { id: usuarioId }, data: { moedas: { increment: m.recompensa } } });
      return { moedas: u.moedas, ganhou: m.recompensa, missao: apresentar({ ...m, resgatadaEm: agora }) };
    });
  }

  /** Quantas missões de hoje estão cumpridas e esperando resgate (para o selo no app). */
  paraResgatar(usuarioId: string, agora = new Date()) {
    return this.prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n FROM "MissaoDia"
      WHERE "usuarioId" = ${usuarioId} AND "dia" = ${diaLocal(agora)} AND "progresso" >= "meta" AND "resgatadaEm" IS NULL`
      .then((r) => Number(r[0]?.n ?? 0));
  }
}
