import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, ScrollViewInstance, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { api, ErroApi, Loja as DadosLoja, Oferta, OrigemPacote } from '../api';
import { Botao } from '../componentes/Botao';
import { useJogo } from '../jogo';
import { comprar, precoExibido } from '../pagamentos';
import { cores } from '../tema';

const real = (centavos: number) => (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const mensagem = (e: unknown) => (e instanceof ErroApi || e instanceof Error ? e.message : 'Algo deu errado.');

export function Loja({
  aoAbrirPacote,
  aoVerProbabilidades,
}: {
  aoAbrirPacote: (origem: OrigemPacote) => void;
  aoVerProbabilidades: () => void;
}) {
  const { sessao, perfil, recarregar } = useJogo();
  const [loja, setLoja] = useState<DadosLoja | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [comprando, setComprando] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const rolagem = useRef<ScrollViewInstance>(null);
  const token = sessao?.token ?? '';

  const carregar = useCallback(async () => {
    try {
      setLoja(await api.loja(token));
    } catch (e) {
      setErro(mensagem(e));
    }
  }, [token]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const comprarOferta = async (oferta: Oferta) => {
    if (!loja) return;
    setErro(null);
    setAviso(null);
    setComprando(oferta.id);
    try {
      const r = await comprar(token, loja, oferta);
      if (r.status === 'concluida') {
        setAviso(`Compra concluída! ${r.pacotes} ${r.pacotes === 1 ? 'pacote adicionado' : 'pacotes adicionados'}.`);
      }
      // O aviso fica no topo: volta para lá para o jogador ver o resultado.
      rolagem.current?.scrollTo({ y: 0, animated: true });
    } catch (e) {
      setErro(mensagem(e));
      rolagem.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setComprando(null);
      await Promise.all([carregar(), recarregar().catch(() => undefined)]);
    }
  };

  if (!loja || !perfil) {
    return erro ? <Text style={[estilos.erro, { margin: 16 }]}>{erro}</Text> : <ActivityIndicator color={cores.destaque} style={{ flex: 1 }} />;
  }

  const c = loja.compras;
  const precoMoedas = loja.pacoteComMoedas.preco;
  const menorPacote = Math.min(...loja.ofertas.map((o) => o.precoReferenciaCentavos / o.pacotes));

  return (
    <ScrollView
      ref={rolagem}
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
      <View style={estilos.cabecalho}>
        <Text style={estilos.titulo}>Loja</Text>
        <View style={estilos.moedas} accessible accessibilityLabel={`${loja.moedas} moedas`}>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path d="M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18Z" fill="#D4A017" />
            <Path d="M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10Z" fill="none" stroke="#FFF7D6" strokeWidth={2} />
          </Svg>
          <Text style={estilos.moedasTexto}>{loja.moedas.toLocaleString('pt-BR')}</Text>
        </View>
      </View>

      {aviso && (
        <View style={estilos.sucesso} accessibilityRole="alert">
          <Text style={estilos.sucessoTexto}>{aviso}</Text>
          <Botao titulo="Abrir pacote agora" onPress={() => aoAbrirPacote('comprado')} />
        </View>
      )}
      {erro && (
        <Text style={estilos.erro} accessibilityRole="alert">
          {erro}
        </Text>
      )}
      {loja.modoTeste && (
        <Text style={estilos.teste}>Modo de teste: as compras são simuladas e nada é cobrado.</Text>
      )}

      {/* Exigência das lojas: probabilidades visíveis antes de qualquer compra. */}
      <Pressable accessibilityRole="link" onPress={aoVerProbabilidades} style={estilos.probabilidades}>
        <Text style={estilos.probTitulo}>Antes de comprar, veja as probabilidades</Text>
        <Text style={estilos.probTexto}>
          Cada pacote tem 5 figurinhas: Comum 62%, Rara 25%, Épica 10%, Lendária 3%. Épica garantida a cada 10 pacotes e Lendária a cada 30.
        </Text>
        <Text style={estilos.link}>Ver todas as regras</Text>
      </Pressable>

      {perfil.pacotesComprados > 0 && (
        <View style={estilos.cartao}>
          <Text style={estilos.rotulo}>Seus pacotes</Text>
          <Text style={estilos.texto}>
            Você tem {perfil.pacotesComprados} {perfil.pacotesComprados === 1 ? 'pacote comprado' : 'pacotes comprados'} para abrir.
          </Text>
          <Botao titulo="Abrir pacote" onPress={() => aoAbrirPacote('comprado')} />
        </View>
      )}

      <View style={estilos.cartao}>
        <Text style={estilos.rotulo}>Com moedas</Text>
        <Text style={estilos.ofertaNome}>1 pacote · {precoMoedas} moedas</Text>
        <Text style={estilos.texto}>Moedas vêm de bônus de compras e, em breve, de missões diárias.</Text>
        <Botao
          titulo={loja.moedas >= precoMoedas ? `Abrir por ${precoMoedas} moedas` : `Faltam ${precoMoedas - loja.moedas} moedas`}
          onPress={() => aoAbrirPacote('moedas')}
          desabilitado={loja.moedas < precoMoedas}
          variante="secundario"
        />
      </View>

      <Text style={estilos.secao}>Pacotes</Text>
      {!c.podeComprar && <Bloqueio loja={loja} aoInformar={(l) => setLoja(l)} />}
      {c.podeComprar && c.limiteMesCentavos !== null && (
        <Text style={estilos.texto}>
          Limite mensal para menores de 18 anos: {real(c.gastoMesCentavos)} de {real(c.limiteMesCentavos)} usados.
        </Text>
      )}

      {loja.ofertas.map((o) => {
        const porPacote = o.precoReferenciaCentavos / o.pacotes;
        const desconto = Math.round((1 - porPacote / loja.ofertas[0].precoReferenciaCentavos) * 100);
        const passaDoLimite = c.limiteMesCentavos !== null && c.gastoMesCentavos + o.precoReferenciaCentavos > c.limiteMesCentavos;
        return (
          <View key={o.id} style={[estilos.cartao, o.destaque ? estilos.cartaoDestaque : null]}>
            {o.destaque && <Text style={estilos.selo}>{o.destaque}</Text>}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={estilos.ofertaNome}>{o.nome}</Text>
                <Text style={estilos.texto}>
                  {o.pacotes} {o.pacotes === 1 ? 'pacote' : 'pacotes'}
                  {o.moedasBonus > 0 ? ` + ${o.moedasBonus} moedas de bônus` : ''}
                </Text>
                <Text style={estilos.detalhe}>
                  {real(porPacote)} por pacote{desconto > 0 ? ` · ${desconto}% mais barato` : ''}
                  {porPacote === menorPacote && loja.ofertas.length > 1 ? ' · melhor preço' : ''}
                </Text>
              </View>
              <Text style={estilos.preco}>{precoExibido(o)}</Text>
            </View>
            <Botao
              titulo={passaDoLimite ? 'Passa do limite mensal' : 'Comprar'}
              onPress={() => comprarOferta(o)}
              carregando={comprando === o.id}
              desabilitado={!c.podeComprar || passaDoLimite || (comprando !== null && comprando !== o.id)}
            />
          </View>
        );
      })}
      <Text style={estilos.rodape}>
        Pagamento processado pela App Store ou Google Play. Figurinhas e moedas não têm valor em dinheiro e não podem ser vendidas.
      </Text>
    </ScrollView>
  );
}

/** Explica por que não dá para comprar e, se faltar, pede a data de nascimento. */
function Bloqueio({ loja, aoInformar }: { loja: DadosLoja; aoInformar: (l: DadosLoja) => void }) {
  const { sessao } = useJogo();
  const [data, setData] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const motivo = loja.compras.motivo;

  if (motivo === 'IDADE_MINIMA') {
    return <Text style={estilos.bloqueio}>Compras só a partir de 13 anos. Você ainda pode jogar e ganhar pacotes grátis todo dia.</Text>;
  }
  if (motivo === 'LIMITE_MENSAL') {
    return <Text style={estilos.bloqueio}>Você atingiu o limite de compras deste mês para menores de 18 anos. Ele renova no dia 1º.</Text>;
  }

  // DD/MM/AAAA → AAAA-MM-DD
  const enviar = async () => {
    const m = data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) {
      setErro('Use o formato DD/MM/AAAA.');
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      aoInformar(await api.informarNascimento(sessao?.token ?? '', `${m[3]}-${m[2]}-${m[1]}`));
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View style={estilos.cartao}>
      <Text style={estilos.rotulo}>Antes da primeira compra</Text>
      <Text style={estilos.texto}>
        Informe sua data de nascimento. Menores de 13 anos não compram e, de 13 a 17 anos, há limite de R$ 50 por mês. A data não pode
        ser alterada depois.
      </Text>
      <Text style={estilos.texto} nativeID="rotulo-nascimento">
        Data de nascimento (DD/MM/AAAA)
      </Text>
      <TextInput
        value={data}
        onChangeText={(t) => {
          const d = t.replace(/\D/g, '').slice(0, 8);
          setData([d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('/'));
        }}
        keyboardType="number-pad"
        placeholder="DD/MM/AAAA"
        accessibilityLabel="Data de nascimento"
        accessibilityLabelledBy="rotulo-nascimento"
        style={estilos.entrada}
        placeholderTextColor={cores.apagado}
      />
      {erro && (
        <Text style={{ color: cores.erro, fontWeight: '600' }} accessibilityRole="alert">
          {erro}
        </Text>
      )}
      <Botao titulo="Confirmar" onPress={enviar} carregando={enviando} desabilitado={data.length < 10} />
    </View>
  );
}

const estilos = StyleSheet.create({
  cabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  titulo: { fontSize: 30, fontWeight: '800', color: cores.tinta, textTransform: 'uppercase' },
  moedas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  moedasTexto: { fontSize: 15, fontWeight: '700', color: cores.tinta },
  probabilidades: { backgroundColor: cores.tinta, borderRadius: 16, padding: 16, gap: 6 },
  probTitulo: { color: '#FBBF24', fontSize: 15, fontWeight: '800' },
  probTexto: { color: '#FFFFFF', fontSize: 14, lineHeight: 20 },
  link: { color: '#7DD3C8', fontSize: 14, fontWeight: '700', marginTop: 4 },
  cartao: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: cores.borda, padding: 16, gap: 10 },
  cartaoDestaque: { borderColor: '#D4A017', borderWidth: 2 },
  selo: {
    alignSelf: 'flex-start',
    backgroundColor: '#FDF0C4',
    color: '#6B4E16',
    fontSize: 12,
    fontWeight: '800',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },
  rotulo: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: cores.apagado },
  secao: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: cores.apagado, marginTop: 6 },
  ofertaNome: { fontSize: 20, fontWeight: '800', color: cores.tinta },
  preco: { fontSize: 22, fontWeight: '800', color: cores.tinta },
  texto: { fontSize: 14, lineHeight: 20, color: cores.tinta },
  detalhe: { fontSize: 13, color: cores.apagado },
  bloqueio: { fontSize: 15, lineHeight: 22, color: cores.tinta, backgroundColor: cores.vazio, padding: 14, borderRadius: 14, overflow: 'hidden' },
  entrada: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.fundo,
    paddingHorizontal: 14,
    fontSize: 18,
    color: cores.tinta,
  },
  teste: { fontSize: 13, color: '#6B4E16', backgroundColor: '#FDF0C4', padding: 10, borderRadius: 10, overflow: 'hidden' },
  sucesso: { backgroundColor: '#D1FADF', borderRadius: 14, padding: 14, gap: 10 },
  sucessoTexto: { color: '#05603A', fontWeight: '700', fontSize: 15 },
  erro: { backgroundColor: '#FEF3F2', color: cores.erro, fontWeight: '600', padding: 12, borderRadius: 12, overflow: 'hidden' },
  rodape: { fontSize: 12, color: cores.apagado, textAlign: 'center', lineHeight: 18 },
});
