import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomInt } from 'node:crypto';
import { UsuarioAutenticado } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { NovoCupom } from './validacao-cupom';

/** Sem letras e números que se confundem (O/0, I/1/L). */
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function gerarCodigo(tamanho = 8): string {
  let c = '';
  for (let i = 0; i < tamanho; i++) c += ALFABETO[randomInt(ALFABETO.length)];
  return c;
}

const INVALIDO = () => new NotFoundException({ codigo: 'CUPOM_INVALIDO', mensagem: 'Cupom inválido.' });

/**
 * Cupons de pacotes bônus. O admin cria (para contas escolhidas ou para todos);
 * o jogador resgata pelo código ou, se for destinatário, direto da lista do app.
 */
@Injectable()
export class CuponsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /* ---------- jogador ---------- */

  /** Cupons feitos para esta conta que ainda podem ser resgatados. */
  async meus(usuarioId: string, agora = new Date()) {
    const lista = await this.prisma.cupom.findMany({
      where: {
        ativo: true,
        OR: [{ validoAte: null }, { validoAte: { gt: agora } }],
        destinatarios: { some: { usuarioId } },
        resgates: { none: { usuarioId } },
      },
      select: { codigo: true, pacotes: true, descricao: true, validoAte: true },
      orderBy: { criadoEm: 'asc' },
    });
    return lista;
  }

  async resgatar(usuarioId: string, codigo: string, agora = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      // Trava o cupom: dois resgates ao mesmo tempo não passam do limite de usos.
      const travado = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Cupom" WHERE codigo = ${codigo} FOR UPDATE`;
      if (travado.length === 0) throw INVALIDO();
      const cupom = await tx.cupom.findUniqueOrThrow({
        where: { id: travado[0].id },
        include: { _count: { select: { destinatarios: true, resgates: true } } },
      });
      if (!cupom.ativo) throw INVALIDO();
      if (cupom._count.destinatarios > 0) {
        const meu = await tx.cupomDestinatario.findUnique({ where: { cupomId_usuarioId: { cupomId: cupom.id, usuarioId } } });
        // Mesma resposta de "não existe": não revela cupons de outras pessoas.
        if (!meu) throw INVALIDO();
      }
      const jaUsou = await tx.cupomResgate.findUnique({ where: { cupomId_usuarioId: { cupomId: cupom.id, usuarioId } } });
      if (jaUsou) throw new ConflictException({ codigo: 'CUPOM_JA_RESGATADO', mensagem: 'Você já resgatou este cupom.' });
      if (cupom.validoAte && cupom.validoAte <= agora) {
        throw new UnprocessableEntityException({ codigo: 'CUPOM_EXPIRADO', mensagem: 'Este cupom expirou.' });
      }
      if (cupom.maxUsos !== null && cupom._count.resgates >= cupom.maxUsos) {
        throw new UnprocessableEntityException({ codigo: 'CUPOM_ESGOTADO', mensagem: 'Este cupom já foi usado o máximo de vezes.' });
      }
      await tx.cupomResgate.create({ data: { cupomId: cupom.id, usuarioId } });
      const u = await tx.usuario.update({
        where: { id: usuarioId },
        data: { pacotesBonus: { increment: cupom.pacotes } },
        select: { pacotesBonus: true },
      });
      return { codigo: cupom.codigo, pacotes: cupom.pacotes, descricao: cupom.descricao, pacotesBonus: u.pacotesBonus };
    });
  }

  /* ---------- painel ---------- */

  async listar(agora = new Date()) {
    const lista = await this.prisma.cupom.findMany({
      orderBy: { criadoEm: 'desc' },
      take: 100,
      include: {
        destinatarios: { select: { usuario: { select: { apelido: true } }, usuarioId: true } },
        resgates: { select: { usuarioId: true } },
      },
    });
    return lista.map((c) => {
      const resgataram = new Set(c.resgates.map((r) => r.usuarioId));
      const status = !c.ativo
        ? 'DESATIVADO'
        : c.validoAte && c.validoAte <= agora
          ? 'EXPIRADO'
          : c.maxUsos !== null && c.resgates.length >= c.maxUsos
            ? 'ESGOTADO'
            : 'ATIVO';
      return {
        id: c.id,
        codigo: c.codigo,
        pacotes: c.pacotes,
        descricao: c.descricao,
        maxUsos: c.maxUsos,
        validoAte: c.validoAte,
        ativo: c.ativo,
        status,
        usos: c.resgates.length,
        destinatarios: c.destinatarios.map((d) => ({ apelido: d.usuario.apelido, resgatou: resgataram.has(d.usuarioId) })),
        criadoPorApelido: c.criadoPorApelido,
        criadoEm: c.criadoEm,
      };
    });
  }

  async criar(admin: UsuarioAutenticado, dados: NovoCupom) {
    const ids = await this.resolverDestinatarios(dados.destinatarios);
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const codigo = dados.codigo ?? gerarCodigo();
      try {
        const cupom = await this.prisma.cupom.create({
          data: {
            codigo,
            pacotes: dados.pacotes,
            descricao: dados.descricao,
            maxUsos: ids.length > 0 ? null : dados.maxUsos,
            validoAte: dados.validoAte,
            criadoPorId: admin.id,
            criadoPorApelido: admin.apelido,
            destinatarios: { create: ids.map((usuarioId) => ({ usuarioId })) },
          },
        });
        return { id: cupom.id, codigo: cupom.codigo, destinatarios: ids.length };
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          if (dados.codigo) {
            throw new ConflictException({ codigo: 'CUPOM_JA_EXISTE', campo: 'codigo', mensagem: `Já existe um cupom ${codigo}.` });
          }
          continue; // código sorteado repetido: sorteia outro
        }
        throw e;
      }
    }
    throw new ConflictException({ codigo: 'CUPOM_JA_EXISTE', mensagem: 'Não foi possível gerar um código livre. Tente de novo.' });
  }

  async definirAtivo(id: string, ativo: boolean) {
    try {
      const c = await this.prisma.cupom.update({ where: { id }, data: { ativo }, select: { id: true, ativo: true } });
      return c;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException({ codigo: 'CUPOM_INEXISTENTE', mensagem: 'Cupom não encontrado.' });
      }
      throw e;
    }
  }

  /** Apelidos ou e-mails → ids. Lista todos os que não existem, para o admin corrigir de uma vez. */
  private async resolverDestinatarios(nomes: string[]) {
    if (nomes.length === 0) return [];
    const emails = nomes.filter((n) => n.includes('@')).map((n) => n.toLowerCase());
    const apelidos = nomes.filter((n) => !n.includes('@'));
    const achados = await this.prisma.usuario.findMany({
      where: {
        excluidoEm: null,
        OR: [{ email: { in: emails } }, { apelido: { in: apelidos, mode: 'insensitive' } }],
      },
      select: { id: true, apelido: true, email: true },
    });
    const faltando = nomes.filter((n) =>
      n.includes('@')
        ? !achados.some((u) => u.email === n.toLowerCase())
        : !achados.some((u) => u.apelido.toLowerCase() === n.toLowerCase()),
    );
    if (faltando.length > 0) {
      throw new UnprocessableEntityException({
        codigo: 'DESTINATARIO_INEXISTENTE',
        campo: 'destinatarios',
        mensagem: `Não encontrei: ${faltando.slice(0, 10).join(', ')}${faltando.length > 10 ? ` e mais ${faltando.length - 10}` : ''}.`,
        faltando,
      });
    }
    return [...new Set(achados.map((u) => u.id))];
  }
}
