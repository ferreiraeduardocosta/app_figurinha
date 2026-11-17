import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const cores = {
  fundo: '#F4F1EA',
  tinta: '#161A26',
  apagado: '#5B6070',
  borda: '#E3DED3',
  destaque: '#0B7A75',
};

interface Clube {
  sigla: string;
  nome: string;
  cidade: string;
  corPrimaria: string;
  corSecundaria: string;
  mascote: string;
  lema: string;
}

type Estado = { tipo: 'carregando' } | { tipo: 'erro'; mensagem: string } | { tipo: 'ok'; clubes: Clube[] };

export default function App() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });

  const carregar = useCallback(async () => {
    setEstado({ tipo: 'carregando' });
    try {
      const resposta = await fetch(`${API_URL}/clubes`);
      if (!resposta.ok) throw new Error(`A API respondeu ${resposta.status}.`);
      setEstado({ tipo: 'ok', clubes: await resposta.json() });
    } catch (e) {
      setEstado({ tipo: 'erro', mensagem: e instanceof Error ? e.message : 'Erro desconhecido.' });
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <SafeAreaView style={estilos.tela}>
      <StatusBar style="dark" />
      <Text style={estilos.sobretitulo}>Liga Aurora · Temporada 1</Text>
      <Text style={estilos.titulo}>Os 8 clubes</Text>

      {estado.tipo === 'carregando' && <ActivityIndicator color={cores.destaque} style={{ marginTop: 32 }} />}

      {estado.tipo === 'erro' && (
        <View style={estilos.erro}>
          <Text style={estilos.erroTexto}>Não foi possível falar com a API em {API_URL}.</Text>
          <Text style={estilos.apagado}>{estado.mensagem}</Text>
          <Pressable accessibilityRole="button" onPress={carregar} style={estilos.botao}>
            <Text style={estilos.botaoTexto}>Tentar de novo</Text>
          </Pressable>
        </View>
      )}

      {estado.tipo === 'ok' && (
        <FlatList
          data={estado.clubes}
          keyExtractor={(c) => c.sigla}
          contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <View style={estilos.cartao}>
              <View style={[estilos.faixa, { backgroundColor: item.corPrimaria }]}>
                <View style={[estilos.faixaMetade, { backgroundColor: item.corSecundaria }]} />
              </View>
              <View style={{ padding: 14, gap: 4 }}>
                <Text style={estilos.nomeClube}>{item.nome}</Text>
                <Text style={estilos.apagado}>
                  {item.cidade} · {item.sigla} · {item.mascote}
                </Text>
                <Text style={estilos.lema}>“{item.lema}”</Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo, paddingHorizontal: 16 },
  sobretitulo: {
    marginTop: 16,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: cores.destaque,
  },
  titulo: { fontSize: 34, fontWeight: '800', color: cores.tinta, textTransform: 'uppercase', marginBottom: 16 },
  cartao: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 14,
    overflow: 'hidden',
  },
  faixa: { height: 8, flexDirection: 'row', justifyContent: 'flex-end' },
  faixaMetade: { width: '50%' },
  nomeClube: { fontSize: 20, fontWeight: '800', color: cores.tinta, textTransform: 'uppercase' },
  apagado: { fontSize: 13, color: cores.apagado },
  lema: { fontSize: 14, fontStyle: 'italic', color: cores.tinta, marginTop: 4 },
  erro: { marginTop: 24, gap: 8 },
  erroTexto: { fontSize: 15, fontWeight: '600', color: cores.tinta },
  botao: {
    marginTop: 8,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: cores.destaque,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoTexto: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
