import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ErroApi, FigurinhaSorteada, OrigemPacote, RecompensaNova } from '../api';
import { Botao } from '../componentes/Botao';
import { Figurinha } from '../componentes/Figurinha';
import { AvisoRecompensas } from '../componentes/Recompensas';
import { useJogo } from '../jogo';
import { cores, estiloRaridade } from '../tema';

type Etapa = 'fechado' | 'abrindo' | 'revelando' | 'resumo';

export function AbrirPacote({
  origem,
  aoFechar,
  aoVerAlbum,
}: {
  origem: OrigemPacote;
  aoFechar: () => void;
  aoVerAlbum: (secao?: string) => void;
}) {
  const { abrirPacote, porCodigo, clubes, emAlta } = useJogo();
  const { width } = useWindowDimensions();
  const [etapa, setEtapa] = useState<Etapa>('fechado');
  const [sorteadas, setSorteadas] = useState<FigurinhaSorteada[]>([]);
  const [recompensas, setRecompensas] = useState<RecompensaNova[]>([]);
  const [indice, setIndice] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  const tremor = useRef(new Animated.Value(0)).current;
  const giro = useRef(new Animated.Value(0)).current;

  const abrir = async () => {
    setErro(null);
    setEtapa('abrindo');
    const animacao = Animated.loop(
      Animated.sequence([
        Animated.timing(tremor, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(tremor, { toValue: -1, duration: 120, useNativeDriver: true }),
        Animated.timing(tremor, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]),
    );
    animacao.start();
    try {
      // O sorteio é feito no servidor; a animação dura pelo menos 900 ms para dar suspense.
      const [resultado] = await Promise.all([abrirPacote(origem), new Promise((r) => setTimeout(r, 900))]);
      setSorteadas(resultado.figurinhas);
      setRecompensas(resultado.recompensas);
      setIndice(0);
      setEtapa('revelando');
    } catch (e) {
      setErro(e instanceof ErroApi || e instanceof Error ? e.message : 'Não foi possível abrir o pacote.');
      setEtapa('fechado');
    } finally {
      animacao.stop();
      tremor.setValue(0);
    }
  };

  // Cada figurinha entra virando, como uma carta.
  useEffect(() => {
    if (etapa !== 'revelando') return;
    giro.setValue(0);
    Animated.timing(giro, { toValue: 1, duration: 450, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }).start();
  }, [etapa, indice, giro]);

  const proxima = () => {
    if (indice + 1 < sorteadas.length) setIndice(indice + 1);
    else setEtapa('resumo');
  };

  const larguraCarta = Math.min(300, width - 64);

  if (etapa === 'fechado' || etapa === 'abrindo') {
    return (
      <View style={estilos.tela}>
        <BotaoFechar aoFechar={aoFechar} />
        <View style={estilos.centro}>
          <Animated.View
            style={[
              estilos.pacote,
              {
                transform: [
                  { translateX: tremor.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) },
                  { rotate: tremor.interpolate({ inputRange: [-1, 1], outputRange: ['-3deg', '3deg'] }) },
                ],
              },
            ]}
            accessible
            accessibilityLabel="Pacote Craques da Várzea fechado, 5 figurinhas"
          >
            <Svg width={96} height={96} viewBox="0 0 24 24">
              <Path d="M4 8 L12 4 L20 8 V17 L12 21 L4 17 Z" fill="none" stroke="#FBBF24" strokeWidth={1.4} strokeLinejoin="round" />
              <Path d="M4 8 L12 12 L20 8 M12 12 V21" fill="none" stroke="#FBBF24" strokeWidth={1.4} strokeLinejoin="round" />
            </Svg>
            <Text style={estilos.pacoteTitulo}>Craques da Várzea</Text>
            <Text style={estilos.pacoteSub}>{{ diario: 'Pacote grátis do dia', bonus: 'Pacote de recompensa', comprado: 'Pacote comprado', moedas: 'Pago com moedas' }[origem]} · 5 figurinhas</Text>
          </Animated.View>
          {erro && (
            <Text style={estilos.erro} accessibilityRole="alert">
              {erro}
            </Text>
          )}
        </View>
        <View style={estilos.rodape}>
          <Botao titulo={etapa === 'abrindo' ? 'Abrindo…' : 'Abrir pacote'} onPress={abrir} carregando={etapa === 'abrindo'} />
        </View>
      </View>
    );
  }

  if (etapa === 'revelando') {
    const s = sorteadas[indice];
    const f = porCodigo[s.codigo];
    const clube = clubes[f.clubeSigla];
    return (
      <Pressable style={estilos.tela} onPress={proxima} accessibilityRole="button" accessibilityLabel="Ver a próxima figurinha">
        <Text style={estilos.contador}>
          {indice + 1} de {sorteadas.length}
        </Text>
        <View style={estilos.centro}>
          <View style={estilos.selos}>
            {s.nova && <Selo texto="Nova!" cor={cores.destaque} />}
            {s.garantida && <Selo texto="Garantida" cor="#7C3AED" />}
            {!s.nova && <Selo texto="Repetida" cor="#5B6070" />}
          </View>
          <Animated.View
            accessibilityLiveRegion="polite"
            style={{
              transform: [
                { perspective: 900 },
                { rotateY: giro.interpolate({ inputRange: [0, 1], outputRange: ['90deg', '0deg'] }) },
                { scale: giro.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
              ],
            }}
          >
            <Figurinha figurinha={f} clube={clube} largura={larguraCarta} brilhante={s.brilhante} emAlta={s.codigo === emAlta} />
          </Animated.View>
          <Text style={estilos.raridade}>{estiloRaridade[s.raridade].nome}</Text>
        </View>
        <Text style={estilos.dica}>{indice + 1 < sorteadas.length ? 'Toque para a próxima' : 'Toque para ver o resumo'}</Text>
      </Pressable>
    );
  }

  const novas = sorteadas.filter((s) => s.nova).length;
  const larguraMini = (width - 16 * 2 - 12 * 2) / 3;
  return (
    <View style={estilos.tela}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Text style={estilos.resumoTitulo}>Pacote aberto!</Text>
        <AvisoRecompensas recompensas={recompensas} />
        <Text style={estilos.resumoSub}>
          {novas === 0 ? 'Nenhuma figurinha nova desta vez.' : `${novas} ${novas === 1 ? 'figurinha nova' : 'figurinhas novas'} para o álbum.`}
        </Text>
        <View style={estilos.grade}>
          {sorteadas.map((s, i) => (
            <View key={i} style={{ gap: 4 }}>
              <Figurinha figurinha={porCodigo[s.codigo]} clube={clubes[porCodigo[s.codigo].clubeSigla]} largura={larguraMini} brilhante={s.brilhante} />
              <Text style={[estilos.miniRotulo, { color: s.nova ? cores.destaque : cores.apagado }]}>{s.nova ? 'Nova' : 'Repetida'}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={[estilos.rodape, { gap: 10 }]}>
        <Botao
          titulo="Ver no álbum"
          onPress={() => aoVerAlbum(porCodigo[(sorteadas.find((s) => s.nova) ?? sorteadas[0]).codigo]?.secao)}
        />
        <Botao titulo="Fechar" onPress={aoFechar} variante="secundario" />
      </View>
    </View>
  );
}

function Selo({ texto, cor }: { texto: string; cor: string }) {
  return (
    <View style={{ backgroundColor: cor, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }}>{texto}</Text>
    </View>
  );
}

function BotaoFechar({ aoFechar }: { aoFechar: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={aoFechar} style={estilos.fechar}>
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Path d="M6 6 L18 18 M18 6 L6 18" stroke={cores.tinta} strokeWidth={2.2} strokeLinecap="round" />
      </Svg>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 16 },
  pacote: {
    width: 220,
    height: 300,
    borderRadius: 22,
    backgroundColor: cores.tinta,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 3,
    borderColor: '#FBBF24',
  },
  pacoteTitulo: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
    textTransform: 'uppercase',
    textAlign: 'center',
    paddingHorizontal: 18,
  },
  pacoteSub: { color: '#D1D5DB', fontSize: 13, textAlign: 'center', paddingHorizontal: 12 },
  rodape: { padding: 16, paddingBottom: 24 },
  erro: { color: cores.erro, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  contador: { textAlign: 'center', marginTop: 16, fontSize: 14, fontWeight: '700', color: cores.apagado },
  selos: { flexDirection: 'row', gap: 8, minHeight: 28 },
  raridade: { fontSize: 15, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: cores.tinta },
  dica: { textAlign: 'center', paddingBottom: 32, fontSize: 14, color: cores.apagado },
  resumoTitulo: { fontSize: 32, fontWeight: '800', color: cores.tinta, textTransform: 'uppercase', marginTop: 16 },
  resumoSub: { fontSize: 15, color: cores.apagado },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  miniRotulo: { fontSize: 12, fontWeight: '700', textAlign: 'center', textTransform: 'uppercase' },
  fechar: { position: 'absolute', top: 8, right: 8, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
});
