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
  /** Escudo recortado no servidor (ex.: /artes/escudo-TUB.1a2b3c4d.webp); null = desenho do app. */
  escudoImagem?: string | null;
  temporada?: number;
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
  /** Caminho da arte no servidor (ex.: /artes/TUB-04.1a2b3c4d.webp); null = desenho provisório. */
  imagem?: string | null;
  /** Temporada do álbum (1, 2...). */
  temporada: number;
}

export interface TemporadaPerfil {
  numero: number;
  nome: string;
  /** Temporada cujo álbum completo libera esta. */
  requisito: number | null;
  liberada: boolean;
  album: { coladas: number; total: number };
  pacoteDiario: { disponivel: boolean; proximoEm: string | null };
}

export interface Perfil {
  id: string;
  apelido: string;
  email: string;
  moedas: number;
  pacoteDiario: { disponivel: boolean; proximoEm: string | null };
  /** Temporadas publicadas, com liberação, álbum e pacote grátis de cada uma. */
  temporadas: TemporadaPerfil[];
  garantia: { pacotesParaEpica: number; pacotesParaLendaria: number };
  album: { coladas: number; total: number };
  pacotesBonus: number;
  pacotesComprados: number;
  nascimentoInformado: boolean;
  recompensas: { tipo: 'PAGINA' | 'ALBUM'; chave: string; criadaEm: string }[];
  pendencias: { pedidosAmizade: number; trocasRecebidas: number; missoesParaResgatar: number; bafo: number };
}

export interface PartidaBafo {
  id: string;
  status: 'CONVITE' | 'JOGANDO' | 'FINALIZADA' | 'RECUSADA' | 'CANCELADA' | 'EXPIRADA';
  contraComputador: boolean;
  quantidade: number;
  euDesafiei: boolean;
  adversario: { id: string | null; apelido: string };
  cartasDesafiante: string[];
  monte: { minha: boolean; virou: 'EU' | 'ADVERSARIO' | null; codigo: string | null }[];
  batidas: { minha: boolean; precisao: number; viradas: number[]; especial?: boolean; apelido?: string }[];
  minhaVez: boolean;
  placar: { eu: number; adversario: number };
  recebi: string[] | null;
  expiraEm: string;
  /** Só na resposta de uma batida que terminou a partida. */
  novas?: string[];
  recompensas?: RecompensaNova[];
}

export interface RodaBafo {
  id: string;
  status: PartidaBafo['status'];
  quantidade: number;
  temporada: number;
  souAnfitriao: boolean;
  anfitriao: { id: string; apelido: string };
  jogadores: { id: string; apelido: string; status: 'CONVIDADO' | 'DENTRO' | 'RECUSOU'; lado: string | null; minha: boolean; placar: number }[];
  cartasAnfitriao: string[];
  monte: { minha: boolean; dono: string | null; virouPor: string | null; codigo: string | null }[];
  batidas: { jogadorId: string | null; apelido: string; minha: boolean; precisao: number; viradas: number[]; especial: boolean }[];
  vez: { id: string; apelido: string } | null;
  minhaVez: boolean;
  recebi: string[] | null;
  expiraEm: string;
  novas?: string[];
  recompensas?: RecompensaNova[];
}

export interface ListaRodas {
  convites: RodaBafo[];
  esperando: RodaBafo[];
  emAndamento: RodaBafo[];
  recentes: RodaBafo[];
}

