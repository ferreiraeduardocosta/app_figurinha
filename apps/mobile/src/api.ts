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
  pacotesBonus: number;
  pacotesComprados: number;
  nascimentoInformado: boolean;
  recompensas: { tipo: 'PAGINA' | 'ALBUM'; chave: string; criadaEm: string }[];
  pendencias: { pedidosAmizade: number; trocasRecebidas: number; missoesParaResgatar: number };
}

export interface Missao {
  id: string;
  titulo: string;
  meta: number;
  progresso: number;
  recompensa: number;
  concluida: boolean;
  resgatada: boolean;
}

export interface MissoesDoDia {
  dia: string;
  renovaEm: string;
  missoes: Missao[];
}

export interface PartidaLiga {
  rodada: number;
  mandante: string;
  visitante: string;
  data: string;
  golsMandante: number | null;
  golsVisitante: number | null;
  gols: { sigla: string; codigo: string; minuto: number; nome: string }[];
}

export interface PainelLiga {
  temporada: number;
  totalRodadas: number;
  ultimaRodada: number;
  proximaRodada: { numero: number; data: string } | null;
  classificacao: {
    sigla: string;
    pontos: number;
    jogos: number;
    vitorias: number;
    empates: number;
    derrotas: number;
    golsPro: number;
    golsContra: number;
    saldo: number;
  }[];
  jogosDaUltima: PartidaLiga[];
  jogosDaProxima: PartidaLiga[];
  artilharia: { codigo: string; nome: string; clube: string; gols: number }[];
  emAlta: { codigo: string; gols: number; nome: string; rodada: number } | null;
}

export type OrigemPacote = 'diario' | 'bonus' | 'comprado' | 'moedas';

export interface Oferta {
  id: string;
  nome: string;
  pacotes: number;
  moedasBonus: number;
  precoReferenciaCentavos: number;
  destaque: string | null;
}

export interface Loja {
  moeda: string;
  ofertas: Oferta[];
  pacoteComMoedas: { preco: number };
  moedas: number;
  compras: {
    podeComprar: boolean;
    motivo: 'INFORME_NASCIMENTO' | 'IDADE_MINIMA' | 'LIMITE_MENSAL' | null;
    idade: number | null;
    gastoMesCentavos: number;
    limiteMesCentavos: number | null;
  };
  modoTeste: boolean;
}

export interface UsuarioResumo {
  id: string;
  apelido: string;
}

export interface ListaAmigos {
  amigos: { id: string; usuario: UsuarioResumo; desde: string }[];
  recebidos: { id: string; usuario: UsuarioResumo; criadaEm: string }[];
  enviados: { id: string; usuario: UsuarioResumo; criadaEm: string }[];
}

export interface ItemTroca {
  codigo: string;
  quantidade: number;
}

export type StatusTroca = 'PENDENTE' | 'ACEITA' | 'RECUSADA' | 'CANCELADA' | 'EXPIRADA' | 'FALHOU';

export interface Troca {
  id: string;
  propostaPor: UsuarioResumo;
  para: UsuarioResumo;
  oferta: ItemTroca[];
  pedido: ItemTroca[];
  status: StatusTroca;
  motivo: string | null;
  respostaAId: string | null;
  criadaEm: string;
  expiraEm: string;
}

export interface ListaTrocas {
  recebidas: Troca[];
  enviadas: Troca[];
  historico: Troca[];
}

export interface Sugestao {
  amigo: UsuarioResumo;
  euRecebo: string[];
  euDou: string[];
}

export interface RecompensaNova {
  tipo: 'PAGINA' | 'ALBUM';
  chave: string;
  pacotes: number;
}

export interface ResultadoPacote {
  figurinhas: FigurinhaSorteada[];
  recompensas: RecompensaNova[];
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
  liga: () => chamar<PainelLiga>('GET', '/liga'),
  cadastrar: (apelido: string, email: string, senha: string) =>
    chamar<Sessao>('POST', '/auth/cadastro', null, { apelido, email, senha }),
  entrar: (email: string, senha: string) => chamar<Sessao>('POST', '/auth/entrar', null, { email, senha }),
  sair: (token: string) => chamar<void>('POST', '/auth/sair', token),
  excluirConta: (token: string, senha: string) =>
    chamar<{ resultado: 'APAGADA' | 'ANONIMIZADA' }>('POST', '/auth/excluir-conta', token, { senha }),
  perfil: (token: string) => chamar<Perfil>('GET', '/eu', token),
  album: (token: string) => chamar<Album>('GET', '/album', token),
  abrirPacote: (token: string, origem: OrigemPacote) => chamar<ResultadoPacote>('POST', `/pacotes/${origem}`, token),
  loja: (token: string) => chamar<Loja>('GET', '/loja', token),
  missoes: (token: string) => chamar<MissoesDoDia>('GET', '/missoes', token),
  resgatarMissao: (token: string, id: string) =>
    chamar<{ moedas: number; ganhou: number; missao: Missao }>('POST', `/missoes/${id}/resgatar`, token),
  informarNascimento: (token: string, dataNascimento: string) =>
    chamar<Loja>('POST', '/loja/nascimento', token, { dataNascimento }),
  compraTeste: (token: string, produtoId: string) =>
    chamar<{ compra: { pacotes: number; moedas: number } }>('POST', '/loja/compra-teste', token, { produtoId }),
  amigos: (token: string) => chamar<ListaAmigos>('GET', '/amigos', token),
  pedirAmizade: (token: string, apelido: string) =>
    chamar<{ status: 'PENDENTE' | 'ACEITA'; usuario: UsuarioResumo }>('POST', '/amigos', token, { apelido }),
  aceitarAmizade: (token: string, id: string) => chamar<void>('POST', `/amigos/${id}/aceitar`, token),
  removerAmizade: (token: string, id: string) => chamar<void>('DELETE', `/amigos/${id}`, token),
  trocas: (token: string) => chamar<ListaTrocas>('GET', '/trocas', token),
  sugestoes: (token: string) => chamar<Sugestao[]>('GET', '/trocas/sugestoes', token),
  proporTroca: (token: string, paraId: string, oferta: ItemTroca[], pedido: ItemTroca[], respostaA?: string) =>
    chamar<Troca>('POST', '/trocas', token, { paraId, oferta, pedido, respostaA }),
  aceitarTroca: (token: string, id: string) =>
    chamar<{ novas: string[]; recompensas: RecompensaNova[] }>('POST', `/trocas/${id}/aceitar`, token),
  recusarTroca: (token: string, id: string) => chamar<Troca>('POST', `/trocas/${id}/recusar`, token),
  cancelarTroca: (token: string, id: string) => chamar<Troca>('POST', `/trocas/${id}/cancelar`, token),
  balcao: (token: string, codigo: string) =>
    chamar<{ recebida: string; consumidas: Record<string, number>; recompensas: RecompensaNova[] }>('POST', '/balcao', token, {
      codigo,
    }),
};
