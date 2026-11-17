import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import type { OrigemPacote } from './src/api';
import { Botao } from './src/componentes/Botao';
import { JogoProvider, useJogo } from './src/jogo';
import { AbrirPacote } from './src/telas/AbrirPacote';
import { Album } from './src/telas/Album';
import { Entrar } from './src/telas/Entrar';
import { Inicio } from './src/telas/Inicio';
import { Loja } from './src/telas/Loja';
import { Probabilidades } from './src/telas/Probabilidades';
import { Trocas } from './src/telas/Trocas';
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

type Aba = 'inicio' | 'album' | 'trocas' | 'loja';
type Sobreposta = null | OrigemPacote | 'probabilidades';

function Raiz() {
  const { carregando, erroInicial, sessao, perfil, tentarDeNovo, recarregar } = useJogo();
  const [aba, setAba] = useState<Aba>('inicio');

  // Sem notificações push ainda: atualiza perfil e álbum ao trocar de aba e a cada minuto,
  // para trocas aceitas pelo outro lado e novos pedidos aparecerem.
  useEffect(() => {
    if (sessao) recarregar().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba]);
  useEffect(() => {
    if (!sessao) return;
    const id = setInterval(() => recarregar().catch(() => undefined), 60_000);
    return () => clearInterval(id);
  }, [sessao, recarregar]);
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

  if (sobreposta && sobreposta !== 'probabilidades') {
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
        {aba === 'inicio' && (
          <Inicio aoAbrirPacote={(origem) => setSobreposta(origem)} aoVerProbabilidades={() => setSobreposta('probabilidades')} />
        )}
        {aba === 'album' && <Album key={secaoAlbum} secaoInicial={secaoAlbum} />}
        {aba === 'trocas' && <Trocas />}
        {aba === 'loja' && (
          <Loja aoAbrirPacote={(origem) => setSobreposta(origem)} aoVerProbabilidades={() => setSobreposta('probabilidades')} />
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
        <BotaoAba
          rotulo="Trocas"
          ativa={aba === 'trocas'}
          onPress={() => setAba('trocas')}
          icone="M4 8 H18 L14 4 M20 16 H6 L10 20"
          contador={perfil.pendencias.trocasRecebidas + perfil.pendencias.pedidosAmizade}
        />
        <BotaoAba
          rotulo="Loja"
          ativa={aba === 'loja'}
          onPress={() => setAba('loja')}
          icone="M5 8 H19 L18 20 H6 Z M9 8 V6 C9 4 10.5 3 12 3 C13.5 3 15 4 15 6 V8"
        />
      </View>
    </View>
  );
}

function BotaoAba({
  rotulo,
  ativa,
  onPress,
  icone,
  contador = 0,
}: {
  rotulo: string;
  ativa: boolean;
  onPress: () => void;
  icone: string;
  contador?: number;
}) {
  const cor = ativa ? cores.destaque : cores.apagado;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: ativa }}
      accessibilityLabel={contador > 0 ? `${rotulo}, ${contador} novidades` : rotulo}
      onPress={onPress}
      style={estilos.aba}
    >
      <View>
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Path d={icone} fill="none" stroke={cor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        {contador > 0 && (
          <View style={estilos.contador}>
            <Text style={estilos.contadorTexto}>{contador > 9 ? '9+' : contador}</Text>
          </View>
        )}
      </View>
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
  contador: {
    position: 'absolute',
    top: -6,
    right: -12,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: cores.erro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contadorTexto: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});
