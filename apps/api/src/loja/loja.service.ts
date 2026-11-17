import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { LojaCompra, Prisma } from '@prisma/client';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { diaLocal } from '../pacotes/dia';

const DADOS_DIR = process.env.DADOS_DIR ?? resolve(__dirname, '../../../../data/temporada1');

export interface Oferta {
  id: string;
  nome: string;
  pacotes: number;
  moedasBonus: number;
  precoReferenciaCentavos: number;
  destaque: string | null;
}

export interface ConfigLoja {
  moeda: string;
  pacoteComMoedas: { preco: number };
  ofertas: Oferta[];
  limites: { idadeMinimaParaComprar: number; maioridade: number; limiteMensalMenorCentavos: number };
}

export const CONFIG_LOJA: ConfigLoja = JSON.parse(readFileSync(resolve(DADOS_DIR, 'loja.json'), 'utf8'));

/** Modo de teste: compras simuladas, sem pagamento. Nunca liga em produção. */
export const modoTesteLigado = () => process.env.LOJA_TESTE === '1' && process.env.NODE_ENV !== 'production';

export interface DadosCredito {
  usuarioId: string;
  produtoId: string;
  transacaoId: string;
  loja: LojaCompra;
  ambiente: string;
  valorCentavos: number | null;
  moeda: string | null;
}

function idadeEm(nascimento: Date, hoje: Date): number {
  const [a, m, d] = diaLocal(hoje).split('-').map(Number);
  const n = nascimento.toISOString().slice(0, 10).split('-').map(Number);
  let idade = a - n[0];
  if (m < n[1] || (m === n[1] && d < n[2])) idade -= 1;
  return idade;
}

@Injectable()
export class LojaService {
  private readonly log = new Logger('Loja');

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Ofertas, saldo de moedas e se o jogador pode comprar agora (e por quê). */
  async catalogo(usuarioId: string, agora = new Date()) {
    const u = await this.prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    return {
      moeda: CONFIG_LOJA.moeda,
      ofertas: CONFIG_LOJA.ofertas,
      pacoteComMoedas: CONFIG_LOJA.pacoteComMoedas,
      moedas: u.moedas,
      compras: await this.situacao(usuarioId, u.dataNascimento, agora),
      modoTeste: modoTesteLigado(),
    };
  }

  /**
   * Limites de compra. Valem antes do pagamento (o app não deixa iniciar a compra);
   * depois que a loja cobrou, o servidor sempre credita.
   */
  async situacao(usuarioId: string, nascimento: Date | null, agora = new Date()) {
    const { idadeMinimaParaComprar, maioridade, limiteMensalMenorCentavos } = CONFIG_LOJA.limites;
    const gastoMesCentavos = await this.gastoNoMes(usuarioId, agora);
    if (!nascimento) {
      return { podeComprar: false, motivo: 'INFORME_NASCIMENTO', idade: null, gastoMesCentavos, limiteMesCentavos: null };
    }
    const idade = idadeEm(nascimento, agora);
    if (idade < idadeMinimaParaComprar) {
      return { podeComprar: false, motivo: 'IDADE_MINIMA', idade, gastoMesCentavos, limiteMesCentavos: 0 };
    }
    if (idade < maioridade) {
      const restante = limiteMensalMenorCentavos - gastoMesCentavos;
      return {
        podeComprar: restante > 0,
        motivo: restante > 0 ? null : 'LIMITE_MENSAL',
        idade,
        gastoMesCentavos,
        limiteMesCentavos: limiteMensalMenorCentavos,
      };
    }
    return { podeComprar: true, motivo: null, idade, gastoMesCentavos, limiteMesCentavos: null };
  }

  /** A data de nascimento é declarada uma única vez (evita trocar a data para fugir do limite). */
  async declararNascimento(usuarioId: string, data: Date, agora = new Date()) {
    const idade = idadeEm(data, agora);
    if (idade < 4 || idade > 110) {
      throw new BadRequestException({ codigo: 'ENTRADA_INVALIDA', campo: 'dataNascimento', mensagem: 'Data de nascimento inválida.' });
    }
    const r = await this.prisma.usuario.updateMany({ where: { id: usuarioId, dataNascimento: null }, data: { dataNascimento: data } });
    if (r.count === 0) {
      throw new ConflictException({
        codigo: 'NASCIMENTO_JA_INFORMADO',
        mensagem: 'A data de nascimento já foi informada. Para corrigir, fale com o suporte.',
      });
    }
    return this.catalogo(usuarioId, agora);
  }

