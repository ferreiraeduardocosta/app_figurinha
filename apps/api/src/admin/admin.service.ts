import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Figurinha, Prisma } from '@prisma/client';
import { ErroRegra, Raridade, indexarCatalogo } from '@liga-aurora/regras';
import { UsuarioAutenticado } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { diaLocal } from '../pacotes/dia';
import { CONFIG_ECONOMIA } from '../pacotes/economia';
import { PacotesService } from '../pacotes/pacotes.service';
import { CamposEditaveis, CamposNovaFigurinha } from './validacao-figurinha';

@Injectable()
export class AdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PacotesService) private readonly pacotes: PacotesService,
  ) {}

  /** Números gerais e conferência do sorteio: raridades que saíram x probabilidades configuradas. */
  async resumo(agora = new Date()) {
    const inicioDoDia = new Date(`${diaLocal(agora)}T00:00:00-03:00`);
    const [usuarios, admins, aberturas, aberturasHoje, figurinhas, sorteio] = await Promise.all([
      this.prisma.usuario.count(),
      this.prisma.usuario.count({ where: { papel: 'ADMIN' } }),
      this.prisma.aberturaPacote.count(),
      this.prisma.aberturaPacote.count({ where: { criadoEm: { gte: inicioDoDia } } }),
      this.prisma.figurinha.count(),
      this.prisma.$queryRaw<{ raridade: Raridade; garantida: boolean; brilhante: boolean; total: bigint }[]>`
        SELECT f->>'raridade' AS raridade,
               (f->>'garantida')::boolean AS garantida,
               (f->>'brilhante')::boolean AS brilhante,
               COUNT(*) AS total
        FROM "AberturaPacote", jsonb_array_elements("resultado") AS f
        GROUP BY 1, 2, 3`,
    ]);

    const naturais: Record<Raridade, number> = { COMUM: 0, RARA: 0, EPICA: 0, LENDARIA: 0 };
    let garantidas = 0;
    let brilhantes = 0;
    let totalFigurinhas = 0;
    for (const linha of sorteio) {
      const n = Number(linha.total);
      totalFigurinhas += n;
      if (linha.brilhante) brilhantes += n;
      if (linha.garantida) garantidas += n;
      else naturais[linha.raridade] += n;
    }
    const totalNaturais = totalFigurinhas - garantidas;
    return {
      usuarios,
      admins,
      aberturas,
      aberturasHoje,
      figurinhasNoCatalogo: figurinhas,
      sorteio: {
        figurinhasSorteadas: totalFigurinhas,
        garantidas,
        brilhantes,
        brilhanteEsperado: CONFIG_ECONOMIA.brilhante.chancePorFigurinha,
        // Sem contar as que vieram da garantia mínima, que distorcem a proporção.
        porRaridade: (Object.keys(naturais) as Raridade[]).map((r) => ({
          raridade: r,
          quantidade: naturais[r],
          observado: totalNaturais ? naturais[r] / totalNaturais : 0,
          esperado: CONFIG_ECONOMIA.probabilidades[r],
        })),
      },
    };
  }

  async listarFigurinhas() {
    const lista = await this.prisma.figurinha.findMany({
      orderBy: { numero: 'asc' },
      include: { _count: { select: { itens: { where: { quantidade: { gt: 0 } } } } } },
    });
    return lista.map(({ _count, ...f }) => ({ ...f, donos: _count.itens }));
  }

  async editarFigurinha(admin: UsuarioAutenticado, codigo: string, campos: CamposEditaveis) {
    const atual = await this.buscar(codigo);
    if (campos.raridade && campos.raridade !== atual.raridade) {
      await this.conferirCatalogo((lista) =>
        lista.map((f) => (f.codigo === codigo ? { ...f, raridade: campos.raridade! } : f)),
      );
    }
    const { antes, depois } = diferencas(atual, campos);
    if (!Object.keys(depois).length) return atual;

    const nova = await this.prisma.$transaction(async (tx) => {
      const f = await tx.figurinha.update({ where: { codigo }, data: campos });
      await tx.alteracaoAdmin.create({
        data: {
          adminId: admin.id,
          adminApelido: admin.apelido,
          acao: 'EDITAR',
          figurinhaCodigo: codigo,
          antes: antes as Prisma.InputJsonValue,
          depois: depois as Prisma.InputJsonValue,
        },
      });
      return f;
    });
    if ('raridade' in depois) await this.pacotes.recarregarCatalogo();
    return nova;
  }

  async criarFigurinha(admin: UsuarioAutenticado, campos: CamposNovaFigurinha) {
    const clube = await this.prisma.clube.findUnique({ where: { sigla: campos.clubeSigla } });
    if (!clube) {
      throw new UnprocessableEntityException({ codigo: 'CLUBE_INEXISTENTE', campo: 'clubeSigla', mensagem: `Clube ${campos.clubeSigla} não existe.` });
    }
    try {
      const nova = await this.prisma.$transaction(async (tx) => {
        const f = await tx.figurinha.create({ data: campos });
        await tx.alteracaoAdmin.create({
          data: {
            adminId: admin.id,
            adminApelido: admin.apelido,
            acao: 'CRIAR',
            figurinhaCodigo: f.codigo,
            depois: campos as unknown as Prisma.InputJsonValue,
          },
        });
        return f;
      });
      await this.pacotes.recarregarCatalogo();
      return nova;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({ codigo: 'JA_EXISTE', mensagem: 'Já existe figurinha com esse código ou número.' });
      }
      throw e;
    }
  }

  async excluirFigurinha(admin: UsuarioAutenticado, codigo: string) {
    const atual = await this.buscar(codigo);
    const donos = await this.prisma.itemAlbum.count({ where: { figurinhaCodigo: codigo } });
    if (donos > 0) {
      throw new ConflictException({
        codigo: 'FIGURINHA_EM_USO',
        mensagem: `${donos} jogador(es) já têm esta figurinha; ela não pode ser excluída.`,
      });
    }
    await this.conferirCatalogo((lista) => lista.filter((f) => f.codigo !== codigo));
    await this.prisma.$transaction([
      this.prisma.figurinha.delete({ where: { codigo } }),
      this.prisma.alteracaoAdmin.create({
        data: {
          adminId: admin.id,
          adminApelido: admin.apelido,
          acao: 'EXCLUIR',
          figurinhaCodigo: codigo,
          antes: atual as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);
    await this.pacotes.recarregarCatalogo();
  }

  listarAlteracoes() {
    return this.prisma.alteracaoAdmin.findMany({ orderBy: { criadoEm: 'desc' }, take: 100 });
  }

  async listarUsuarios(busca?: string) {
    const termo = busca?.trim();
    const usuarios = await this.prisma.usuario.findMany({
      where: termo
        ? { OR: [{ apelido: { contains: termo, mode: 'insensitive' } }, { email: { contains: termo, mode: 'insensitive' } }] }
        : undefined,
      orderBy: { criadoEm: 'desc' },
      take: 50,
      select: {
        id: true,
        apelido: true,
        email: true,
        papel: true,
        criadoEm: true,
        moedas: true,
        _count: { select: { album: { where: { quantidade: { gt: 0 } } }, aberturas: true } },
      },
    });
    return usuarios.map(({ _count, ...u }) => ({ ...u, coladas: _count.album, pacotesAbertos: _count.aberturas }));
  }

  private async buscar(codigo: string) {
    const f = await this.prisma.figurinha.findUnique({ where: { codigo } });
    if (!f) throw new NotFoundException({ codigo: 'FIGURINHA_INEXISTENTE', mensagem: `Figurinha ${codigo} não existe.` });
    return f;
  }

  /** Garante que a mudança não deixa nenhuma raridade sem figurinhas (o sorteio quebraria). */
  private async conferirCatalogo(mudar: (lista: { codigo: string; raridade: Raridade }[]) => { codigo: string; raridade: Raridade }[]) {
    const lista = await this.prisma.figurinha.findMany({ select: { codigo: true, raridade: true } });
    try {
      indexarCatalogo(mudar(lista), CONFIG_ECONOMIA);
    } catch (e) {
      if (e instanceof ErroRegra) {
        throw new UnprocessableEntityException({ codigo: 'CATALOGO_INVALIDO', mensagem: e.message });
      }
      throw e;
    }
  }
}

function diferencas(atual: Figurinha, campos: CamposEditaveis) {
  const antes: Record<string, unknown> = {};
  const depois: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(campos)) {
    const anterior = atual[k as keyof Figurinha];
    if (anterior !== v) {
      antes[k] = anterior;
      depois[k] = v;
    }
  }
  return { antes, depois };
}
