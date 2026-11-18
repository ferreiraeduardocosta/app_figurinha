import { ConflictException, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { HASH_FALSO, conferirSenha, gerarHashSenha } from './senha';

const DURACAO_SESSAO_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

export interface UsuarioAutenticado {
  id: string;
  apelido: string;
  papel: 'JOGADOR' | 'ADMIN';
  sessaoId: string;
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async cadastrar(apelido: string, email: string, senha: string) {
    const senhaHash = await gerarHashSenha(senha);
    try {
      const usuario = await this.prisma.usuario.create({ data: { apelido, email, senhaHash } });
      return this.criarSessao(usuario.id, usuario.apelido, usuario.papel);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const campo = String((e.meta?.target as string[] | undefined)?.[0] ?? 'email');
        throw new ConflictException({
          codigo: 'JA_CADASTRADO',
          campo,
          mensagem: campo === 'apelido' ? 'Esse apelido já está em uso.' : 'Esse e-mail já tem cadastro.',
        });
      }
      throw e;
    }
  }

  async entrar(email: string, senha: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });
    // Confere a senha mesmo sem usuário, para o tempo de resposta ser parecido.
    const ok = await conferirSenha(senha, usuario?.senhaHash ?? HASH_FALSO);
    if (!usuario || !ok) {
      throw new UnauthorizedException({ codigo: 'CREDENCIAIS_INVALIDAS', mensagem: 'E-mail ou senha incorretos.' });
    }
    return this.criarSessao(usuario.id, usuario.apelido, usuario.papel);
  }

  /**
   * Exclui a conta (LGPD e exigência das lojas). Sem compras: apaga tudo.
   * Com compras: os registros financeiros precisam ser guardados, então a conta
   * é anonimizada (sem nome, e-mail, nascimento, álbum, amizades, trocas ou sessões).
   */
  async excluirConta(usuarioId: string, senha: string) {
    const u = await this.prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    if (!(await conferirSenha(senha, u.senhaHash))) {
      throw new ForbiddenException({ codigo: 'SENHA_INCORRETA', mensagem: 'Senha incorreta.' });
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${usuarioId} FOR UPDATE`;
      const compras = await tx.compra.count({ where: { usuarioId } });
      if (compras === 0) {
        await tx.usuario.delete({ where: { id: usuarioId } });
        return { resultado: 'APAGADA' as const };
      }
      const outro = { OR: [{ solicitanteId: usuarioId }, { destinatarioId: usuarioId }] };
      await tx.sessao.deleteMany({ where: { usuarioId } });
      await tx.itemAlbum.deleteMany({ where: { usuarioId } });
      await tx.recompensa.deleteMany({ where: { usuarioId } });
      await tx.missaoDia.deleteMany({ where: { usuarioId } });
      await tx.aberturaPacote.deleteMany({ where: { usuarioId } });
      await tx.amizade.deleteMany({ where: outro });
      await tx.troca.deleteMany({ where: { OR: [{ propostaPorId: usuarioId }, { paraId: usuarioId }] } });
      const marca = randomUUID();
      await tx.usuario.update({
        where: { id: usuarioId },
        data: {
          apelido: `excluido_${marca.slice(0, 8)}`,
          email: `excluido-${marca}@excluido.invalid`,
          senhaHash: 'excluida',
          papel: 'JOGADOR',
          dataNascimento: null,
          moedas: 0,
          pacotesBonus: 0,
          pacotesComprados: 0,
          pacotesSemEpica: 0,
          pacotesSemLendaria: 0,
          ultimoPacoteDiarioEm: null,
          excluidoEm: new Date(),
        },
      });
      return { resultado: 'ANONIMIZADA' as const };
    });
  }

  async sair(sessaoId: string) {
    await this.prisma.sessao.deleteMany({ where: { id: sessaoId } });
  }

  /** Devolve o usuário dono do token, ou null se o token não existe ou expirou. */
  async validarToken(token: string): Promise<UsuarioAutenticado | null> {
    const sessao = await this.prisma.sessao.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { usuario: { select: { id: true, apelido: true, papel: true } } },
    });
    if (!sessao) return null;
    if (sessao.expiraEm.getTime() <= Date.now()) {
      await this.prisma.sessao.delete({ where: { id: sessao.id } }).catch(() => undefined);
      return null;
    }
    return { id: sessao.usuario.id, apelido: sessao.usuario.apelido, papel: sessao.usuario.papel, sessaoId: sessao.id };
  }

  private async criarSessao(usuarioId: string, apelido: string, papel: 'JOGADOR' | 'ADMIN') {
    const token = randomBytes(32).toString('base64url');
    const expiraEm = new Date(Date.now() + DURACAO_SESSAO_MS);
    await this.prisma.sessao.create({ data: { usuarioId, tokenHash: hashToken(token), expiraEm } });
    return { token, expiraEm, usuario: { id: usuarioId, apelido, papel } };
  }
}
