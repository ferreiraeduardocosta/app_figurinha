import { ReactNode, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { RolagemComTeclado } from '../componentes/RolagemComTeclado';
import { api, ErroApi, ListaAmigos, ListaTrocas, RecompensaNova, StatusTroca, Sugestao, Troca, UsuarioResumo } from '../api';
import { Botao } from '../componentes/Botao';
import { MiniFigurinhas } from '../componentes/MiniFigurinhas';
import { AvisoRecompensas } from '../componentes/Recompensas';
import { useJogo } from '../jogo';
import { cores } from '../tema';
import { MontarTroca } from './MontarTroca';

type Aba = 'propostas' | 'mercado' | 'amigos';

const STATUS: Record<StatusTroca, string> = {
  PENDENTE: 'Pendente',
  ACEITA: 'Aceita',
  RECUSADA: 'Recusada',
  CANCELADA: 'Cancelada',
  EXPIRADA: 'Expirou',
  FALHOU: 'Não deu certo',
};

const mensagem = (e: unknown) => (e instanceof ErroApi || e instanceof Error ? e.message : 'Algo deu errado.');

export function Trocas() {
  const { sessao, perfil, recarregar } = useJogo();
  const [aba, setAba] = useState<Aba>('propostas');
  const [trocas, setTrocas] = useState<ListaTrocas | null>(null);
  const [amigos, setAmigos] = useState<ListaAmigos | null>(null);
  const [sugestoes, setSugestoes] = useState<Sugestao[] | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recompensas, setRecompensas] = useState<RecompensaNova[]>([]);
  const [montando, setMontando] = useState<{ amigo: UsuarioResumo; respondendo?: Troca } | null>(null);

  const token = sessao?.token ?? '';
  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [t, a, s] = await Promise.all([api.trocas(token), api.amigos(token), api.sugestoes(token)]);
      setTrocas(t);
      setAmigos(a);
      setSugestoes(s);
    } catch (e) {
      setErro(mensagem(e));
    }
  }, [token]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /** Executa uma ação, mostra o resultado e atualiza tudo (álbum e perfil também). */
  const agir = async (acao: () => Promise<unknown>, sucesso: string) => {
    setErro(null);
    setAviso(null);
    try {
      const r = await acao();
      if (r && typeof r === 'object' && 'recompensas' in r) setRecompensas((r as { recompensas: RecompensaNova[] }).recompensas);
      setAviso(sucesso);
    } catch (e) {
      setErro(mensagem(e));
    }
    await Promise.all([carregar(), recarregar().catch(() => undefined)]);
  };

  const pend = perfil?.pendencias;

  return (
    <View style={{ flex: 1 }}>
      <View style={estilos.abas} accessibilityRole="tablist">
        {(
          [
            ['propostas', 'Propostas', pend?.trocasRecebidas ?? 0],
            ['mercado', 'Mercado', 0],
            ['amigos', 'Amigos', pend?.pedidosAmizade ?? 0],
          ] as const
        ).map(([id, nome, n]) => (
          <Pressable
            key={id}
            accessibilityRole="tab"
            accessibilityState={{ selected: aba === id }}
            accessibilityLabel={n ? `${nome}, ${n} novidades` : nome}
            onPress={() => setAba(id)}
            style={[estilos.aba, aba === id && estilos.abaAtiva]}
          >
            <Text style={[estilos.abaTexto, aba === id && { color: cores.tinta }]}>{nome}</Text>
            {n > 0 && <Text style={estilos.contador}>{n}</Text>}
          </Pressable>
        ))}
      </View>

      <RolagemComTeclado
        contentContainerStyle={{ padding: 16, gap: 14 }}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={async () => {
              setAtualizando(true);
              await carregar();
              setAtualizando(false);
            }}
          />
        }
      >
        {aviso && (
          <Text style={estilos.aviso} accessibilityRole="alert">
            {aviso}
          </Text>
        )}
        {erro && (
          <Text style={estilos.erro} accessibilityRole="alert">
            {erro}
          </Text>
        )}
        <AvisoRecompensas recompensas={recompensas} />

        {!trocas || !amigos || !sugestoes ? (
          <ActivityIndicator color={cores.destaque} style={{ marginTop: 24 }} />
        ) : aba === 'propostas' ? (
          <Propostas
            trocas={trocas}
            eu={perfil?.id ?? ''}
            aceitar={(t) => agir(() => api.aceitarTroca(token, t.id), `Troca com ${t.propostaPor.apelido} feita! As figurinhas já estão no álbum.`)}
            recusar={(t) => agir(() => api.recusarTroca(token, t.id), 'Proposta recusada.')}
            cancelar={(t) => agir(() => api.cancelarTroca(token, t.id), 'Proposta cancelada.')}
            contrapropor={(t) => setMontando({ amigo: t.propostaPor, respondendo: t })}
          />
        ) : aba === 'mercado' ? (
          <Mercado sugestoes={sugestoes} propor={(amigo) => setMontando({ amigo })} irParaAmigos={() => setAba('amigos')} />
        ) : (
          <Amigos
            lista={amigos}
            pedir={(apelido) =>
              agir(async () => {
                const r = await api.pedirAmizade(token, apelido);
                return r;
              }, `Pedido enviado para ${apelido}. Se essa pessoa já tinha pedido, vocês já são amigos.`)
            }
            aceitar={(id, apelido) => agir(() => api.aceitarAmizade(token, id), `Agora você e ${apelido} são amigos.`)}
            remover={(id) => agir(() => api.removerAmizade(token, id), 'Feito.')}
          />
        )}
      </RolagemComTeclado>

      {montando && (
        <MontarTroca
          amigo={montando.amigo}
          respondendo={montando.respondendo}
          aoFechar={() => setMontando(null)}
          aoEnviar={() => {
            setMontando(null);
            setAba('propostas');
            agir(async () => undefined, `Proposta enviada para ${montando.amigo.apelido}.`);
          }}
        />
      )}
    </View>
  );
}

