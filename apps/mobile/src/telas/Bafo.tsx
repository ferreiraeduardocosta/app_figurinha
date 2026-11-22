import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { api, ErroApi, ListaAmigos, ListaBafo, PartidaBafo, UsuarioResumo } from '../api';
import { Botao } from '../componentes/Botao';
import { Figurinha } from '../componentes/Figurinha';
import { MiniFigurinhas, SeletorFigurinhas } from '../componentes/MiniFigurinhas';
import { useJogo } from '../jogo';
import { cores } from '../tema';

const nativo = Platform.OS !== 'web';
const MAX_CARTAS = 3;

type Escolha = { modo: 'computador' } | { modo: 'desafio'; amigo: UsuarioResumo } | { modo: 'aceitar'; partida: PartidaBafo };
type Tela = { tipo: 'lobby' } | { tipo: 'escolher'; escolha: Escolha } | { tipo: 'mesa'; partida: PartidaBafo };

const mensagemDeErro = (e: unknown) => (e instanceof ErroApi || e instanceof Error ? e.message : 'Algo deu errado.');

/** Bafo: lobby (partidas e desafios), escolha das repetidas e a mesa do jogo. */
export function Bafo({ aoVoltar }: { aoVoltar: () => void }) {
  const [tela, setTela] = useState<Tela>({ tipo: 'lobby' });
  if (tela.tipo === 'escolher') {
    return (
      <EscolherCartas
        escolha={tela.escolha}
        aoVoltar={() => setTela({ tipo: 'lobby' })}
        aoComecar={(p) => setTela(p.status === 'JOGANDO' ? { tipo: 'mesa', partida: p } : { tipo: 'lobby' })}
      />
    );
  }
  if (tela.tipo === 'mesa') {
    return (
      <Mesa
        key={tela.partida.id}
        inicial={tela.partida}
        aoVoltar={() => setTela({ tipo: 'lobby' })}
        aoJogarDeNovo={() => setTela({ tipo: 'escolher', escolha: { modo: 'computador' } })}
      />
    );
  }
  return (
    <Lobby
      aoVoltar={aoVoltar}
      aoEscolher={(escolha) => setTela({ tipo: 'escolher', escolha })}
      aoAbrir={(partida) => setTela({ tipo: 'mesa', partida })}
    />
  );
}

// ---------------------------------------------------------------------------

