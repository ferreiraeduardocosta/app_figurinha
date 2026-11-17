import type { Raridade } from './tema';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface Clube {
  sigla: string;
  nome: string;
  cidade: string;
  corPrimaria: string;
  corSecundaria: string;
  estadio: string;
  mascote: string;
  lema: string;
}

export type TipoFigurinha = 'ESCUDO' | 'ESTADIO' | 'TECNICO' | 'JOGADOR' | 'MASCOTE' | 'LENDA' | 'MOMENTO';

export interface Figurinha {
  codigo: string;
  numero: number;
  secao: string;
  clubeSigla: string;
  tipo: TipoFigurinha;
  raridade: Raridade;
  nome: string;
  apelido: string | null;
  posicao: string | null;
  camisa: number | null;
  idade: number | null;
  destaque: string | null;
  historia: string;
  ataque: number | null;
  defesa: number | null;
  tecnica: number | null;
  velocidade: number | null;
  fisico: number | null;
}

export interface Perfil {
  id: string;
  apelido: string;
  email: string;
  moedas: number;
  pacoteDiario: { disponivel: boolean; proximoEm: string | null };
  garantia: { pacotesParaEpica: number; pacotesParaLendaria: number };
  album: { coladas: number; total: number };
}

export interface ItemAlbum {
  codigo: string;
  quantidade: number;
  brilhantes: number;
}

export interface Album {
  itens: ItemAlbum[];
  repetidas: Record<Raridade, number>;
  balcao: { repetidasPorNova: number };
}

export interface FigurinhaSorteada {
  codigo: string;
  raridade: Raridade;
  brilhante: boolean;
  garantida: boolean;
  nova: boolean;
}

export interface Probabilidades {
  figurinhasPorPacote: number;
  porFigurinha: Record<Raridade, number>;
  garantia: { epicaACadaPacotes: number; lendariaACadaPacotes: number };
  brilhante: number;
  balcao: { repetidasPorNova: number };
}

export interface Sessao {
  token: string;
  usuario: { id: string; apelido: string };
}

/** Erro devolvido pela API: { codigo, mensagem }. */
export class ErroApi extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    mensagem: string,
    public readonly dados: Record<string, unknown> = {},
  ) {
    super(mensagem);
  }
}

async function chamar<T>(metodo: string, rota: string, token?: string | null, corpo?: unknown): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(API_URL + rota, {
      method: metodo,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    throw new ErroApi(0, 'SEM_CONEXAO', `Não foi possível falar com o servidor (${API_URL}).`);
  }
  const texto = await resposta.text();
  const dados = texto ? JSON.parse(texto) : null;
  if (!resposta.ok) {
    const msg = Array.isArray(dados?.message) ? dados.message.join(' ') : dados?.mensagem ?? dados?.message;
    throw new ErroApi(resposta.status, dados?.codigo ?? 'ERRO', msg ?? 'Algo deu errado. Tente de novo.', dados ?? {});
  }
  return dados as T;
}

export const api = {
  clubes: () => chamar<Clube[]>('GET', '/clubes'),
  figurinhas: () => chamar<Figurinha[]>('GET', '/figurinhas'),
  probabilidades: () => chamar<Probabilidades>('GET', '/probabilidades'),
  cadastrar: (apelido: string, email: string, senha: string) =>
    chamar<Sessao>('POST', '/auth/cadastro', null, { apelido, email, senha }),
  entrar: (email: string, senha: string) => chamar<Sessao>('POST', '/auth/entrar', null, { email, senha }),
  sair: (token: string) => chamar<void>('POST', '/auth/sair', token),
  perfil: (token: string) => chamar<Perfil>('GET', '/eu', token),
  album: (token: string) => chamar<Album>('GET', '/album', token),
  abrirPacoteDiario: (token: string) =>
    chamar<{ figurinhas: FigurinhaSorteada[] }>('POST', '/pacotes/diario', token),
  balcao: (token: string, codigo: string) =>
    chamar<{ recebida: string; consumidas: Record<string, number> }>('POST', '/balcao', token, { codigo }),
};
