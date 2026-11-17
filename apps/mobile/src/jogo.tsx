import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Album, api, Clube, ErroApi, Figurinha, FigurinhaSorteada, Perfil, Sessao } from './api';
import { apagarSessao, lerSessao, salvarSessao } from './armazenamento';

interface Jogo {
  carregando: boolean;
  erroInicial: string | null;
  sessao: Sessao | null;
  clubes: Record<string, Clube>;
  figurinhas: Figurinha[];
  porCodigo: Record<string, Figurinha>;
  perfil: Perfil | null;
  album: Album | null;
  entrar(email: string, senha: string): Promise<void>;
  cadastrar(apelido: string, email: string, senha: string): Promise<void>;
  sair(): Promise<void>;
  recarregar(): Promise<void>;
  abrirPacoteDiario(): Promise<FigurinhaSorteada[]>;
  trocarNoBalcao(codigo: string): Promise<void>;
  tentarDeNovo(): void;
}

const Contexto = createContext<Jogo | null>(null);

export function useJogo(): Jogo {
  const j = useContext(Contexto);
  if (!j) throw new Error('useJogo fora do JogoProvider');
  return j;
}

export function JogoProvider({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true);
  const [erroInicial, setErroInicial] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [clubes, setClubes] = useState<Record<string, Clube>>({});
  const [figurinhas, setFigurinhas] = useState<Figurinha[]>([]);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [album, setAlbum] = useState<Album | null>(null);

  const limparSessao = useCallback(async () => {
    await apagarSessao();
    setSessao(null);
    setPerfil(null);
    setAlbum(null);
  }, []);

  const carregarJogador = useCallback(
    async (s: Sessao) => {
      try {
        const [p, a] = await Promise.all([api.perfil(s.token), api.album(s.token)]);
        setPerfil(p);
        setAlbum(a);
      } catch (e) {
        // Sessão expirada ou revogada: volta para a tela de entrar.
        if (e instanceof ErroApi && e.status === 401) await limparSessao();
        else throw e;
      }
    },
    [limparSessao],
  );

  // Carga inicial: catálogo público + sessão guardada no aparelho.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      setCarregando(true);
      setErroInicial(null);
      try {
        const [c, f, s] = await Promise.all([api.clubes(), api.figurinhas(), lerSessao()]);
        if (cancelado) return;
        setClubes(Object.fromEntries(c.map((x) => [x.sigla, x])));
        setFigurinhas(f);
        if (s) {
          setSessao(s);
          await carregarJogador(s);
        }
      } catch (e) {
        if (!cancelado) setErroInicial(e instanceof Error ? e.message : 'Erro desconhecido.');
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [carregarJogador, tentativa]);

  const iniciarSessao = useCallback(
    async (s: Sessao) => {
      await salvarSessao(s);
      setSessao(s);
      await carregarJogador(s);
    },
    [carregarJogador],
  );

  const valor = useMemo<Jogo>(
    () => ({
      carregando,
      erroInicial,
      sessao,
      clubes,
      figurinhas,
      porCodigo: Object.fromEntries(figurinhas.map((f) => [f.codigo, f])),
      perfil,
      album,
      entrar: async (email, senha) => iniciarSessao(await api.entrar(email, senha)),
      cadastrar: async (apelido, email, senha) => iniciarSessao(await api.cadastrar(apelido, email, senha)),
      sair: async () => {
        if (sessao) await api.sair(sessao.token).catch(() => undefined);
        await limparSessao();
      },
      recarregar: async () => {
        if (sessao) await carregarJogador(sessao);
      },
      abrirPacoteDiario: async () => {
        if (!sessao) throw new Error('Sem sessão.');
        const r = await api.abrirPacoteDiario(sessao.token);
        await carregarJogador(sessao);
        return r.figurinhas;
      },
      trocarNoBalcao: async (codigo) => {
        if (!sessao) throw new Error('Sem sessão.');
        await api.balcao(sessao.token, codigo);
        await carregarJogador(sessao);
      },
      tentarDeNovo: () => setTentativa((t) => t + 1),
    }),
    [carregando, erroInicial, sessao, clubes, figurinhas, perfil, album, iniciarSessao, limparSessao, carregarJogador],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
