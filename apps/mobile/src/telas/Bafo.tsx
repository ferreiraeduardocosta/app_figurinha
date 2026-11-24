import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { api, ErroApi, ListaAmigos, ListaBafo, ListaRodas, PartidaBafo, RodaBafo, UsuarioResumo } from '../api';
import { Botao } from '../componentes/Botao';
import { Figurinha } from '../componentes/Figurinha';
import { MiniFigurinhas, SeletorFigurinhas } from '../componentes/MiniFigurinhas';
import { useJogo } from '../jogo';
import { cores } from '../tema';

const nativo = Platform.OS !== 'web';
const MAX_CARTAS = 3;

type Escolha =
  | { modo: 'computador' }
  | { modo: 'desafio'; amigo: UsuarioResumo }
  | { modo: 'aceitar'; partida: PartidaBafo }
  | { modo: 'roda'; amigos: UsuarioResumo[] }
  | { modo: 'entrarRoda'; roda: RodaBafo };

/** O que a mesa mostra: uma partida 1 contra 1 ou uma rodinha convertida para o mesmo formato. */
type MesaDados = PartidaBafo & {
  roda?: boolean;
  jogadores?: { apelido: string; placar: number; minha: boolean; daVez: boolean }[];
};
type Tela = { tipo: 'lobby' } | { tipo: 'escolher'; escolha: Escolha } | { tipo: 'mesa'; partida: MesaDados };

