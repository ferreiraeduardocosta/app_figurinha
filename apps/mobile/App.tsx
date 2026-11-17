import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Botao } from './src/componentes/Botao';
import { JogoProvider, useJogo } from './src/jogo';
import { AbrirPacote } from './src/telas/AbrirPacote';
import { Album } from './src/telas/Album';
import { Entrar } from './src/telas/Entrar';
import { Inicio } from './src/telas/Inicio';
import { Probabilidades } from './src/telas/Probabilidades';
import { cores } from './src/tema';

export default function App() {
  return (
    <SafeAreaProvider>
      <JogoProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: cores.fundo }}>
          <StatusBar style="dark" />
          <Raiz />
        </SafeAreaView>
      </JogoProvider>
    </SafeAreaProvider>
  );
}

type Aba = 'inicio' | 'album';
type Sobreposta = null | 'diario' | 'bonus' | 'probabilidades';

function Raiz() {
  const { carregando, erroInicial, sessao, perfil, tentarDeNovo } = useJogo();
  const [aba, setAba] = useState<Aba>('inicio');
  const [sobreposta, setSobreposta] = useState<Sobreposta>(null);
  const [secaoAlbum, setSecaoAlbum] = useState<string | undefined>(undefined);

  if (carregando) {
    return <ActivityIndicator color={cores.destaque} style={{ flex: 1 }} accessibilityLabel="Carregando" />;
  }
  if (erroInicial) {
    return (
      <View style={estilos.erro}>
        <Text style={estilos.erroTitulo}>Sem conexão com o servidor</Text>
        <Text style={estilos.erroTexto}>{erroInicial}</Text>
        <Botao titulo="Tentar de novo" onPress={tentarDeNovo} />
      </View>
    );
  }
  if (!sessao) return <Entrar />;
  if (!perfil) return <ActivityIndicator color={cores.destaque} style={{ flex: 1 }} />;

  if (sobreposta === 'diario' || sobreposta === 'bonus') {
    return (
      <AbrirPacote
        origem={sobreposta}
        aoFechar={() => setSobreposta(null)}
        aoVerAlbum={(secao) => {
          setSecaoAlbum(secao);
          setSobreposta(null);
          setAba('album');
        }}
      />
    );
  }
  if (sobreposta === 'probabilidades') return <Probabilidades aoVoltar={() => setSobreposta(null)} />;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {aba === 'inicio' ? (
          <Inicio aoAbrirPacote={(origem) => setSobreposta(origem)} aoVerProbabilidades={() => setSobreposta('probabilidades')} />
        ) : (
          <Album key={secaoAlbum} secaoInicial={secaoAlbum} />
        )}
      </View>
      <View style={estilos.abas} accessibilityRole="tablist">
        <BotaoAba rotulo="Início" ativa={aba === 'inicio'} onPress={() => setAba('inicio')} icone="M4 11 L12 4 L20 11 V20 H14 V14 H10 V20 H4 Z" />
        <BotaoAba
          rotulo="Álbum"
          ativa={aba === 'album'}
          onPress={() => setAba('album')}
          icone="M4 5 C7 4 10 4 12 6 C14 4 17 4 20 5 V19 C17 18 14 18 12 20 C10 18 7 18 4 19 Z M12 6 V20"
        />
      </View>
    </View>
  );
}

function BotaoAba({ rotulo, ativa, onPress, icone }: { rotulo: string; ativa: boolean; onPress: () => void; icone: string }) {
  const cor = ativa ? cores.destaque : cores.apagado;
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: ativa }} onPress={onPress} style={estilos.aba}>
      <Svg width={24} height={24} viewBox="0 0 24 24">
        <Path d={icone} fill="none" stroke={cor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <Text style={{ color: cor, fontSize: 12, fontWeight: ativa ? '700' : '600' }}>{rotulo}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  erro: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  erroTitulo: { fontSize: 22, fontWeight: '800', color: cores.tinta },
  erroTexto: { fontSize: 15, color: cores.apagado, marginBottom: 8 },
  abas: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: cores.borda, backgroundColor: '#FFFFFF' },
  aba: { flex: 1, minHeight: 60, alignItems: 'center', justifyContent: 'center', gap: 3 },
});