function Propostas({
  trocas,
  eu,
  aceitar,
  recusar,
  cancelar,
  contrapropor,
}: {
  trocas: ListaTrocas;
  eu: string;
  aceitar: (t: Troca) => void;
  recusar: (t: Troca) => void;
  cancelar: (t: Troca) => void;
  contrapropor: (t: Troca) => void;
}) {
  return (
    <>
      <Text style={estilos.secao}>Recebidas</Text>
      {trocas.recebidas.length === 0 && <Text style={estilos.vazio}>Nenhuma proposta esperando você.</Text>}
      {trocas.recebidas.map((t) => (
        <CartaoTroca key={t.id} troca={t} eu={eu}>
          <Botao titulo="Aceitar troca" onPress={() => aceitar(t)} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Botao titulo="Contrapropor" variante="secundario" onPress={() => contrapropor(t)} />
            </View>
            <View style={{ flex: 1 }}>
              <Botao titulo="Recusar" variante="secundario" onPress={() => recusar(t)} />
            </View>
          </View>
        </CartaoTroca>
      ))}

      <Text style={estilos.secao}>Enviadas</Text>
      {trocas.enviadas.length === 0 && <Text style={estilos.vazio}>Nenhuma proposta enviada esperando resposta.</Text>}
      {trocas.enviadas.map((t) => (
        <CartaoTroca key={t.id} troca={t} eu={eu}>
          <Botao titulo="Cancelar proposta" variante="secundario" onPress={() => cancelar(t)} />
        </CartaoTroca>
      ))}

      {trocas.historico.length > 0 && <Text style={estilos.secao}>Histórico</Text>}
      {trocas.historico.map((t) => (
        <CartaoTroca key={t.id} troca={t} eu={eu} />
      ))}
    </>
  );
}

/** Mostra a troca do ponto de vista de quem está olhando: "você dá" e "você recebe". */
function CartaoTroca({ troca: t, eu, children }: { troca: Troca; eu: string; children?: ReactNode }) {
  const souQuemPropos = t.propostaPor.id === eu;
  const outro = souQuemPropos ? t.para : t.propostaPor;
  const dou = souQuemPropos ? t.oferta : t.pedido;
  const recebo = souQuemPropos ? t.pedido : t.oferta;
  const dias = Math.max(0, Math.ceil((new Date(t.expiraEm).getTime() - Date.now()) / 86_400_000));
  return (
    <View style={estilos.cartao}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={estilos.cartaoTitulo}>{souQuemPropos ? `Para ${outro.apelido}` : `De ${outro.apelido}`}</Text>
        <Text style={[estilos.status, t.status === 'ACEITA' && { backgroundColor: '#D1FADF' }]}>
          {t.status === 'PENDENTE' ? `vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}` : STATUS[t.status]}
        </Text>
      </View>
      {t.respostaAId && <Text style={estilos.legenda}>Contraproposta</Text>}
      <Text style={estilos.legenda}>Você recebe</Text>
      <MiniFigurinhas itens={recebo} />
      <Text style={estilos.legenda}>Você dá</Text>
      <MiniFigurinhas itens={dou} />
      {t.status === 'FALHOU' && t.motivo && <Text style={estilos.legenda}>{t.motivo}</Text>}
      {children && <View style={{ gap: 10, marginTop: 6 }}>{children}</View>}
    </View>
  );
}

function Mercado({
  sugestoes,
  propor,
  irParaAmigos,
}: {
  sugestoes: Sugestao[];
  propor: (amigo: UsuarioResumo) => void;
  irParaAmigos: () => void;
}) {
  if (sugestoes.length === 0) {
    return (
      <View style={{ gap: 12 }}>
        <Text style={estilos.vazio}>O mercado mostra o que dá para trocar com seus amigos. Adicione amigos para começar.</Text>
        <Botao titulo="Adicionar amigos" onPress={irParaAmigos} />
      </View>
    );
  }
  return (
    <>
      <Text style={estilos.legenda}>Repetidas dos seus amigos que faltam no seu álbum, e as suas que faltam no deles.</Text>
      {sugestoes.map((s) => (
        <View key={s.amigo.id} style={estilos.cartao}>
          <Text style={estilos.cartaoTitulo}>{s.amigo.apelido}</Text>
          <Text style={estilos.legenda}>Você pode receber {s.euRecebo.length}</Text>
          <MiniFigurinhas itens={s.euRecebo.slice(0, 10).map((codigo) => ({ codigo, quantidade: 1 }))} vazio="Nada que falte para você." />
          <Text style={estilos.legenda}>Você pode dar {s.euDou.length}</Text>
          <MiniFigurinhas itens={s.euDou.slice(0, 10).map((codigo) => ({ codigo, quantidade: 1 }))} vazio="Nada que falte para esse amigo." />
          <View style={{ marginTop: 6 }}>
            <Botao titulo={`Propor troca a ${s.amigo.apelido}`} onPress={() => propor(s.amigo)} desabilitado={s.euRecebo.length === 0} />
          </View>
        </View>
      ))}
    </>
  );
}

