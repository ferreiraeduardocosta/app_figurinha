import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard, UsuarioAtual } from '../auth/auth.guard';
import { UsuarioAutenticado } from '../auth/auth.service';
import { AdminService } from './admin.service';
import { TestesService } from './testes.service';
import { validarEdicao, validarNova } from './validacao-figurinha';

/** Rotas do painel de administração. Exigem login com papel ADMIN. */
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    @Inject(AdminService) private readonly admin: AdminService,
    @Inject(TestesService) private readonly testes: TestesService,
  ) {}

  @Get('resumo')
  resumo() {
    return this.admin.resumo();
  }

  @Get('figurinhas')
  figurinhas() {
    return this.admin.listarFigurinhas();
  }

  @Post('figurinhas')
  criar(@UsuarioAtual() u: UsuarioAutenticado, @Body() corpo: unknown) {
    return this.admin.criarFigurinha(u, validarNova(corpo));
  }

  @Patch('figurinhas/:codigo')
  editar(@UsuarioAtual() u: UsuarioAutenticado, @Param('codigo') codigo: string, @Body() corpo: unknown) {
    return this.admin.editarFigurinha(u, codigo.toUpperCase(), validarEdicao(corpo));
  }

  @Delete('figurinhas/:codigo')
  @HttpCode(204)
  async excluir(@UsuarioAtual() u: UsuarioAutenticado, @Param('codigo') codigo: string) {
    await this.admin.excluirFigurinha(u, codigo.toUpperCase());
  }

  @Get('alteracoes')
  alteracoes() {
    return this.admin.listarAlteracoes();
  }

  @Get('usuarios')
  usuarios(@Query('busca') busca?: string) {
    return this.admin.listarUsuarios(typeof busca === 'string' ? busca.slice(0, 100) : undefined);
  }

  // ---------------- Fase de testes ----------------

  @Get('testes')
  situacaoTestes() {
    return this.testes.situacao();
  }

  @Post('testes/liga')
  @HttpCode(200)
  reiniciarLiga(@Body() corpo: Record<string, unknown>) {
    const c = corpo ?? {};
    return this.testes.reiniciarLiga(c.primeiraRodada, c.intervalo, c.unidade);
  }

  @Post('testes/zerar-progresso')
  @HttpCode(200)
  zerarProgresso(@Body() corpo: Record<string, unknown>) {
    return this.testes.zerarProgresso(corpo?.confirmacao);
  }
}
