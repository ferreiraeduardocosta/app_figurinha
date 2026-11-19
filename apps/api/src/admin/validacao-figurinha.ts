import { BadRequestException } from '@nestjs/common';
import { Raridade, TipoFigurinha } from '@prisma/client';

const RARIDADES: Raridade[] = ['COMUM', 'RARA', 'EPICA', 'LENDARIA'];
const TIPOS: TipoFigurinha[] = ['ESCUDO', 'ESTADIO', 'TECNICO', 'JOGADOR', 'MASCOTE', 'LENDA', 'MOMENTO'];
const POSICOES = ['GOL', 'ZAG', 'LAT', 'VOL', 'MEI', 'PON', 'ATA', 'TEC'];
const ATRIBUTOS = ['ataque', 'defesa', 'tecnica', 'velocidade', 'fisico'] as const;

/** Campos que o painel pode alterar numa figurinha existente. */
export interface CamposEditaveis {
  nome?: string;
  apelido?: string | null;
  posicao?: string | null;
  camisa?: number | null;
  idade?: number | null;
  raridade?: Raridade;
  tipo?: TipoFigurinha;
  destaque?: string | null;
  historia?: string;
  descricaoVisual?: string;
  ataque?: number | null;
  defesa?: number | null;
  tecnica?: number | null;
  velocidade?: number | null;
  fisico?: number | null;
}

export interface CamposNovaFigurinha extends CamposEditaveis {
  codigo: string;
  numero: number;
  temporada: number;
  secao: string;
  clubeSigla: string;
  nome: string;
  raridade: Raridade;
  tipo: TipoFigurinha;
  historia: string;
  descricaoVisual: string;
}

/** Nome de cada campo como aparece no painel, para as mensagens de erro. */
const ROTULOS: Record<string, string> = {
  codigo: 'Código', numero: 'Número no álbum', temporada: 'Temporada', secao: 'Seção do álbum', clubeSigla: 'Clube', nome: 'Nome',
  apelido: 'Apelido', posicao: 'Posição', camisa: 'Camisa', idade: 'Idade', raridade: 'Raridade', tipo: 'Tipo',
  destaque: 'Traço especial / destaque', historia: 'Mini-história', descricaoVisual: 'Descrição visual',
  ataque: 'ATA', defesa: 'DEF', tecnica: 'TEC', velocidade: 'VEL', fisico: 'FIS',
};
const rotulo = (campo: string) => ROTULOS[campo] ?? campo;

function invalido(campo: string, mensagem: string): never {
  throw new BadRequestException({ codigo: 'ENTRADA_INVALIDA', campo, mensagem });
}

function texto(c: Record<string, unknown>, campo: string, min: number, max: number, anulavel: boolean) {
  const v = c[campo];
  if (v === null || (anulavel && v === '')) {
    if (!anulavel) invalido(campo, `${rotulo(campo)} é obrigatório.`);
    return null;
  }
  if (typeof v !== 'string') invalido(campo, `${rotulo(campo)} deve ser texto.`);
  const t = v.trim();
  if (t.length < min || t.length > max) invalido(campo, `${rotulo(campo)} deve ter entre ${min} e ${max} caracteres.`);
  return t;
}

function inteiro(c: Record<string, unknown>, campo: string, min: number, max: number, anulavel: boolean) {
  const v = c[campo];
  if (v === null || v === '') {
    if (!anulavel) invalido(campo, `${rotulo(campo)} é obrigatório.`);
    return null;
  }
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) {
    invalido(campo, `${rotulo(campo)} deve ser um número inteiro de ${min} a ${max}.`);
  }
  return v;
}

function opcao<T extends string>(c: Record<string, unknown>, campo: string, opcoes: readonly T[]): T {
  const v = c[campo];
  if (typeof v !== 'string' || !opcoes.includes(v as T)) invalido(campo, `${rotulo(campo)} deve ser um de: ${opcoes.join(', ')}.`);
  return v as T;
}