  /** Compra simulada (só no modo de teste), respeitando os mesmos limites da compra real. */
  async compraTeste(usuarioId: string, produtoId: string, agora = new Date()) {
    if (!modoTesteLigado()) throw new NotFoundException();
    const oferta = this.oferta(produtoId);
    if (!oferta) throw new NotFoundException({ codigo: 'PRODUTO_INEXISTENTE', mensagem: `Produto ${produtoId} não existe.` });
    const u = await this.prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    const s = await this.situacao(usuarioId, u.dataNascimento, agora);
    if (!s.podeComprar) throw new ForbiddenException({ codigo: s.motivo, mensagem: this.explicar(s.motivo) });
    if (s.limiteMesCentavos !== null && s.gastoMesCentavos + oferta.precoReferenciaCentavos > s.limiteMesCentavos) {
      throw new ForbiddenException({ codigo: 'LIMITE_MENSAL', mensagem: this.explicar('LIMITE_MENSAL') });
    }
    return this.creditar({
      usuarioId,
      produtoId,
      transacaoId: `teste-${randomUUID()}`,
      loja: 'TESTE',
      ambiente: 'TESTE',
      valorCentavos: oferta.precoReferenciaCentavos,
      moeda: CONFIG_LOJA.moeda,
    });
  }

