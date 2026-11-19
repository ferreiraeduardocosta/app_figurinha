import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, Troca } from '@prisma/client';
import { ErroRegra, ItemTroca, aplicarTroca, sugerirTrocas, validarTroca } from '@craques-da-varzea/regras';
import { registrarProgresso } from '../missoes/missoes';
import { PrismaService } from '../prisma/prisma.service';
import { diaLocal } from '../pacotes/dia';
import { PacotesService } from '../pacotes/pacotes.service';
import { RecompensaNova, entregarRecompensas } from '../pacotes/recompensas';
import { AmigosService } from './amigos.service';
import { gravarInventario, lerInventario, resumoUsuario, travarUsuarios } from './comum';

/** Regras contra abuso (ajustáveis). */
export const LIMITES_TROCA = {
  validadeDias: 7,
  maxPendentesEnviadas: 20,
  maxTrocasPorDia: 10,
  diasMinimosParaLendaria: 3,
};

const DIA_MS = 24 * 60 * 60 * 1000;
const incluirUsuarios = { propostaPor: resumoUsuario, para: resumoUsuario } as const;

export interface NovaProposta {
  paraId: string;
  oferta: ItemTroca[];
  pedido: ItemTroca[];
  respostaA?: string;
}

@Injectable()
export class TrocasService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PacotesService) private readonly pacotes: PacotesService,
    @Inject(AmigosService) private readonly amigos: AmigosService,
  ) {}

  async listar(eu: string, agora = new Date()) {
    await this.expirarVencidas(agora);
    const [recebidas, enviadas, historico] = await Promise.all([
      this.prisma.troca.findMany({ where: { paraId: eu, status: 'PENDENTE' }, include: incluirUsuarios, orderBy: { criadaEm: 'desc' } }),
      this.prisma.troca.findMany({ where: { propostaPorId: eu, status: 'PENDENTE' }, include: incluirUsuarios, orderBy: { criadaEm: 'desc' } }),
      this.prisma.troca.findMany({
        where: { status: { not: 'PENDENTE' }, OR: [{ propostaPorId: eu }, { paraId: eu }] },
        include: incluirUsuarios,
        orderBy: { criadaEm: 'desc' },
        take: 20,
      }),
    ]);
    return { recebidas, enviadas, historico };
  }

  /** Cria uma proposta (ou contraproposta, com respostaA = id da proposta recebida). */
  async propor(eu: string, p: NovaProposta, agora = new Date()) {
    if (p.paraId === eu) throw new UnprocessableEntityException({ codigo: 'TROCA_INVALIDA', mensagem: 'Você não pode trocar consigo mesmo.' });
    return this.prisma.$transaction(async (tx) => {
      await travarUsuarios(tx, [eu, p.paraId]);
      if (!(await this.amigos.saoAmigos(tx, eu, p.paraId))) {
        throw new ForbiddenException({ codigo: 'SO_ENTRE_AMIGOS', mensagem: 'Só dá para trocar com amigos.' });
      }
      const pendentes = await tx.troca.count({ where: { propostaPorId: eu, status: 'PENDENTE', expiraEm: { gt: agora } } });
      if (pendentes >= LIMITES_TROCA.maxPendentesEnviadas) {
        throw new ConflictException({
          codigo: 'LIMITE_PROPOSTAS',
          mensagem: `Você já tem ${pendentes} propostas esperando resposta. Cancele alguma antes de enviar outra.`,
        });
      }
      await this.conferirLendarias(tx, [eu, p.paraId], [...p.oferta, ...p.pedido], agora);

      const [invEu, invOutro] = await Promise.all([lerInventario(tx, eu), lerInventario(tx, p.paraId)]);
      this.comoErroHttp(() => validarTroca(invEu, invOutro, p.oferta, p.pedido, this.pacotes.catalogoAtual));
      // Uma troca é sempre dentro de uma temporada, liberada para os dois.
      const temporadas = new Set([...p.oferta, ...p.pedido].map((i) => this.pacotes.temporadaDaFigurinha(i.codigo)));
      if (temporadas.size > 1) {
        throw new UnprocessableEntityException({ codigo: 'TROCA_INVALIDA', mensagem: 'Uma troca só pode ter figurinhas da mesma temporada.' });
      }
      const [temporada] = [...temporadas] as number[];
      await this.pacotes.exigirLiberada(p.paraId, temporada, tx).catch(() => {
        throw new UnprocessableEntityException({ codigo: 'TEMPORADA_BLOQUEADA', mensagem: 'Seu amigo ainda não liberou essa temporada.' });
      });
      await this.pacotes.exigirLiberada(eu, temporada, tx);

      if (p.respostaA) {
        const original = await tx.troca.findUnique({ where: { id: p.respostaA } });
        if (!original || original.paraId !== eu || original.propostaPorId !== p.paraId || original.status !== 'PENDENTE') {
          throw new ConflictException({ codigo: 'CONTRAPROPOSTA_INVALIDA', mensagem: 'Só dá para responder a uma proposta pendente que você recebeu.' });
        }
        await tx.troca.update({
          where: { id: original.id },
          data: { status: 'RECUSADA', motivo: 'CONTRAPROPOSTA', respondidaEm: agora },
        });
      }

      await registrarProgresso(tx, eu, 'PROPOR_TROCA', 1, agora);
      return tx.troca.create({
        data: {
          propostaPorId: eu,
          paraId: p.paraId,
          oferta: p.oferta as unknown as Prisma.InputJsonValue,
          pedido: p.pedido as unknown as Prisma.InputJsonValue,
          respostaAId: p.respostaA ?? null,
          expiraEm: new Date(agora.getTime() + LIMITES_TROCA.validadeDias * DIA_MS),
        },
        include: incluirUsuarios,
      });
    });
  }

  /**
   * Aceita uma proposta recebida. Tudo numa transação com os dois jogadores
   * travados: confere de novo as repetidas (podem ter mudado desde a proposta),
   * move as figurinhas e entrega recompensas de página/álbum completos.
   */
  async aceitar(eu: string, trocaId: string, agora = new Date()) {
    const resultado = await this.prisma.$transaction(async (tx) => {
      const t = await this.buscar(tx, trocaId, eu);
      if (t.paraId !== eu) throw new ForbiddenException({ codigo: 'NAO_PERMITIDO', mensagem: 'Só quem recebeu a proposta pode aceitar.' });
      await travarUsuarios(tx, [t.propostaPorId, t.paraId]);
      const atual = await tx.troca.findUniqueOrThrow({ where: { id: t.id } });
      this.exigirPendente(atual, agora);
      if (!(await this.amigos.saoAmigos(tx, t.propostaPorId, t.paraId))) {
        throw new ForbiddenException({ codigo: 'SO_ENTRE_AMIGOS', mensagem: 'Vocês não são mais amigos.' });
      }
      await this.conferirLimiteDiario(tx, [t.propostaPorId, t.paraId], agora);

      const oferta = atual.oferta as unknown as ItemTroca[];
      const pedido = atual.pedido as unknown as ItemTroca[];
      const [invA, invB] = await Promise.all([lerInventario(tx, t.propostaPorId), lerInventario(tx, t.paraId)]);
      let r: ReturnType<typeof aplicarTroca>;
      try {
        r = aplicarTroca(invA, invB, oferta, pedido, this.pacotes.catalogoAtual);
      } catch (e) {
        if (e instanceof ErroRegra) {
          await tx.troca.update({ where: { id: t.id }, data: { status: 'FALHOU', motivo: e.message, respondidaEm: agora } });
          return { falhou: e.message };
        }
        throw e;
      }

      const codigos = [...oferta, ...pedido].map((i) => i.codigo);
      await gravarInventario(tx, t.propostaPorId, invA, r.invA, codigos);
      await gravarInventario(tx, t.paraId, invB, r.invB, codigos);
      await tx.troca.update({ where: { id: t.id }, data: { status: 'ACEITA', respondidaEm: agora } });
      const recompensasEu: RecompensaNova[] = await entregarRecompensas(tx, t.paraId);
      await entregarRecompensas(tx, t.propostaPorId);
      for (const [id, novas] of [
        [t.propostaPorId, r.novasA.length],
        [t.paraId, r.novasB.length],
      ] as const) {
        await registrarProgresso(tx, id, 'CONCLUIR_TROCA', 1, agora);
        await registrarProgresso(tx, id, 'COLAR_NOVAS', novas, agora);
      }
      return { troca: { ...atual, status: 'ACEITA' as const }, recebidas: pedido, novas: r.novasB, recompensas: recompensasEu };
    });

    // A falha é gravada (status FALHOU) e só depois vira erro para o app.
    if ('falhou' in resultado) {
      throw new ConflictException({
        codigo: 'TROCA_NAO_E_MAIS_POSSIVEL',
        mensagem: `A troca não pôde ser feita: ${resultado.falhou} A proposta foi encerrada.`,
      });
    }
    return resultado;
  }

  async recusar(eu: string, trocaId: string, agora = new Date()) {
    return this.encerrar(eu, trocaId, 'para', 'RECUSADA', agora);
  }

  async cancelar(eu: string, trocaId: string, agora = new Date()) {
    return this.encerrar(eu, trocaId, 'propostaPor', 'CANCELADA', agora);
  }

  /** Mercado de repetidas: para cada amigo, o que eu posso receber e o que posso dar. */
  async sugestoes(eu: string) {
    const ids = await this.amigos.idsDosAmigos(eu);
    if (ids.length === 0) return [];
    const [meu, usuarios, ...invs] = await Promise.all([
      lerInventario(this.prisma, eu),
      this.prisma.usuario.findMany({ where: { id: { in: ids } }, select: { id: true, apelido: true } }),
      ...ids.map((id) => lerInventario(this.prisma, id)),
    ]);
    const apelido = Object.fromEntries(usuarios.map((u) => [u.id, u.apelido]));
    return ids
      .map((id, i) => {
        const s = sugerirTrocas(meu, invs[i], this.pacotes.catalogoAtual);
        return { amigo: { id, apelido: apelido[id] }, euRecebo: s.aRecebe, euDou: s.aDa };
      })
      .sort((x, y) => Math.min(y.euRecebo.length, y.euDou.length) - Math.min(x.euRecebo.length, x.euDou.length) || y.euRecebo.length - x.euRecebo.length);
  }

  private async encerrar(eu: string, trocaId: string, papel: 'para' | 'propostaPor', status: 'RECUSADA' | 'CANCELADA', agora: Date) {
    return this.prisma.$transaction(async (tx) => {
      const t = await this.buscar(tx, trocaId, eu);
      if ((papel === 'para' ? t.paraId : t.propostaPorId) !== eu) {
        throw new ForbiddenException({
          codigo: 'NAO_PERMITIDO',
          mensagem: papel === 'para' ? 'Só quem recebeu a proposta pode recusar.' : 'Só quem fez a proposta pode cancelar.',
        });
      }
      this.exigirPendente(t, agora);
      return tx.troca.update({ where: { id: t.id }, data: { status, respondidaEm: agora }, include: incluirUsuarios });
    });
  }

  private async buscar(tx: Prisma.TransactionClient, trocaId: string, eu: string) {
    const t = await tx.troca.findUnique({ where: { id: trocaId } });
    if (!t || (t.propostaPorId !== eu && t.paraId !== eu)) {
      throw new NotFoundException({ codigo: 'TROCA_INEXISTENTE', mensagem: 'Proposta não encontrada.' });
    }
    return t;
  }

  private exigirPendente(t: Troca, agora: Date) {
    if (t.status === 'PENDENTE' && t.expiraEm <= agora) {
      throw new ConflictException({ codigo: 'TROCA_EXPIRADA', mensagem: 'Esta proposta expirou.' });
    }
    if (t.status !== 'PENDENTE') {
      throw new ConflictException({ codigo: 'TROCA_ENCERRADA', mensagem: 'Esta proposta já foi respondida.' });
    }
  }

  private async conferirLimiteDiario(tx: Prisma.TransactionClient, ids: string[], agora: Date) {
    const inicio = new Date(`${diaLocal(agora)}T00:00:00-03:00`);
    for (const id of ids) {
      const feitas = await tx.troca.count({
        where: { status: 'ACEITA', respondidaEm: { gte: inicio }, OR: [{ propostaPorId: id }, { paraId: id }] },
      });
      if (feitas >= LIMITES_TROCA.maxTrocasPorDia) {
        throw new ConflictException({
          codigo: 'LIMITE_TROCAS_DIA',
          mensagem: `Limite de ${LIMITES_TROCA.maxTrocasPorDia} trocas por dia atingido. Tente amanhã.`,
        });
      }
    }
  }

  /** Contas muito novas não trocam Lendárias (dificulta contas criadas só para repassar figurinhas). */
  private async conferirLendarias(tx: Prisma.TransactionClient, ids: string[], itens: ItemTroca[], agora: Date) {
    const lendarias = new Set(this.pacotes.catalogoAtual.LENDARIA.map((f) => f.codigo));
    if (!itens.some((i) => lendarias.has(i.codigo))) return;
    const limite = new Date(agora.getTime() - LIMITES_TROCA.diasMinimosParaLendaria * DIA_MS);
    const novas = await tx.usuario.count({ where: { id: { in: ids }, criadoEm: { gt: limite } } });
    if (novas > 0) {
      throw new ForbiddenException({
        codigo: 'CONTA_NOVA_LENDARIA',
        mensagem: `Lendárias só podem ser trocadas por contas com mais de ${LIMITES_TROCA.diasMinimosParaLendaria} dias.`,
      });
    }
  }

  private comoErroHttp(fn: () => void) {
    try {
      fn();
    } catch (e) {
      if (e instanceof ErroRegra) throw new UnprocessableEntityException({ codigo: e.codigo, mensagem: e.message });
      throw e;
    }
  }

  private async expirarVencidas(agora: Date) {
    await this.prisma.troca.updateMany({
      where: { status: 'PENDENTE', expiraEm: { lte: agora } },
      data: { status: 'EXPIRADA', respondidaEm: agora },
    });
  }
}

