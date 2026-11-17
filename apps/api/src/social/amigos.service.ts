import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Tx, resumoUsuario, travarUsuarios } from './comum';

@Injectable()
export class AmigosService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listar(eu: string) {
    const amizades = await this.prisma.amizade.findMany({
      where: { OR: [{ solicitanteId: eu }, { destinatarioId: eu }] },
      include: { solicitante: resumoUsuario, destinatario: resumoUsuario },
      orderBy: { criadaEm: 'desc' },
    });
    const outro = (a: (typeof amizades)[number]) => (a.solicitanteId === eu ? a.destinatario : a.solicitante);
    return {
      amigos: amizades
        .filter((a) => a.status === 'ACEITA')
        .map((a) => ({ id: a.id, usuario: outro(a), desde: a.aceitaEm }))
        .sort((x, y) => x.usuario.apelido.localeCompare(y.usuario.apelido)),
      recebidos: amizades
        .filter((a) => a.status === 'PENDENTE' && a.destinatarioId === eu)
        .map((a) => ({ id: a.id, usuario: a.solicitante, criadaEm: a.criadaEm })),
      enviados: amizades
        .filter((a) => a.status === 'PENDENTE' && a.solicitanteId === eu)
        .map((a) => ({ id: a.id, usuario: a.destinatario, criadaEm: a.criadaEm })),
    };
  }

  /** Envia pedido de amizade pelo apelido. Se o outro já tinha pedido, a amizade é aceita na hora. */
  async pedir(eu: string, apelido: string) {
    const alvo = await this.prisma.usuario.findFirst({
      where: { apelido: { equals: apelido, mode: 'insensitive' } },
      select: { id: true, apelido: true },
    });
    if (!alvo) throw new NotFoundException({ codigo: 'USUARIO_INEXISTENTE', mensagem: `Ninguém com o apelido ${apelido}.` });
    if (alvo.id === eu) throw new BadRequestException({ codigo: 'PEDIDO_PARA_SI', mensagem: 'Você não pode adicionar a si mesmo.' });

    return this.prisma.$transaction(async (tx) => {
      await travarUsuarios(tx, [eu, alvo.id]);
      const existente = await this.entre(tx, eu, alvo.id);
      if (existente?.status === 'ACEITA') {
        throw new ConflictException({ codigo: 'JA_SAO_AMIGOS', mensagem: `Você e ${alvo.apelido} já são amigos.` });
      }
      if (existente && existente.solicitanteId === eu) {
        throw new ConflictException({ codigo: 'PEDIDO_JA_ENVIADO', mensagem: `Você já pediu amizade a ${alvo.apelido}.` });
      }
      if (existente) {
        await tx.amizade.update({ where: { id: existente.id }, data: { status: 'ACEITA', aceitaEm: new Date() } });
        return { status: 'ACEITA' as const, usuario: alvo };
      }
      await tx.amizade.create({ data: { solicitanteId: eu, destinatarioId: alvo.id } });
      return { status: 'PENDENTE' as const, usuario: alvo };
    });
  }

  async aceitar(eu: string, amizadeId: string) {
    const a = await this.buscar(amizadeId, eu);
    if (a.destinatarioId !== eu) throw new ForbiddenException({ codigo: 'NAO_PERMITIDO', mensagem: 'Só quem recebeu o pedido pode aceitar.' });
    if (a.status === 'ACEITA') return { status: 'ACEITA' };
    await this.prisma.amizade.update({ where: { id: a.id }, data: { status: 'ACEITA', aceitaEm: new Date() } });
    return { status: 'ACEITA' };
  }

  /** Recusa um pedido, cancela um pedido enviado ou desfaz uma amizade. Propostas de troca pendentes entre os dois são canceladas. */
  async remover(eu: string, amizadeId: string) {
    const a = await this.buscar(amizadeId, eu);
    const outro = a.solicitanteId === eu ? a.destinatarioId : a.solicitanteId;
    await this.prisma.$transaction([
      this.prisma.amizade.delete({ where: { id: a.id } }),
      this.prisma.troca.updateMany({
        where: {
          status: 'PENDENTE',
          OR: [
            { propostaPorId: eu, paraId: outro },
            { propostaPorId: outro, paraId: eu },
          ],
        },
        data: { status: 'CANCELADA', motivo: 'AMIZADE_DESFEITA', respondidaEm: new Date() },
      }),
    ]);
  }

  async saoAmigos(tx: Tx, a: string, b: string) {
    return (await this.entre(tx, a, b))?.status === 'ACEITA';
  }

  async idsDosAmigos(eu: string) {
    const lista = await this.prisma.amizade.findMany({
      where: { status: 'ACEITA', OR: [{ solicitanteId: eu }, { destinatarioId: eu }] },
      select: { solicitanteId: true, destinatarioId: true },
    });
    return lista.map((a) => (a.solicitanteId === eu ? a.destinatarioId : a.solicitanteId));
  }

  private entre(tx: Tx, a: string, b: string) {
    return tx.amizade.findFirst({
      where: {
        OR: [
          { solicitanteId: a, destinatarioId: b },
          { solicitanteId: b, destinatarioId: a },
        ],
      },
    });
  }

  private async buscar(amizadeId: string, eu: string) {
    const a = await this.prisma.amizade.findUnique({ where: { id: amizadeId } });
    // Quem não faz parte da amizade recebe o mesmo erro de "não existe".
    if (!a || (a.solicitanteId !== eu && a.destinatarioId !== eu)) {
      throw new NotFoundException({ codigo: 'AMIZADE_INEXISTENTE', mensagem: 'Pedido ou amizade não encontrado.' });
    }
    return a;
  }
}