  /** Credita uma compra. Idempotente pelo transacaoId. */
  async creditar(d: DadosCredito) {
    const oferta = this.oferta(d.produtoId);
    if (!oferta) throw new NotFoundException({ codigo: 'PRODUTO_INEXISTENTE', mensagem: `Produto ${d.produtoId} não existe.` });
    try {
      return await this.prisma.$transaction(async (tx) => {
        const ja = await tx.compra.findUnique({ where: { transacaoId: d.transacaoId } });
        if (ja) return { compra: ja, jaCreditada: true };
        const compra = await tx.compra.create({
          data: { ...d, pacotes: oferta.pacotes, moedas: oferta.moedasBonus },
        });
        await tx.usuario.update({
          where: { id: d.usuarioId },
          data: { pacotesComprados: { increment: oferta.pacotes }, moedas: { increment: oferta.moedasBonus } },
        });
        return { compra, jaCreditada: false };
      });
    } catch (e) {
      // Dois avisos da mesma compra ao mesmo tempo: o segundo bate na chave única.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const compra = await this.prisma.compra.findUniqueOrThrow({ where: { transacaoId: d.transacaoId } });
        return { compra, jaCreditada: true };
      }
      throw e;
    }
  }

  /** Estorno (reembolso): marca a compra e retira o que ainda não foi usado. */
  async estornar(transacaoId: string) {
    return this.prisma.$transaction(async (tx) => {
      const compra = await tx.compra.findUnique({ where: { transacaoId } });
      if (!compra || compra.status === 'ESTORNADA') return { estornada: false };
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${compra.usuarioId} FOR UPDATE`;
      const u = await tx.usuario.findUniqueOrThrow({ where: { id: compra.usuarioId } });
      const pacotes = Math.min(compra.pacotes, u.pacotesComprados);
      const moedas = Math.min(compra.moedas, u.moedas);
      await tx.usuario.update({
        where: { id: u.id },
        data: { pacotesComprados: { decrement: pacotes }, moedas: { decrement: moedas } },
      });
      await tx.compra.update({ where: { id: compra.id }, data: { status: 'ESTORNADA', estornadaEm: new Date() } });
      if (pacotes < compra.pacotes) {
        this.log.warn(`Estorno ${transacaoId}: ${compra.pacotes - pacotes} pacote(s) já tinham sido abertos.`);
      }
      return { estornada: true, pacotesRetirados: pacotes, moedasRetiradas: moedas };
    });
  }

  /**
   * Webhook do RevenueCat. Configure no painel do RevenueCat o cabeçalho
   * Authorization com o mesmo valor de REVENUECAT_WEBHOOK_TOKEN.
   * O app identifica o jogador no RevenueCat com o id do usuário (app_user_id).
   */
  async webhookRevenueCat(autorizacao: string | undefined, corpo: unknown) {
    const segredo = process.env.REVENUECAT_WEBHOOK_TOKEN;
    if (!segredo) throw new NotFoundException();
    const recebido = Buffer.from((autorizacao ?? '').replace(/^Bearer\s+/i, ''));
    const esperado = Buffer.from(segredo);
    if (recebido.length !== esperado.length || !timingSafeEqual(recebido, esperado)) {
      throw new UnauthorizedException();
    }

    const evento = (corpo as { event?: Record<string, unknown> } | null)?.event;
    if (!evento || typeof evento.type !== 'string') return { ok: true, acao: 'ignorado', motivo: 'sem evento' };
    const tipo = evento.type;
    const transacaoId = typeof evento.transaction_id === 'string' ? evento.transaction_id : null;

    if (tipo === 'TEST') return { ok: true, acao: 'teste' };

    if (tipo === 'CANCELLATION' && transacaoId) {
      // Para compras avulsas (consumíveis), CANCELLATION indica reembolso.
      const r = await this.estornar(transacaoId);
      return { ok: true, acao: r.estornada ? 'estornada' : 'ignorado' };
    }

    if ((tipo === 'NON_RENEWING_PURCHASE' || tipo === 'INITIAL_PURCHASE') && transacaoId) {
      const usuarioId = String(evento.app_user_id ?? '');
      const produtoId = String(evento.product_id ?? '');
      const loja = evento.store === 'APP_STORE' ? 'APP_STORE' : evento.store === 'PLAY_STORE' ? 'PLAY_STORE' : null;
      const existe = /^[0-9a-f-]{36}$/i.test(usuarioId) && (await this.prisma.usuario.count({ where: { id: usuarioId } })) > 0;
      if (!loja || !existe || !this.oferta(produtoId)) {
        // Responde 200 para o RevenueCat não reenviar, mas registra para investigação.
        this.log.error(`Compra não creditada: loja=${String(evento.store)} usuario=${usuarioId} produto=${produtoId} transacao=${transacaoId}`);
        return { ok: true, acao: 'ignorado', motivo: 'compra com dados desconhecidos' };
      }
      const preco = evento.price_in_purchased_currency;
      const r = await this.creditar({
        usuarioId,
        produtoId,
        transacaoId,
        loja,
        ambiente: String(evento.environment ?? 'PRODUCTION'),
        valorCentavos: typeof preco === 'number' ? Math.round(preco * 100) : null,
        moeda: typeof evento.currency === 'string' ? evento.currency : null,
      });
      return { ok: true, acao: r.jaCreditada ? 'ja_creditada' : 'creditada' };
    }

    return { ok: true, acao: 'ignorado', motivo: `tipo ${tipo}` };
  }

  private oferta(id: string) {
    return CONFIG_LOJA.ofertas.find((o) => o.id === id);
  }

  private async gastoNoMes(usuarioId: string, agora: Date) {
    const inicioMes = new Date(`${diaLocal(agora).slice(0, 7)}-01T00:00:00-03:00`);
    const r = await this.prisma.compra.aggregate({
      where: { usuarioId, status: 'CREDITADA', criadaEm: { gte: inicioMes }, moeda: CONFIG_LOJA.moeda },
      _sum: { valorCentavos: true },
    });
    return r._sum.valorCentavos ?? 0;
  }

  private explicar(motivo: string | null) {
    return (
      {
        INFORME_NASCIMENTO: 'Informe sua data de nascimento antes de comprar.',
        IDADE_MINIMA: `Compras só a partir de ${CONFIG_LOJA.limites.idadeMinimaParaComprar} anos.`,
        LIMITE_MENSAL: 'Esta compra passaria do limite mensal para menores de 18 anos.',
      } as Record<string, string>
    )[motivo ?? ''] ?? 'Compra não permitida.';
  }
}
