import {
  CanActivate,
  ExecutionContext,
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

export const UsuarioAtual = createParamDecorator(
  (_: unknown, contexto: ExecutionContext): UsuarioAutenticado => contexto.switchToHttp().getRequest().usuario,
);
