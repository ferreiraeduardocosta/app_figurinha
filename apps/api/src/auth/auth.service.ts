import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { HASH_FALSO, conferirSenha, gerarHashSenha } from './senha';

const DURACAO_SESSAO_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

export interface UsuarioAutenticado {
  id: string;
  apelido: string;
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
      return this.criarSessao(usuario.id, usuario.apelido);
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
    return this.criarSessao(usuario.id, usuario.apelido);
  }

  async sair(sessaoId: string) {
    await this.prisma.sessao.deleteMany({ where: { id: sessaoId } });
  }

  /** Devolve o usuário dono do token, ou null se o token não existe ou expirou. */
  async validarToken(token: string): Promise<UsuarioAutenticado | null> {
    const sessao = await this.prisma.sessao.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { usuario: { select: { id: true, apelido: true } } },
    });
    if (!sessao) return null;
    if (sessao.expiraEm.getTime() <= Date.now()) {
      await this.prisma.sessao.delete({ where: { id: sessao.id } }).catch(() => undefined);
      return null;
    }
    return { id: sessao.usuario.id, apelido: sessao.usuario.apelido, sessaoId: sessao.id };
  }

  private async criarSessao(usuarioId: string, apelido: string) {
    const token = randomBytes(32).toString('base64url');
    const expiraEm = new Date(Date.now() + DURACAO_SESSAO_MS);
    await this.prisma.sessao.create({ data: { usuarioId, tokenHash: hashToken(token), expiraEm } });
    return { token, expiraEm, usuario: { id: usuarioId, apelido } };
  }
}