function Lobby({
  aoVoltar,
  aoEscolher,
  aoAbrir,
}: {
  aoVoltar: () => void;
  aoEscolher: (e: Escolha) => void;
  aoAbrir: (p: PartidaBafo) => void;
}) {
  const { sessao, album, recarregar } = useJogo();
  const [lista, setLista] = useState<ListaBafo | null>(null);
  const [amigos, setAmigos] = useState<ListaAmigos | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const token = sessao?.token ?? '';

  const carregar = useCallback(async () => {
    try {
      const [l, a] = await Promise.all([api.bafo(token), api.amigos(token)]);
      setLista(l);
      setAmigos(a);
      setErro(null);
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }, [token]);
  useEffect(() => {
    carregar();
    const id = setInterval(carregar, 10_000);
    return () => clearInterval(id);
  }, [carregar]);

  const repetidas = (album?.itens ?? []).filter((i) => i.quantidade > 1).length;
  // Só contra o computador há limite diário; entre amigos é livre.
  const limite = lista?.limiteComputador ?? lista?.limiteDia ?? 0;
  const jogadas = lista?.jogadasComputadorHoje ?? lista?.jogadasHoje ?? 0;
  const esgotou = !!lista && jogadas >= limite;

  const acao = async (id: string, fn: () => Promise<unknown>) => {
    setOcupado(id);
    try {
      await fn();
      await Promise.all([carregar(), recarregar()]);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <Barra titulo="Bafo" aoVoltar={aoVoltar} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View style={estilos.capa}>
          <Text style={estilos.capaEmoji} accessibilityElementsHidden importantForAccessibility="no">
            🖐️
          </Text>
          <Text style={estilos.capaTitulo}>Bafo da várzea</Text>
          <Text style={estilos.capaTexto}>
            Cada um põe de 1 a 3 repetidas no monte. Segure o botão, solte no verde e bata: as que virarem são suas!
          </Text>
          {lista && (
            <Text style={estilos.capaContador}>
              {jogadas}/{limite} contra o computador hoje · entre amigos é livre
            </Text>
          )}
        </View>

        {!lista ? (
          <ActivityIndicator color={cores.destaque} />
        ) : (
          <>
            {lista.convitesRecebidos.length > 0 && (
              <Secao titulo="Desafios para você">
                {lista.convitesRecebidos.map((p) => (
                  <View key={p.id} style={estilos.item}>
                    <Text style={estilos.itemTitulo}>
                      {p.adversario.apelido} desafiou você · {p.quantidade} figurinha{p.quantidade > 1 ? 's' : ''} de cada lado
                    </Text>
                    <Text style={estilos.legenda}>No monte dele:</Text>
                    <MiniFigurinhas itens={agrupar(p.cartasDesafiante)} />
                    <View style={estilos.linhaBotoes}>
                      <View style={{ flex: 1 }}>
                        <Botao titulo="Aceitar" onPress={() => aoEscolher({ modo: 'aceitar', partida: p })} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Botao
                          titulo="Recusar"
                          variante="secundario"
                          carregando={ocupado === p.id}
                          onPress={() => acao(p.id, () => api.recusarBafo(token, p.id))}
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </Secao>
            )}

            {lista.emAndamento.length > 0 && (
              <Secao titulo="Em andamento">
                {lista.emAndamento.map((p) => (
                  <Pressable key={p.id} style={estilos.item} onPress={() => aoAbrir(p)} accessibilityRole="button">
                    <Text style={estilos.itemTitulo}>
                      Contra {p.adversario.apelido} · {p.placar.eu} × {p.placar.adversario}
                    </Text>
                    <Text style={[estilos.legenda, p.minhaVez && { color: cores.destaque, fontWeight: '800' }]}>
                      {p.minhaVez ? 'Sua vez de bater! Toque para jogar.' : `Vez de ${p.adversario.apelido}.`}
                    </Text>
                  </Pressable>
                ))}
              </Secao>
            )}

            <Secao titulo="Jogar">
              {repetidas === 0 && <Text style={estilos.legenda}>Você precisa de figurinhas repetidas para jogar bafo.</Text>}
              <Botao
                titulo="Contra o computador"
                onPress={() => aoEscolher({ modo: 'computador' })}
                desabilitado={repetidas === 0 || esgotou}
              />
              {esgotou && (
                <Text style={estilos.legenda}>
                  Você já jogou {limite} partidas contra o computador hoje. Volte amanhã, ou desafie um amigo!
                </Text>
              )}
              <Text style={[estilos.legenda, { marginTop: 6 }]}>Ou desafie um amigo:</Text>
              {(amigos?.amigos ?? []).length === 0 && (
                <Text style={estilos.legenda}>Adicione amigos na aba Trocas para desafiar.</Text>
              )}
              {(amigos?.amigos ?? []).map((a) => (
                <View key={a.id} style={estilos.amigo}>
                  <Text style={estilos.amigoNome}>{a.usuario.apelido}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Desafiar ${a.usuario.apelido}`}
                    disabled={repetidas === 0}
                    onPress={() => aoEscolher({ modo: 'desafio', amigo: a.usuario })}
                    style={[estilos.desafiar, repetidas === 0 && { opacity: 0.4 }]}
                  >
                    <Text style={estilos.desafiarTexto}>Desafiar</Text>
                  </Pressable>
                </View>
              ))}
            </Secao>

            {lista.convitesEnviados.length > 0 && (
              <Secao titulo="Esperando resposta">
                {lista.convitesEnviados.map((p) => (
                  <View key={p.id} style={[estilos.item, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                    <Text style={[estilos.itemTitulo, { flex: 1 }]}>
                      {p.adversario.apelido} · {p.quantidade} figurinha{p.quantidade > 1 ? 's' : ''}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => acao(p.id, () => api.cancelarBafo(token, p.id))}
                      style={estilos.desafiar}
                    >
                      <Text style={estilos.desafiarTexto}>{ocupado === p.id ? '...' : 'Cancelar'}</Text>
                    </Pressable>
                  </View>
                ))}
              </Secao>
            )}

            {lista.recentes.length > 0 && (
              <Secao titulo="Últimas partidas">
                {lista.recentes.map((p) => (
                  <Pressable
                    key={p.id}
                    style={estilos.item}
                    onPress={() => p.monte.length > 0 && aoAbrir(p)}
                    accessibilityRole={p.monte.length > 0 ? 'button' : undefined}
                  >
                    <Text style={estilos.itemTitulo}>
                      Contra {p.adversario.apelido} · {resumoStatus(p)}
                    </Text>
                    {p.recebi && (
                      <Text style={estilos.legenda}>
                        Ficou com {p.recebi.length} de {p.monte.length} ({saldo(p) >= 0 ? '+' : ''}
                        {saldo(p)})
                      </Text>
                    )}
                  </Pressable>
                ))}
              </Secao>
            )}
          </>
        )}
        {erro && (
          <Text style={estilos.erro} accessibilityRole="alert">
            {erro}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

function resumoStatus(p: PartidaBafo) {
  if (p.status === 'RECUSADA') return 'desafio recusado';
  if (p.status === 'CANCELADA') return 'cancelada';
  if (p.status === 'EXPIRADA' && !p.recebi) return 'desafio expirou';
  const s = saldo(p);
  const fim = s > 0 ? 'você ganhou' : s < 0 ? 'você perdeu' : 'empate';
  return p.status === 'EXPIRADA' ? `tempo esgotado, ${fim}` : fim;
}

const saldo = (p: PartidaBafo) => (p.recebi ? p.recebi.length - p.quantidade : 0);

function agrupar(codigos: string[]) {
  const m = new Map<string, number>();
  for (const c of codigos) m.set(c, (m.get(c) ?? 0) + 1);
  return [...m].map(([codigo, quantidade]) => ({ codigo, quantidade }));
}

// ---------------------------------------------------------------------------

function EscolherCartas({ escolha, aoVoltar, aoComecar }: { escolha: Escolha; aoVoltar: () => void; aoComecar: (p: PartidaBafo) => void }) {
  const { sessao, album, recarregar, porCodigo, temporada: escolhida, perfil } = useJogo();
  // O monte é de uma temporada só: a das cartas do desafio, ou a escolhida no seletor.
  const temporada =
    escolha.modo === 'aceitar' ? (porCodigo[escolha.partida.cartasDesafiante[0]]?.temporada ?? 1) : escolhida;
  const variasTemporadas = (perfil?.temporadas?.length ?? 1) > 1;
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const exato = escolha.modo === 'aceitar' ? escolha.partida.quantidade : null;
  const maximo = exato ?? MAX_CARTAS;

  const repetidas = useMemo(
    () =>
      (album?.itens ?? [])
        .filter((i) => i.quantidade > 1 && (porCodigo[i.codigo]?.temporada ?? 1) === temporada)
        .map((i) => i.codigo)
        .sort(),
    [album, porCodigo, temporada],
  );

  const alternar = (codigo: string) => {
    const novo = new Set(marcadas);
    if (novo.has(codigo)) novo.delete(codigo);
    else if (novo.size < maximo) novo.add(codigo);
    setMarcadas(novo);
  };

  const pronto = exato ? marcadas.size === exato : marcadas.size >= 1;
  const titulo = escolha.modo === 'computador' ? 'Contra o computador' : escolha.modo === 'desafio' ? `Desafiar ${escolha.amigo.apelido}` : `Aceitar desafio de ${escolha.partida.adversario.apelido}`;

  const confirmar = async () => {
    if (!sessao) return;
    setErro(null);
    setEnviando(true);
    try {
      const cartas = [...marcadas];
      const p =
        escolha.modo === 'computador'
          ? await api.bafoComputador(sessao.token, cartas)
          : escolha.modo === 'desafio'
            ? await api.desafiarBafo(sessao.token, escolha.amigo.id, cartas)
            : await api.aceitarBafo(sessao.token, escolha.partida.id, cartas);
      await recarregar();
      aoComecar(p);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <Barra titulo="Montar o monte" aoVoltar={aoVoltar} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={estilos.subtitulo}>{titulo}</Text>
        <Text style={estilos.legenda}>
          {exato
            ? `Escolha ${exato} repetida${exato > 1 ? 's' : ''} sua${exato > 1 ? 's' : ''} para pôr no monte.`
            : `Escolha de 1 a ${MAX_CARTAS} repetidas. ${escolha.modo === 'computador' ? 'O computador põe figurinhas da mesma raridade.' : 'Seu amigo põe a mesma quantidade.'}`}{' '}
          As que o adversário virar ficam com ele.
        </Text>
        {escolha.modo === 'aceitar' && (
          <View style={estilos.item}>
            <Text style={estilos.legenda}>No monte de {escolha.partida.adversario.apelido}:</Text>
            <MiniFigurinhas itens={agrupar(escolha.partida.cartasDesafiante)} />
          </View>
        )}
        <Text style={estilos.rotulo}>
          Suas repetidas{variasTemporadas ? ` da Temporada ${temporada}` : ''} ({marcadas.size}/{maximo})
        </Text>
        <SeletorFigurinhas codigos={repetidas} marcados={marcadas} aoAlternar={alternar} />
        {erro && (
          <Text style={estilos.erro} accessibilityRole="alert">
            {erro}
          </Text>
        )}
      </ScrollView>
      <View style={estilos.rodape}>
        <Botao
          titulo={escolha.modo === 'desafio' ? 'Enviar desafio' : 'Ir para o monte'}
          onPress={confirmar}
          carregando={enviando}
          desabilitado={!pronto}
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

/** Posição de cada carta no monte (fração da mesa) e inclinação, para parecer jogadas no chão. */
const POSICOES = [
  { x: 0.5, y: 0.48, r: -6 },
  { x: 0.36, y: 0.42, r: 14 },
  { x: 0.63, y: 0.4, r: -18 },
  { x: 0.42, y: 0.58, r: 24 },
  { x: 0.6, y: 0.6, r: 8 },
  { x: 0.5, y: 0.34, r: -26 },
];
const LARGURA_CARTA = 74;
const ALTURA_CARTA = (LARGURA_CARTA * 392) / 280;

function Mesa({ inicial, aoVoltar, aoJogarDeNovo }: { inicial: PartidaBafo; aoVoltar: () => void; aoJogarDeNovo: () => void }) {
  const { sessao, porCodigo, clubes, recarregar } = useJogo();
  const token = sessao?.token ?? '';
  const [partida, setPartida] = useState(inicial);
  /** Quantas batidas já foram mostradas (as seguintes são animadas uma a uma). */
  const [mostradas, setMostradas] = useState(inicial.batidas.length);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [batendo, setBatendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [larguraMesa, setLarguraMesa] = useState(320);
  const novasRef = useRef<string[]>([]);

  const marcador = useRef(new Animated.Value(0)).current;
  const valorMarcador = useRef(0);
  const animMarcador = useRef<Animated.CompositeAnimation | null>(null);
  const mao = useRef(new Animated.Value(0)).current;
  const tremor = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const [maoDeQuem, setMaoDeQuem] = useState<'EU' | 'ADVERSARIO'>('EU');

  useEffect(() => {
    const id = marcador.addListener(({ value }) => (valorMarcador.current = value));
    return () => marcador.removeListener(id);
  }, [marcador]);

  // Cartas viradas até a batida `mostradas`.
  const viradasVisiveis = useMemo(() => {
    const s = new Set<number>();
    partida.batidas.slice(0, mostradas).forEach((b) => b.viradas.forEach((i) => s.add(i)));
    return s;
  }, [partida, mostradas]);
  const ultimas = useMemo(() => new Set(partida.batidas[mostradas - 1]?.viradas ?? []), [partida, mostradas]);
  const placar = useMemo(() => {
    let eu = 0;
    let adv = 0;
    partida.monte.forEach((c, i) => {
      if (!viradasVisiveis.has(i)) return;
      if (c.virou === 'EU') eu++;
      else adv++;
    });
    return { eu, adv };
  }, [partida, viradasVisiveis]);

  const animarBatida = (quem: 'EU' | 'ADVERSARIO') =>
    new Promise<void>((fim) => {
      setMaoDeQuem(quem);
      mao.setValue(0);
      Animated.sequence([
        Animated.timing(mao, { toValue: 1, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: nativo }),
        Animated.parallel([
          Animated.sequence([
            Animated.timing(tremor, { toValue: 1, duration: 60, useNativeDriver: nativo }),
            Animated.timing(tremor, { toValue: -1, duration: 60, useNativeDriver: nativo }),
            Animated.timing(tremor, { toValue: 0, duration: 60, useNativeDriver: nativo }),
          ]),
          Animated.timing(mao, { toValue: 2, duration: 320, delay: 120, useNativeDriver: nativo }),
        ]),
      ]).start(() => fim());
    });

  const revelar = (n: number) =>
    new Promise<void>((fim) => {
      pop.setValue(0.4);
      setMostradas(n);
      Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: nativo }).start(() => fim());
    });

  /** Mostra, uma a uma, as batidas que chegaram do servidor. */
  const mostrarNovas = useCallback(
    async (p: PartidaBafo, desde: number, pularMinhaMao: boolean) => {
      for (let i = desde; i < p.batidas.length; i++) {
        const b = p.batidas[i];
        if (!(b.minha && pularMinhaMao && i === desde)) await animarBatida(b.minha ? 'EU' : 'ADVERSARIO');
        await revelar(i + 1);
        const n = b.viradas.length;
        const quem = b.minha ? 'Você' : p.adversario.apelido;
        setMensagem(
          n === 0
            ? `${quem} bateu e não virou nenhuma${b.minha ? '. Tente soltar mais perto do centro!' : '.'}`
            : `${quem} virou ${n} figurinha${n > 1 ? 's' : ''}!${b.minha && b.precisao >= 0.95 ? ' BAFO PERFEITO!' : ''}`,
        );
        if (i < p.batidas.length - 1) await esperar(1100);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Contra amigos: confere a cada 4 s se o outro já bateu.
  useEffect(() => {
    if (partida.contraComputador || partida.status !== 'JOGANDO' || partida.minhaVez || batendo) return;
    const id = setInterval(async () => {
      try {
        const p = await api.partidaBafo(token, partida.id);
        if (p.batidas.length > partida.batidas.length || p.status !== partida.status) {
          const desde = mostradas;
          setPartida(p);
          await mostrarNovas(p, desde, false);
          if (p.status !== 'JOGANDO') recarregar();
        }
      } catch {
        // tenta de novo no próximo ciclo
      }
    }, 4000);
    return () => clearInterval(id);
  }, [partida, token, batendo, mostradas, mostrarNovas, recarregar]);

  const segurar = () => {
    if (!partida.minhaVez || batendo) return;
    marcador.setValue(0);
    animMarcador.current = Animated.loop(
      Animated.sequence([
        Animated.timing(marcador, { toValue: 1, duration: 650, easing: Easing.linear, useNativeDriver: false }),
        Animated.timing(marcador, { toValue: 0, duration: 650, easing: Easing.linear, useNativeDriver: false }),
      ]),
    );
    animMarcador.current.start();
  };

  const soltar = async () => {
    if (!animMarcador.current || batendo) return;
    animMarcador.current.stop();
    animMarcador.current = null;
    const precisao = Math.max(0, 1 - Math.abs(valorMarcador.current - 0.5) / 0.5);
    setBatendo(true);
    setErro(null);
    setMensagem(null);
    try {
      const [p] = await Promise.all([api.baterBafo(token, partida.id, precisao), animarBatida('EU')]);
      const desde = partida.batidas.length;
      novasRef.current = p.novas ?? [];
      setPartida(p);
      await mostrarNovas(p, desde, true);
      if (p.status !== 'JOGANDO') await recarregar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setBatendo(false);
    }
  };

  const terminou = partida.status !== 'JOGANDO' && mostradas >= partida.batidas.length;
  const maoY = mao.interpolate({ inputRange: [0, 1, 2], outputRange: [-160, 0, -160] });
  const maoOpacidade = mao.interpolate({ inputRange: [0, 0.2, 1, 1.8, 2], outputRange: [0, 1, 1, 1, 0] });
  const tremorX = tremor.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] });
  const posicaoMarcador = marcador.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <View style={{ flex: 1, backgroundColor: '#1F5130' }}>
      <Barra titulo={`Bafo · ${partida.adversario.apelido}`} aoVoltar={aoVoltar} escura />
      <View style={estilos.placar} accessibilityLiveRegion="polite">
        <View style={estilos.placarLado}>
          <Text style={estilos.placarNumero}>{placar.eu}</Text>
          <Text style={estilos.placarNome}>Você</Text>
        </View>
        <Text style={estilos.placarX}>×</Text>
        <View style={estilos.placarLado}>
          <Text style={estilos.placarNumero}>{placar.adv}</Text>
          <Text style={estilos.placarNome} numberOfLines={1}>
            {partida.adversario.apelido}
          </Text>
        </View>
      </View>

      <Animated.View
        style={[estilos.mesa, { transform: [{ translateX: tremorX }] }]}
        onLayout={(e) => setLarguraMesa(e.nativeEvent.layout.width)}
        accessible
        accessibilityLabel={`Monte com ${partida.monte.length - viradasVisiveis.size} figurinhas para baixo`}
      >
        {partida.monte.map((c, i) => {
          const pos = POSICOES[i % POSICOES.length];
          const virada = viradasVisiveis.has(i) || terminou;
          const f = c.codigo ? porCodigo[c.codigo] : undefined;
          const recente = ultimas.has(i);
          return (
            <Animated.View
              key={i}
              style={{
                position: 'absolute',
                left: pos.x * larguraMesa - LARGURA_CARTA / 2,
                top: pos.y * 300 - ALTURA_CARTA / 2,
                transform: [{ rotate: `${pos.r}deg` }, { scale: recente ? pop : 1 }],
              }}
            >
              {virada && f ? (
                <View style={[estilos.cartaVirada, { borderColor: c.virou === 'EU' ? '#FDE047' : c.virou ? '#F87171' : '#CBD5E1' }]}>
                  <Figurinha figurinha={f} clube={clubes[f.clubeSigla]} largura={LARGURA_CARTA} />
                </View>
              ) : (
                <Verso minha={c.minha} />
              )}
            </Animated.View>
          );
        })}
        <Animated.Text
          style={[estilos.mao, { opacity: maoOpacidade, transform: [{ translateY: maoY }, { scaleY: maoDeQuem === 'EU' ? 1 : -1 }] }]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          🖐️
        </Animated.Text>
      </Animated.View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={estilos.painel}>
        {terminou ? (
          <Resultado partida={partida} novas={novasRef.current} aoVoltar={aoVoltar} aoJogarDeNovo={aoJogarDeNovo} />
        ) : (
          <>
            <Text style={estilos.mensagem} accessibilityLiveRegion="polite">
              {mensagem ??
                (partida.minhaVez
                  ? 'Segure o botão, solte com a marca no verde!'
                  : `Esperando ${partida.adversario.apelido} bater...`)}
            </Text>
            <View style={estilos.barraForca} accessibilityElementsHidden importantForAccessibility="no">
              <View style={[estilos.faixa, { left: '0%', width: '25%', backgroundColor: '#FCA5A5' }]} />
              <View style={[estilos.faixa, { left: '25%', width: '17%', backgroundColor: '#FDE68A' }]} />
              <View style={[estilos.faixa, { left: '42%', width: '16%', backgroundColor: '#86EFAC' }]} />
              <View style={[estilos.faixa, { left: '47.5%', width: '5%', backgroundColor: '#16A34A' }]} />
              <View style={[estilos.faixa, { left: '58%', width: '17%', backgroundColor: '#FDE68A' }]} />
              <View style={[estilos.faixa, { left: '75%', width: '25%', backgroundColor: '#FCA5A5' }]} />
              <Animated.View
                style={[
                  estilos.marcador,
                  { left: posicaoMarcador.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                ]}
              />
            </View>
            <Pressable
              onPressIn={segurar}
              onPressOut={soltar}
              disabled={!partida.minhaVez || batendo}
              accessibilityRole="button"
              accessibilityLabel="Bater: segure e solte"
              accessibilityState={{ disabled: !partida.minhaVez || batendo }}
              style={({ pressed }) => [estilos.botaoBater, (!partida.minhaVez || batendo) && { opacity: 0.4 }, pressed && { transform: [{ scale: 0.96 }] }]}
            >
              <Text style={estilos.botaoBaterTexto}>{batendo ? '...' : partida.minhaVez ? 'SEGURE E SOLTE' : 'AGUARDE'}</Text>
            </Pressable>
            <Text style={estilos.dica}>
              Batidas: {partida.batidas.filter((b) => b.minha).length}/3 suas
            </Text>
          </>
        )}
        {erro && (
          <Text style={[estilos.erro, { color: '#FECACA' }]} accessibilityRole="alert">
            {erro}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

function Resultado({
  partida,
  novas,
  aoVoltar,
  aoJogarDeNovo,
}: {
  partida: PartidaBafo;
  novas: string[];
  aoVoltar: () => void;
  aoJogarDeNovo: () => void;
}) {
  const s = saldo(partida);
  const titulo = s > 0 ? `Você ganhou ${s} figurinha${s > 1 ? 's' : ''}!` : s < 0 ? `Você perdeu ${-s} figurinha${s < -1 ? 's' : ''}.` : 'Empate: ninguém perdeu nada.';
  return (
    <View style={{ gap: 10 }}>
      <Text style={estilos.resultadoTitulo} accessibilityRole="header">
        {titulo}
      </Text>
      {partida.status === 'EXPIRADA' && <Text style={estilos.dica}>O tempo acabou; o que não virou voltou para o dono.</Text>}
      <Text style={estilos.dica}>
        Ficou com {partida.recebi?.length ?? 0} das {partida.monte.length} figurinhas do monte
        {novas.length ? ` · ${novas.length} nova${novas.length > 1 ? 's' : ''} no álbum!` : ''}
      </Text>
      {partida.recebi && partida.recebi.length > 0 && <MiniFigurinhas itens={agrupar(partida.recebi)} />}
      {partida.recompensas?.map((r) => (
        <Text key={r.chave} style={estilos.dica}>
          Página "{r.chave}" completa: +{r.pacotes} pacote!
        </Text>
      ))}
      <View style={estilos.linhaBotoes}>
        {partida.contraComputador && (
          <View style={{ flex: 1 }}>
            <Botao titulo="Jogar de novo" onPress={aoJogarDeNovo} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Botao titulo="Voltar" variante="secundario" onPress={aoVoltar} />
        </View>
      </View>
    </View>
  );
}

/** Verso da figurinha (virada para baixo). Borda dourada nas minhas, cinza nas do adversário. */
function Verso({ minha }: { minha: boolean }) {
  return (
    <View style={[estilos.verso, { borderColor: minha ? '#FDE047' : '#CBD5E1' }]}>
      <Svg width={LARGURA_CARTA * 0.6} height={LARGURA_CARTA * 0.6} viewBox="0 0 24 24">
        <Path d="M12 2 L14.6 8.6 L21.5 9.2 L16.2 13.8 L17.8 20.6 L12 17 L6.2 20.6 L7.8 13.8 L2.5 9.2 L9.4 8.6 Z" fill="#FDE047" opacity={0.9} />
      </Svg>
      <Text style={estilos.versoTexto}>CRAQUES{'\n'}DA VÁRZEA</Text>
    </View>
  );
}

function Barra({ titulo, aoVoltar, escura = false }: { titulo: string; aoVoltar: () => void; escura?: boolean }) {
  const cor = escura ? '#FFFFFF' : cores.tinta;
  return (
    <View style={estilos.barra}>
      <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={aoVoltar} style={estilos.voltar}>
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Path d="M15 5 L8 12 L15 19" fill="none" stroke={cor} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>
      <Text style={[estilos.titulo, { color: cor }]} numberOfLines={1}>
        {titulo}
      </Text>
    </View>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={estilos.rotulo}>{titulo}</Text>
      {children}
    </View>
  );
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

const estilos = StyleSheet.create({
  barra: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 6 },
  voltar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  titulo: { flex: 1, fontSize: 22, fontWeight: '800', textTransform: 'uppercase' },
  capa: { backgroundColor: '#1F5130', borderRadius: 18, padding: 18, gap: 6 },
  capaEmoji: { fontSize: 40 },
  capaTitulo: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', textTransform: 'uppercase' },
  capaTexto: { fontSize: 15, color: '#D1FAE5', lineHeight: 21 },
  capaContador: { fontSize: 13, fontWeight: '700', color: '#FDE047', marginTop: 4 },
  rotulo: { fontSize: 13, fontWeight: '800', color: cores.apagado, textTransform: 'uppercase', letterSpacing: 1 },
  subtitulo: { fontSize: 20, fontWeight: '800', color: cores.tinta },
  legenda: { fontSize: 14, color: cores.apagado },
  item: { backgroundColor: cores.papel, borderRadius: 14, borderWidth: 1, borderColor: cores.borda, padding: 14, gap: 8 },
  itemTitulo: { fontSize: 15, fontWeight: '700', color: cores.tinta },
  linhaBotoes: { flexDirection: 'row', gap: 10 },
  amigo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: cores.papel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    paddingLeft: 14,
    paddingRight: 6,
    minHeight: 52,
  },
  amigoNome: { flex: 1, fontSize: 15, fontWeight: '700', color: cores.tinta },
  desafiar: { minHeight: 40, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5, borderColor: cores.destaque, justifyContent: 'center' },
  desafiarTexto: { fontSize: 14, fontWeight: '800', color: cores.destaque },
  rodape: { padding: 16, borderTopWidth: 1, borderTopColor: cores.borda, backgroundColor: cores.papel },
  erro: { fontSize: 14, color: cores.erro, fontWeight: '600' },
  placar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, paddingVertical: 4 },
  placarLado: { alignItems: 'center', minWidth: 90 },
  placarNumero: { fontSize: 38, fontWeight: '800', color: '#FFFFFF' },
  placarNome: { fontSize: 13, fontWeight: '700', color: '#BBF7D0', maxWidth: 120 },
  placarX: { fontSize: 24, fontWeight: '800', color: '#86EFAC' },
  mesa: { height: 300, marginHorizontal: 12, borderRadius: 24, backgroundColor: '#2D6A40', overflow: 'hidden' },
  verso: {
    width: LARGURA_CARTA,
    height: ALTURA_CARTA,
    borderRadius: 8,
    borderWidth: 3,
    backgroundColor: '#161A26',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  versoTexto: { fontSize: 8, fontWeight: '800', color: '#FDE047', textAlign: 'center', letterSpacing: 1 },
  cartaVirada: { borderWidth: 3, borderRadius: 10 },
  mao: { position: 'absolute', alignSelf: 'center', top: 90, fontSize: 96 },
  painel: { padding: 16, gap: 12 },
  mensagem: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', minHeight: 44 },
  barraForca: { height: 26, borderRadius: 13, overflow: 'hidden', backgroundColor: '#E5E7EB' },
  faixa: { position: 'absolute', top: 0, bottom: 0 },
  marcador: { position: 'absolute', top: -2, bottom: -2, width: 6, marginLeft: -3, backgroundColor: '#161A26', borderRadius: 3 },
  botaoBater: { minHeight: 64, borderRadius: 32, backgroundColor: '#FDE047', alignItems: 'center', justifyContent: 'center' },
  botaoBaterTexto: { fontSize: 20, fontWeight: '800', color: '#161A26', letterSpacing: 1 },
  dica: { fontSize: 13, color: '#D1FAE5', textAlign: 'center' },
  resultadoTitulo: { fontSize: 24, fontWeight: '800', color: '#FDE047', textAlign: 'center' },
});
