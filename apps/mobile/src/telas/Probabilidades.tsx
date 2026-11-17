import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { api, Probabilidades as Dados } from '../api';
import { useJogo } from '../jogo';
import { cores, estiloRaridade, Raridade } from '../tema';

const pct = (x: number) => `${(x * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

/** Probabilidades do pacote: exigência das lojas antes de qualquer compra. */
export function Probabilidades({ aoVoltar }: { aoVoltar: () => void }) {
  const { figurinhas } = useJogo();
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api.probabilidades().then(setDados, (e: Error) => setErro(e.message));
  }, []);

  const qtd = (r: Raridade) => figurinhas.filter((f) => f.raridade === r).length;

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <View style={estilos.barra}>
        <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={aoVoltar} style={estilos.voltar}>
          <Svg width={22} height={22} viewBox="0 0 24 24">
            <Path d="M15 5 L8 12 L15 19" fill="none" stroke={cores.tinta} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={estilos.titulo}>Probabilidades</Text>
      </View>
      {!dados ? (
        erro ? <Text style={{ padding: 16, color: cores.erro }}>{erro}</Text> : <ActivityIndicator style={{ marginTop: 32 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          <View style={estilos.tabela}>
            <View style={[estilos.linha, { backgroundColor: cores.vazio }]}>
              <Text style={[estilos.cab, { flex: 1.5 }]}>Raridade</Text>
              <Text style={[estilos.cab, estilos.dir]}>Por figurinha</Text>
              <Text style={[estilos.cab, estilos.dir]}>≥1 no pacote</Text>
            </View>
            {(Object.keys(estiloRaridade) as Raridade[]).map((r) => {
              const p = dados.porFigurinha[r];
              const peloMenosUma = 1 - (1 - p) ** dados.figurinhasPorPacote;
              return (
                <View key={r} style={[estilos.linha, { borderTopWidth: 1, borderTopColor: '#EFEBE3' }]}>
                  <View style={{ flex: 1.5 }}>
                    <Text style={estilos.nome}>{estiloRaridade[r].nome}</Text>
                    <Text style={estilos.sub}>{qtd(r)} no álbum</Text>
                  </View>
                  <Text style={[estilos.valor, estilos.dir]}>{pct(p)}</Text>
                  <Text style={[estilos.sub, estilos.dir, { fontSize: 14, fontWeight: '600' }]}>{pct(peloMenosUma)}</Text>
                </View>
              );
            })}
          </View>
          <Text style={estilos.secao}>Garantia mínima</Text>
          <Text style={estilos.texto}>
            Uma Épica a cada {dados.garantia.epicaACadaPacotes} pacotes e uma Lendária a cada {dados.garantia.lendariaACadaPacotes} pacotes, se
            não vierem antes pelo sorteio.
          </Text>
          <Text style={estilos.secao}>Outras regras</Text>
          <Text style={estilos.texto}>
            Brilhante: {pct(dados.brilhante)} de chance por figurinha. É uma versão holográfica e não muda a raridade.
          </Text>
          <Text style={estilos.texto}>
            Balcão: {dados.balcao.repetidasPorNova} repetidas da mesma raridade valem 1 figurinha que falta, à sua escolha.
          </Text>
          <Text style={estilos.texto}>Dentro de cada raridade, todas as figurinhas têm a mesma chance.</Text>
          <Text style={estilos.texto}>Cada pacote traz {dados.figurinhasPorPacote} figurinhas. O sorteio é feito no servidor.</Text>
        </ScrollView>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 6 },
  voltar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 22, fontWeight: '800', color: cores.tinta, textTransform: 'uppercase' },
  tabela: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: cores.borda, overflow: 'hidden' },
  linha: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  cab: { flex: 1, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: '#3F4453' },
  dir: { flex: 1, textAlign: 'right' },
  nome: { fontSize: 15, fontWeight: '700', color: cores.tinta },
  sub: { fontSize: 12, color: cores.apagado },
  valor: { fontSize: 22, fontWeight: '700', color: cores.tinta },
  secao: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: cores.apagado },
  texto: { fontSize: 15, lineHeight: 22, color: cores.tinta },
});