/** Converte a rodinha para o formato da mesa (cartas minhas = 'EU', dos outros = 'ADVERSARIO'). */
function rodaParaMesa(r: RodaBafo): MesaDados {
  const eu = r.jogadores.find((j) => j.minha)?.id;
  const dentro = r.jogadores.filter((j) => j.lado);
  return {
    id: r.id,
    roda: true,
    status: r.status,
    contraComputador: false,
    quantidade: r.quantidade,
    euDesafiei: r.souAnfitriao,
    adversario: { id: r.vez?.id ?? null, apelido: r.vez?.apelido ?? 'a rodinha' },
    cartasDesafiante: r.cartasAnfitriao,
    monte: r.monte.map((c) => ({
      minha: c.minha,
      virou: c.virouPor === null ? null : c.virouPor === eu ? 'EU' : 'ADVERSARIO',
      codigo: c.codigo,
    })),
    batidas: r.batidas.map((b) => ({ minha: b.minha, precisao: b.precisao, viradas: b.viradas, especial: b.especial, apelido: b.apelido })),
    minhaVez: r.minhaVez,
    placar: { eu: dentro.find((j) => j.minha)?.placar ?? 0, adversario: dentro.filter((j) => !j.minha).reduce((s, j) => s + j.placar, 0) },
    recebi: r.recebi,
    expiraEm: r.expiraEm,
    novas: r.novas,
    recompensas: r.recompensas,
    jogadores: dentro.map((j) => ({ apelido: j.minha ? 'Você' : j.apelido, placar: j.placar, minha: j.minha, daVez: r.vez?.id === j.id })),
  };
}

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
  aoAbrir: (p: MesaDados) => void;
}) {
  const { sessao, album, recarregar } = useJogo();
  const [lista, setLista] = useState<ListaBafo | null>(null);
  const [rodas, setRodas] = useState<ListaRodas | null>(null);
  const [convidando, setConvidando] = useState<Set<string> | null>(null);
  const [amigos, setAmigos] = useState<ListaAmigos | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const token = sessao?.token ?? '';

  const carregar = useCallback(async () => {
    try {
      const [l, a, r] = await Promise.all([api.bafo(token), api.amigos(token), api.rodas(token).catch(() => null)]);
      setLista(l);
      setAmigos(a);
      setRodas(r);
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


            <Secao titulo="Rodinha (3 a 6 amigos)">
              {(rodas?.convites ?? []).map((r) => (
                <View key={r.id} style={estilos.item}>
                  <Text style={estilos.itemTitulo}>
                    {r.anfitriao.apelido} chamou você para uma rodinha · {r.quantidade} figurinha{r.quantidade > 1 ? 's' : ''} cada
                  </Text>
                  <Text style={estilos.legenda}>Na rodinha: {r.jogadores.filter((j) => j.status !== 'RECUSOU').map((j) => j.apelido).join(', ')}</Text>
                  <MiniFigurinhas itens={agrupar(r.cartasAnfitriao)} />
                  <View style={estilos.linhaBotoes}>
                    <View style={{ flex: 1 }}>
                      <Botao titulo="Entrar" onPress={() => aoEscolher({ modo: 'entrarRoda', roda: r })} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Botao titulo="Recusar" variante="secundario" carregando={ocupado === r.id} onPress={() => acao(r.id, () => api.recusarRoda(token, r.id))} />
                    </View>
                  </View>
                </View>
              ))}
              {(rodas?.emAndamento ?? []).map((r) => (
                <Pressable key={r.id} style={estilos.item} onPress={() => aoAbrir(rodaParaMesa(r))} accessibilityRole="button">
                  <Text style={estilos.itemTitulo}>
                    Rodinha · {r.jogadores.filter((j) => j.lado).map((j) => `${j.minha ? 'Você' : j.apelido} ${j.placar}`).join(' · ')}
                  </Text>
                  <Text style={[estilos.legenda, r.minhaVez && { color: cores.destaque, fontWeight: '800' }]}>
                    {r.minhaVez ? 'Sua vez de bater! Toque para jogar.' : `Vez de ${r.vez?.apelido ?? '...'}.`}
                  </Text>
                </Pressable>
              ))}
              {(rodas?.esperando ?? []).map((r) => {
                const dentro = r.jogadores.filter((j) => j.status === 'DENTRO').length;
                return (
                  <View key={r.id} style={estilos.item}>
                    <Text style={estilos.itemTitulo}>Rodinha esperando · {dentro} de {r.jogadores.filter((j) => j.status !== 'RECUSOU').length} dentro</Text>
                    <Text style={estilos.legenda}>
                      {r.jogadores.map((j) => `${j.minha ? 'Você' : j.apelido} ${j.status === 'DENTRO' ? '✓' : j.status === 'RECUSOU' ? '✗' : '…'}`).join('  ')}
                    </Text>
                    {r.souAnfitriao && (
                      <View style={estilos.linhaBotoes}>
                        <View style={{ flex: 1 }}>
                          <Botao titulo="Começar" desabilitado={dentro < 3} carregando={ocupado === r.id + 'c'} onPress={() => acao(r.id + 'c', () => api.comecarRoda(token, r.id))} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Botao titulo="Cancelar" variante="secundario" carregando={ocupado === r.id + 'x'} onPress={() => acao(r.id + 'x', () => api.cancelarRoda(token, r.id))} />
                        </View>
                      </View>
                    )}
                    {r.souAnfitriao && dentro < 3 && <Text style={estilos.legenda}>Dá para começar com 3 ou mais dentro.</Text>}
                  </View>
                );
              })}
              {convidando === null ? (
                <Botao
                  titulo="Criar rodinha"
                  variante="secundario"
                  desabilitado={repetidas === 0 || (amigos?.amigos ?? []).length < 2}
                  onPress={() => setConvidando(new Set())}
                />
              ) : (
                <View style={estilos.item}>
                  <Text style={estilos.itemTitulo}>Quem vai para a rodinha? ({convidando.size}/5)</Text>
                  {(amigos?.amigos ?? []).map((a) => {
                    const marcado = convidando.has(a.usuario.id);
                    return (
                      <Pressable
                        key={a.id}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: marcado }}
                        onPress={() => {
                          const n = new Set(convidando);
                          if (marcado) n.delete(a.usuario.id);
                          else if (n.size < 5) n.add(a.usuario.id);
                          setConvidando(n);
                        }}
                        style={[estilos.amigo, marcado && { borderColor: cores.destaque, borderWidth: 2 }]}
                      >
                        <Text style={estilos.amigoNome}>{a.usuario.apelido}</Text>
                        <Text style={[estilos.desafiarTexto, { paddingRight: 10 }]}>{marcado ? '✓' : ''}</Text>
                      </Pressable>
                    );
                  })}
                  <View style={estilos.linhaBotoes}>
                    <View style={{ flex: 1 }}>
                      <Botao
                        titulo="Escolher figurinhas"
                        desabilitado={convidando.size < 2}
                        onPress={() => {
                          const escolhidos = (amigos?.amigos ?? []).filter((a) => convidando.has(a.usuario.id)).map((a) => a.usuario);
                          setConvidando(null);
                          aoEscolher({ modo: 'roda', amigos: escolhidos });
                        }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Botao titulo="Voltar" variante="secundario" onPress={() => setConvidando(null)} />
                    </View>
                  </View>
                </View>
              )}
              {(amigos?.amigos ?? []).length < 2 && <Text style={estilos.legenda}>Você precisa de pelo menos 2 amigos para uma rodinha.</Text>}
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

function EscolherCartas({ escolha, aoVoltar, aoComecar }: { escolha: Escolha; aoVoltar: () => void; aoComecar: (p: MesaDados) => void }) {
  const { sessao, album, recarregar, porCodigo, temporada: escolhida, perfil } = useJogo();
  // O monte é de uma temporada só: a das cartas do desafio, ou a escolhida no seletor.
  const cartasDoOutro =
    escolha.modo === 'aceitar' ? escolha.partida.cartasDesafiante : escolha.modo === 'entrarRoda' ? escolha.roda.cartasAnfitriao : null;
  const temporada = cartasDoOutro ? (porCodigo[cartasDoOutro[0]]?.temporada ?? 1) : escolhida;
  const variasTemporadas = (perfil?.temporadas?.length ?? 1) > 1;
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const exato = escolha.modo === 'aceitar' ? escolha.partida.quantidade : escolha.modo === 'entrarRoda' ? escolha.roda.quantidade : null;
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
  const titulo =
    escolha.modo === 'computador'
      ? 'Contra o computador'
      : escolha.modo === 'desafio'
        ? `Desafiar ${escolha.amigo.apelido}`
        : escolha.modo === 'aceitar'
          ? `Aceitar desafio de ${escolha.partida.adversario.apelido}`
          : escolha.modo === 'roda'
            ? `Rodinha com ${escolha.amigos.map((a) => a.apelido).join(', ')}`
            : `Rodinha de ${escolha.roda.anfitriao.apelido}`;

  const confirmar = async () => {
    if (!sessao) return;
    setErro(null);
    setEnviando(true);
    try {
      const cartas = [...marcadas];
      const p: MesaDados =
        escolha.modo === 'computador'
          ? await api.bafoComputador(sessao.token, cartas)
          : escolha.modo === 'desafio'
            ? await api.desafiarBafo(sessao.token, escolha.amigo.id, cartas)
            : escolha.modo === 'aceitar'
              ? await api.aceitarBafo(sessao.token, escolha.partida.id, cartas)
              : escolha.modo === 'roda'
                ? rodaParaMesa(await api.criarRoda(sessao.token, escolha.amigos.map((a) => a.id), cartas))
                : rodaParaMesa(await api.entrarRoda(sessao.token, escolha.roda.id, cartas));
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
            : `Escolha de 1 a ${MAX_CARTAS} repetidas. ${escolha.modo === 'computador' ? 'O computador põe figurinhas da mesma raridade.' : escolha.modo === 'roda' ? 'Cada amigo põe a mesma quantidade.' : 'Seu amigo põe a mesma quantidade.'}`}{' '}
          As que outro jogador virar ficam com ele.
        </Text>
        {cartasDoOutro && (
          <View style={estilos.item}>
            <Text style={estilos.legenda}>
              No monte de {escolha.modo === 'aceitar' ? escolha.partida.adversario.apelido : escolha.modo === 'entrarRoda' ? escolha.roda.anfitriao.apelido : ''}:
            </Text>
            <MiniFigurinhas itens={agrupar(cartasDoOutro)} />
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
          titulo={escolha.modo === 'desafio' ? 'Enviar desafio' : escolha.modo === 'roda' ? 'Enviar convites' : escolha.modo === 'entrarRoda' ? 'Entrar na rodinha' : 'Ir para o monte'}
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
/** Tempo (ms) da marca para atravessar a barra. Mais lento = mais fácil acertar o verde. */
const PERIODO_BARRA = 1100;
const ALTURA_CARTA = (LARGURA_CARTA * 392) / 280;

function Mesa({ inicial, aoVoltar, aoJogarDeNovo }: { inicial: MesaDados; aoVoltar: () => void; aoJogarDeNovo: () => void }) {
  const { sessao, porCodigo, clubes, recarregar } = useJogo();
  const token = sessao?.token ?? '';
  const [partida, setPartida] = useState<MesaDados>(inicial);
  const buscarPartida = (id: string): Promise<MesaDados> =>
    inicial.roda ? api.roda(token, id).then(rodaParaMesa) : api.partidaBafo(token, id);
  const baterNaPartida = (id: string, precisao: number): Promise<MesaDados> =>
    inicial.roda ? api.baterRoda(token, id, precisao).then(rodaParaMesa) : api.baterBafo(token, id, precisao);
  /** Quantas batidas já foram mostradas (as seguintes são animadas uma a uma). */
  const [mostradas, setMostradas] = useState(inicial.batidas.length);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [batendo, setBatendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [larguraMesa, setLarguraMesa] = useState(320);
  const novasRef = useRef<string[]>([]);

  const marcador = useRef(new Animated.Value(0)).current;
  /** Momento em que o dedo encostou: a posição da marca é calculada pelo tempo, não pela animação. */
  const inicioToque = useRef<number | null>(null);
  const animMarcador = useRef<Animated.CompositeAnimation | null>(null);
  const mao = useRef(new Animated.Value(0)).current;
  const tremor = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const brilho = useRef(new Animated.Value(0)).current;
  const [maoDeQuem, setMaoDeQuem] = useState<'EU' | 'ADVERSARIO'>('EU');
  const [ouro, setOuro] = useState(false);
  /** Enquanto mostra batidas uma a uma; fora disso o placar acompanha o servidor. */
  const revelando = useRef(false);

  // Rede de segurança do placar: se uma sequência de animação não terminar (app em segundo
  // plano, animação interrompida), mostra direto o que o servidor já mandou.
  useEffect(() => {
    if (!batendo && !revelando.current && mostradas < partida.batidas.length) setMostradas(partida.batidas.length);
  }, [batendo, mostradas, partida]);

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
      else if (c.virou === 'ADVERSARIO') adv++;
    });
    return { eu, adv };
  }, [partida, viradasVisiveis]);

  /** Roda uma animação e resolve no fim, ou depois de `limite` ms se ela não avisar (Android em segundo plano). */
  const rodar = (anim: Animated.CompositeAnimation, limite: number) =>
    Promise.race([new Promise<void>((fim) => anim.start(() => fim())), esperar(limite)]);

  const animarBatida = (quem: 'EU' | 'ADVERSARIO') => {
    setMaoDeQuem(quem);
    mao.setValue(0);
    return rodar(
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
      ]),
      1200,
    );
  };

  const revelar = (n: number, especial: boolean) => {
    pop.setValue(0.4);
    setMostradas(n);
    const animacoes = [Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: nativo })];
    if (especial) {
      setOuro(true);
      brilho.setValue(0);
      animacoes.push(
        Animated.sequence([
          Animated.timing(brilho, { toValue: 1, duration: 180, useNativeDriver: nativo }),
          Animated.delay(900),
          Animated.timing(brilho, { toValue: 0, duration: 400, useNativeDriver: nativo }),
        ]),
      );
    }
    return rodar(Animated.parallel(animacoes), especial ? 2000 : 900).then(() => setOuro(false));
  };

  /** Mostra, uma a uma, as batidas que chegaram do servidor. */
  const mostrarNovas = useCallback(
    async (p: MesaDados, desde: number, pularMinhaMao: boolean) => {
      revelando.current = true;
      try {
        for (let i = desde; i < p.batidas.length; i++) {
          const b = p.batidas[i];
          if (!(b.minha && pularMinhaMao && i === desde)) await animarBatida(b.minha ? 'EU' : 'ADVERSARIO');
          await revelar(i + 1, !!b.especial);
          const n = b.viradas.length;
          const quem = b.minha ? 'Você' : (b.apelido ?? p.adversario.apelido);
          const zona = b.precisao >= 0.97 ? 'no ponto dourado' : b.precisao >= 0.85 ? 'no verde' : b.precisao >= 0.5 ? 'no amarelo' : 'no vermelho';
          setMensagem(
            b.especial
              ? `BAFO DE OURO! ${quem} virou ${n} figurinha${n > 1 ? 's' : ''}!`
              : n === 0
                ? `${quem} bateu${b.minha ? ` ${zona}` : ''} e não virou nenhuma${b.minha ? '. Solte no verde: lá sempre vira!' : '.'}`
                : `${quem} virou ${n} figurinha${n > 1 ? 's' : ''}${b.minha ? ` (${zona})` : ''}!`,
          );
          if (i < p.batidas.length - 1) await esperar(1100);
        }
      } finally {
        revelando.current = false;
        setMostradas((m) => Math.max(m, p.batidas.length));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Contra amigos: confere a cada 4 s se o outro já bateu.
  useEffect(() => {
    if (partida.contraComputador || partida.status !== 'JOGANDO' || partida.minhaVez || batendo) return;
    const id = setInterval(async () => {
      if (revelando.current) return;
      try {
        const p = await buscarPartida(partida.id);
        if (p.batidas.length > partida.batidas.length || p.status !== partida.status || p.minhaVez !== partida.minhaVez) {
          const desde = Math.min(mostradas, partida.batidas.length);
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

  const posicaoNoTempo = (ms: number) => {
    const fase = (ms % (2 * PERIODO_BARRA)) / PERIODO_BARRA;
    return fase <= 1 ? fase : 2 - fase;
  };

  const segurar = () => {
    if (!partida.minhaVez || batendo) return;
    inicioToque.current = Date.now();
    marcador.setValue(0);
    animMarcador.current = Animated.loop(
      Animated.sequence([
        Animated.timing(marcador, { toValue: 1, duration: PERIODO_BARRA, easing: Easing.linear, useNativeDriver: false }),
        Animated.timing(marcador, { toValue: 0, duration: PERIODO_BARRA, easing: Easing.linear, useNativeDriver: false }),
      ]),
    );
    animMarcador.current.start();
  };

  const soltar = async () => {
    if (!animMarcador.current || inicioToque.current === null || batendo) return;
    animMarcador.current.stop();
    animMarcador.current = null;
    // Posição calculada pelo tempo segurado: independe de atraso da animação.
    const x = posicaoNoTempo(Date.now() - inicioToque.current);
    inicioToque.current = null;
    marcador.setValue(x);
    const precisao = Math.max(0, 1 - Math.abs(x - 0.5) / 0.5);
    setBatendo(true);
    setErro(null);
    setMensagem(null);
    try {
      const [p] = await Promise.all([baterNaPartida(partida.id, precisao), animarBatida('EU')]);
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
  // Rodinha: placar de cada um contando só as batidas já mostradas.
  const placarRoda = useMemo(() => {
    if (!partida.jogadores) return [];
    const conta: Record<string, number> = {};
    partida.batidas.slice(0, mostradas).forEach((b) => {
      const nome = b.minha ? 'Você' : (b.apelido ?? '');
      conta[nome] = (conta[nome] ?? 0) + b.viradas.length;
    });
    return partida.jogadores.map((j) => conta[j.apelido] ?? 0);
  }, [partida, mostradas]);
  // Duas mãos: entram pelas laterais (minha vez, de baixo; adversário, de cima) e se encontram no monte.
  const maoY = mao.interpolate({ inputRange: [0, 1, 2], outputRange: maoDeQuem === 'EU' ? [180, 0, 180] : [-180, 0, -180] });
  const maoEsqX = mao.interpolate({ inputRange: [0, 1, 2], outputRange: [-120, -38, -120] });
  const maoDirX = mao.interpolate({ inputRange: [0, 1, 2], outputRange: [120, 38, 120] });
  const maoOpacidade = mao.interpolate({ inputRange: [0, 0.2, 1, 1.8, 2], outputRange: [0, 1, 1, 1, 0] });
  const giro = maoDeQuem === 'EU' ? '0deg' : '180deg';
  const tremorX = tremor.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] });

  return (
    <View style={{ flex: 1, backgroundColor: '#1F5130' }}>
      <Barra titulo={partida.roda ? 'Rodinha de bafo' : `Bafo · ${partida.adversario.apelido}`} aoVoltar={aoVoltar} escura />
      {partida.jogadores ? (
        <View style={estilos.placarRoda} accessibilityLiveRegion="polite">
          {partida.jogadores.map((j, i) => (
            <View key={i} style={[estilos.placarRodaItem, j.daVez && !terminou && estilos.placarRodaVez]}>
              <Text style={estilos.placarRodaNumero}>{placarRoda[i] ?? j.placar}</Text>
              <Text style={estilos.placarNome} numberOfLines={1}>
                {j.apelido}
              </Text>
            </View>
          ))}
        </View>
      ) : (
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
      )}

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
        <View style={estilos.maos} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Animated.Text
            style={[estilos.mao, { opacity: maoOpacidade, transform: [{ translateX: maoEsqX }, { translateY: maoY }, { rotate: giro }, { scaleX: -1 }] }]}
          >
            🖐️
          </Animated.Text>
          <Animated.Text style={[estilos.mao, { opacity: maoOpacidade, transform: [{ translateX: maoDirX }, { translateY: maoY }, { rotate: giro }] }]}>
            🖐️
          </Animated.Text>
        </View>
        {ouro && (
          <Animated.View style={[StyleSheet.absoluteFill, estilos.ouro, { opacity: brilho }]} pointerEvents="none">
            <Text style={estilos.ouroTexto}>✨ BAFO DE OURO ✨</Text>
          </Animated.View>
        )}
      </Animated.View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={estilos.painel}>
        {terminou ? (
          <Resultado partida={partida} novas={novasRef.current} aoVoltar={aoVoltar} aoJogarDeNovo={aoJogarDeNovo} />
        ) : (
          <>
            <Text style={estilos.mensagem} accessibilityLiveRegion="polite">
              {mensagem ??
                (partida.minhaVez
                  ? 'Segure e solte com a marca no verde. No dourado é Bafo de Ouro!'
                  : `Esperando ${partida.adversario.apelido} bater...`)}
            </Text>
            <View style={estilos.barraForca} accessibilityElementsHidden importantForAccessibility="no">
              {/* Faixas casam com as regras: verde = precisão ≥ 0,85 (42,5% a 57,5%); dourado = ≥ 0,97 (48,5% a 51,5%). */}
              <View style={[estilos.faixa, { left: '0%', width: '25%', backgroundColor: '#FCA5A5' }]} />
              <View style={[estilos.faixa, { left: '25%', width: '17.5%', backgroundColor: '#FDE68A' }]} />
              <View style={[estilos.faixa, { left: '42.5%', width: '15%', backgroundColor: '#4ADE80' }]} />
              <View style={[estilos.faixa, { left: '48.5%', width: '3%', backgroundColor: '#F59E0B' }]} />
              <View style={[estilos.faixa, { left: '57.5%', width: '17.5%', backgroundColor: '#FDE68A' }]} />
              <View style={[estilos.faixa, { left: '75%', width: '25%', backgroundColor: '#FCA5A5' }]} />
              <Animated.View
                style={[estilos.marcador, { left: marcador.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
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
  placarRoda: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 4 },
  placarRodaItem: { alignItems: 'center', minWidth: 64, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
  placarRodaVez: { borderColor: '#FDE047' },
  placarRodaNumero: { fontSize: 26, fontWeight: '800', color: '#FFFFFF' },
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
  maos: { position: 'absolute', left: 0, right: 0, top: 95, flexDirection: 'row', justifyContent: 'center' },
  mao: { fontSize: 84, marginHorizontal: -10 },
  ouro: { backgroundColor: 'rgba(251, 191, 36, 0.35)', alignItems: 'center', justifyContent: 'center' },
  ouroTexto: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: '#B45309',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
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