/** Valida só os campos presentes no corpo (para edição). */
export function validarEdicao(corpo: unknown): CamposEditaveis {
  if (typeof corpo !== 'object' || corpo === null || Array.isArray(corpo)) invalido('corpo', 'Envie um objeto JSON.');
  const c = corpo as Record<string, unknown>;
  const permitidos = new Set<string>([
    'nome', 'apelido', 'posicao', 'camisa', 'idade', 'raridade', 'tipo', 'destaque', 'historia', 'descricaoVisual', ...ATRIBUTOS,
  ]);
  const desconhecido = Object.keys(c).find((k) => !permitidos.has(k));
  if (desconhecido) invalido(desconhecido, `O campo ${desconhecido} não pode ser alterado.`);

  const r: CamposEditaveis = {};
  if ('nome' in c) r.nome = texto(c, 'nome', 1, 60, false)!;
  if ('apelido' in c) r.apelido = texto(c, 'apelido', 1, 30, true);
  if ('posicao' in c) {
    r.posicao = c.posicao === null || c.posicao === '' ? null : opcao(c, 'posicao', POSICOES);
  }
  if ('camisa' in c) r.camisa = inteiro(c, 'camisa', 1, 99, true);
  if ('idade' in c) r.idade = inteiro(c, 'idade', 15, 80, true);
  if ('raridade' in c) r.raridade = opcao(c, 'raridade', RARIDADES);
  if ('tipo' in c) r.tipo = opcao(c, 'tipo', TIPOS);
  if ('destaque' in c) r.destaque = texto(c, 'destaque', 1, 120, true);
  if ('historia' in c) r.historia = texto(c, 'historia', 1, 500, false)!;
  if ('descricaoVisual' in c) r.descricaoVisual = texto(c, 'descricaoVisual', 1, 500, false)!;

  const atributosPresentes = ATRIBUTOS.filter((a) => a in c);
  if (atributosPresentes.length) {
    if (atributosPresentes.length !== ATRIBUTOS.length) {
      invalido('atributos', 'Envie os 5 atributos juntos (ou os 5 vazios).');
    }
    const valores = ATRIBUTOS.map((a) => inteiro(c, a, 30, 99, true));
    const vazios = valores.filter((v) => v === null).length;
    if (vazios !== 0 && vazios !== ATRIBUTOS.length) invalido('atributos', 'Preencha os 5 atributos ou deixe os 5 vazios.');
    ATRIBUTOS.forEach((a, i) => (r[a] = valores[i]));
  }
  return r;
}

/** Valida uma figurinha nova: identificação + todos os campos obrigatórios. */
export function validarNova(corpo: unknown): CamposNovaFigurinha {
  if (typeof corpo !== 'object' || corpo === null || Array.isArray(corpo)) invalido('corpo', 'Envie um objeto JSON.');
  const c = { ...(corpo as Record<string, unknown>) };
  const codigo = texto(c, 'codigo', 6, 10, false)!.toUpperCase();
  const temporada = 'temporada' in c ? inteiro(c, 'temporada', 1, 99, false)! : 1;
  // Temporada 1: ABC-01. Outras: T2-ABC-01 (os clubes se repetem entre temporadas).
  const esperado = temporada === 1 ? /^[A-Z]{3}-\d{2}$/ : new RegExp(`^T${temporada}-[A-Z]{3}-\\d{2}$`);
  if (!esperado.test(codigo)) invalido('codigo', temporada === 1 ? 'Código no formato ABC-01.' : `Código no formato T${temporada}-ABC-01.`);
  const numero = inteiro(c, 'numero', 1, 9999, false)!;
  const secao = texto(c, 'secao', 1, 60, false)!;
  const clubeSigla = texto(c, 'clubeSigla', 3, 3, false)!.toUpperCase();
  for (const k of ['codigo', 'numero', 'temporada', 'secao', 'clubeSigla']) delete c[k];
  for (const k of ['nome', 'raridade', 'tipo', 'historia', 'descricaoVisual']) {
    if (!(k in c)) invalido(k, `${rotulo(k)} é obrigatório.`);
  }
  const resto = validarEdicao(c);
  return { ...resto, codigo, numero, temporada, secao, clubeSigla } as CamposNovaFigurinha;
}
