import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { AuthService, UsuarioAutenticado } from './auth.service';

/** Exige "Authorization: Bearer <token>" válido e coloca o usuário em req.usuario. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const req = contexto.switchToHttp().getRequest();
    const cabecalho: unknown = req.headers?.authorization;
    const token = typeof cabecalho === 'string' && cabecalho.startsWith('Bearer ') ? cabecalho.slice(7).trim() : '';
    const usuario = token ? await this.auth.validarToken(token) : null;
    if (!usuario) {
      throw new UnauthorizedException({ codigo: 'NAO_AUTENTICADO', mensagem: 'Entre na sua conta para continuar.' });
    }
    req.usuario = usuario;
    return true;
  }
}

/** Exige login de um usuário com papel ADMIN. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(AuthGuard) private readonly auth: AuthGuard) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    await this.auth.canActivate(contexto);
    if (contexto.switchToHttp().getRequest().usuario?.papel !== 'ADMIN') {
      throw new ForbiddenException({ codigo: 'SO_ADMIN', mensagem: 'Área restrita a administradores.' });
    }
    return true;
  }
}

export const UsuarioAtual = createParamDecorator(
  (_: unknown, contexto: ExecutionContext): UsuarioAutenticado => contexto.switchToHttp().getRequest().usuario,
);