function Amigos({
  lista,
  pedir,
  aceitar,
  remover,
}: {
  lista: ListaAmigos;
  pedir: (apelido: string) => void;
  aceitar: (id: string, apelido: string) => void;
  remover: (id: string) => void;
}) {
  const [apelido, setApelido] = useState('');
  const [confirmando, setConfirmando] = useState<string | null>(null);
  return (
    <>
      <View style={estilos.cartao}>
        <Text style={estilos.cartaoTitulo}>Adicionar amigo</Text>
        <Text style={estilos.legenda} nativeID="rotulo-apelido-amigo">
          Apelido do amigo
        </Text>
        <TextInput
          value={apelido}
          onChangeText={setApelido}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Apelido do amigo"
          accessibilityLabelledBy="rotulo-apelido-amigo"
          style={estilos.entrada}
        />
        <Botao
          titulo="Enviar pedido"
          desabilitado={apelido.trim().length < 3}
          onPress={() => {
            pedir(apelido.trim());
            setApelido('');
          }}
        />
      </View>

      {lista.recebidos.length > 0 && <Text style={estilos.secao}>Pedidos recebidos</Text>}
      {lista.recebidos.map((p) => (
        <View key={p.id} style={estilos.linha}>
          <Text style={estilos.nome}>{p.usuario.apelido}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Botao titulo="Aceitar" onPress={() => aceitar(p.id, p.usuario.apelido)} />
            <Botao titulo="Recusar" variante="secundario" onPress={() => remover(p.id)} />
          </View>
        </View>
      ))}

      {lista.enviados.length > 0 && <Text style={estilos.secao}>Pedidos enviados</Text>}
      {lista.enviados.map((p) => (
        <View key={p.id} style={estilos.linha}>
          <Text style={estilos.nome}>{p.usuario.apelido}</Text>
          <Botao titulo="Cancelar" variante="secundario" onPress={() => remover(p.id)} />
        </View>
      ))}

      <Text style={estilos.secao}>Amigos ({lista.amigos.length})</Text>
      {lista.amigos.length === 0 && <Text style={estilos.vazio}>Você ainda não tem amigos no jogo.</Text>}
      {lista.amigos.map((a) => (
        <View key={a.id} style={estilos.linha}>
          <Text style={estilos.nome}>{a.usuario.apelido}</Text>
          {confirmando === a.id ? (
            <Botao
              titulo="Confirmar remoção"
              variante="secundario"
              onPress={() => {
                setConfirmando(null);
                remover(a.id);
              }}
            />
          ) : (
            <Botao titulo="Remover" variante="secundario" onPress={() => setConfirmando(a.id)} />
          )}
        </View>
      ))}
    </>
  );
}

const estilos = StyleSheet.create({
  abas: { flexDirection: 'row', backgroundColor: cores.vazio, borderRadius: 12, padding: 4, margin: 16, marginBottom: 0 },
  aba: { flex: 1, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  abaAtiva: { backgroundColor: '#FFFFFF' },
  abaTexto: { fontSize: 15, fontWeight: '700', color: cores.apagado },
  contador: {
    minWidth: 20,
    textAlign: 'center',
    backgroundColor: cores.erro,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    borderRadius: 10,
    paddingHorizontal: 5,
    overflow: 'hidden',
  },
  secao: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: cores.apagado, marginTop: 6 },
  vazio: { fontSize: 15, color: cores.apagado },
  cartao: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: cores.borda, padding: 14, gap: 8 },
  cartaoTitulo: { fontSize: 18, fontWeight: '800', color: cores.tinta },
  legenda: { fontSize: 13, color: cores.apagado },
  status: { fontSize: 12, fontWeight: '700', color: cores.tinta, backgroundColor: cores.vazio, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: 12,
  },
  nome: { fontSize: 16, fontWeight: '700', color: cores.tinta, flexShrink: 1 },
  entrada: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.fundo,
    paddingHorizontal: 14,
    fontSize: 16,
    color: cores.tinta,
  },
  aviso: { backgroundColor: '#D1FADF', color: '#05603A', fontWeight: '600', padding: 12, borderRadius: 12, overflow: 'hidden' },
  erro: { backgroundColor: '#FEF3F2', color: cores.erro, fontWeight: '600', padding: 12, borderRadius: 12, overflow: 'hidden' },
});