export interface ListaBafo {
  limiteDia: number;
  jogadasHoje: number;
  /** Limite diário contra o computador (entre amigos não há limite). */
  limiteComputador?: number;
  jogadasComputadorHoje?: number;
  convitesRecebidos: PartidaBafo[];
  convitesEnviados: PartidaBafo[];
  emAndamento: PartidaBafo[];
  recentes: PartidaBafo[];
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
  /** Falso enquanto a liga da temporada não foi marcada. */
  marcada?: boolean;
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

export interface LinhaRanking {
  posicao: number;
  apelido: string;
  coladas: number;
  lendarias: number;
  campeao: boolean;
  souEu: boolean;
}

export interface Ranking {
  escopo: 'geral' | 'amigos';
  participantes: number;
  lista: LinhaRanking[];
  eu: LinhaRanking | null;
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

export interface CupomMeu {
  codigo: string;
  pacotes: number;
  descricao: string | null;
  validoAte: string | null;
}

export interface CupomResgatado {
  codigo: string;
  pacotes: number;
  descricao: string | null;
  pacotesBonus: number;
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
  temporada?: number;
  pacotes: number;
}

/** Nome para mostrar de uma recompensa ("T2:Tubarões do Cais" vira "Tubarões do Cais"). */
export const nomeRecompensa = (chave: string) => chave.replace(/^T\d+:/, '');

export interface ResultadoPacote {
  figurinhas: FigurinhaSorteada[];
  recompensas: RecompensaNova[];
}

export interface ItemAlbum {
  codigo: string;
  quantidade: number;
  brilhantes: number;
  temporada?: number;
}

export interface Album {
  itens: ItemAlbum[];
  repetidas: Record<Raridade, number>;
  balcao: { repetidasPorNova: number };
  repetidasPorTemporada?: Record<string, Record<Raridade, number>>;
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
  liga: (temporada = 1) => chamar<PainelLiga>('GET', `/liga?temporada=${temporada}`),
  ranking: (token: string, escopo: 'geral' | 'amigos') => chamar<Ranking>('GET', `/ranking?escopo=${escopo}`, token),
  cadastrar: (apelido: string, email: string, senha: string) =>
    chamar<Sessao>('POST', '/auth/cadastro', null, { apelido, email, senha }),
  entrar: (email: string, senha: string) => chamar<Sessao>('POST', '/auth/entrar', null, { email, senha }),
  sair: (token: string) => chamar<void>('POST', '/auth/sair', token),
  excluirConta: (token: string, senha: string) =>
    chamar<{ resultado: 'APAGADA' | 'ANONIMIZADA' }>('POST', '/auth/excluir-conta', token, { senha }),
  perfil: (token: string) => chamar<Perfil>('GET', '/eu', token),
  album: (token: string) => chamar<Album>('GET', '/album', token),
  abrirPacote: (token: string, origem: OrigemPacote, temporada = 1) =>
    chamar<ResultadoPacote>('POST', `/pacotes/${origem}`, token, { temporada }),
  loja: (token: string) => chamar<Loja>('GET', '/loja', token),
  missoes: (token: string) => chamar<MissoesDoDia>('GET', '/missoes', token),
  resgatarMissao: (token: string, id: string) =>
    chamar<{ moedas: number; ganhou: number; missao: Missao }>('POST', `/missoes/${id}/resgatar`, token),
  informarNascimento: (token: string, dataNascimento: string) =>
    chamar<Loja>('POST', '/loja/nascimento', token, { dataNascimento }),
  compraTeste: (token: string, produtoId: string) =>
    chamar<{ compra: { pacotes: number; moedas: number } }>('POST', '/loja/compra-teste', token, { produtoId }),
  cupons: (token: string) => chamar<CupomMeu[]>('GET', '/cupons', token),
  resgatarCupom: (token: string, codigo: string) => chamar<CupomResgatado>('POST', '/cupons/resgatar', token, { codigo }),
  amigos: (token: string) => chamar<ListaAmigos>('GET', '/amigos', token),
  bafo: (token: string) => chamar<ListaBafo>('GET', '/bafo', token),
  partidaBafo: (token: string, id: string) => chamar<PartidaBafo>('GET', `/bafo/${id}`, token),
  bafoComputador: (token: string, figurinhas: string[]) => chamar<PartidaBafo>('POST', '/bafo/computador', token, { figurinhas }),
  desafiarBafo: (token: string, adversarioId: string, figurinhas: string[]) =>
    chamar<PartidaBafo>('POST', '/bafo/desafios', token, { adversarioId, figurinhas }),
  aceitarBafo: (token: string, id: string, figurinhas: string[]) => chamar<PartidaBafo>('POST', `/bafo/${id}/aceitar`, token, { figurinhas }),
  recusarBafo: (token: string, id: string) => chamar<PartidaBafo>('POST', `/bafo/${id}/recusar`, token),
  cancelarBafo: (token: string, id: string) => chamar<PartidaBafo>('POST', `/bafo/${id}/cancelar`, token),
  baterBafo: (token: string, id: string, precisao: number) => chamar<PartidaBafo>('POST', `/bafo/${id}/bater`, token, { precisao }),
  rodas: (token: string) => chamar<ListaRodas>('GET', '/bafo/rodas', token),
  roda: (token: string, id: string) => chamar<RodaBafo>('GET', `/bafo/rodas/${id}`, token),
  criarRoda: (token: string, convidados: string[], figurinhas: string[]) =>
    chamar<RodaBafo>('POST', '/bafo/rodas', token, { convidados, figurinhas }),
  entrarRoda: (token: string, id: string, figurinhas: string[]) => chamar<RodaBafo>('POST', `/bafo/rodas/${id}/entrar`, token, { figurinhas }),
  recusarRoda: (token: string, id: string) => chamar<RodaBafo>('POST', `/bafo/rodas/${id}/recusar`, token),
  comecarRoda: (token: string, id: string) => chamar<RodaBafo>('POST', `/bafo/rodas/${id}/comecar`, token),
  cancelarRoda: (token: string, id: string) => chamar<RodaBafo>('POST', `/bafo/rodas/${id}/cancelar`, token),
  baterRoda: (token: string, id: string, precisao: number) => chamar<RodaBafo>('POST', `/bafo/rodas/${id}/bater`, token, { precisao }),
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
