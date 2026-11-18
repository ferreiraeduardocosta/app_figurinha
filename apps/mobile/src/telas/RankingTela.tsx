import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { api, LinhaRanking, Ranking } from '../api';
import { Trofeu } from '../componentes/Recompensas';
import { useJogo } from '../jogo';
import { cores } from '../tema';

const MEDALHA = ['#D4A017', '#9CA3AF', '#B87333'];

/** Ranking de colecionadores: geral (top 50 + você) e entre amigos. */
export function RankingTela({ aoVoltar }: { aoVoltar: () => void }) {
  const { sessao, perfil } = useJogo();
  const [escopo, setEscopo] = useState<'geral' | 'amigos'>('geral');
  const [dados, setDados] = useState<Ranking | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setDados(await api.ranking(sessao?.token ?? '', escopo));
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar o ranking.');
    }
  }, [sessao, escopo]);

  useEffect(() => {
    setDados(null);
    carregar();
  }, [carregar]);

  const foraDoTop = dados?.eu && !dados.lista.some((l) => l.souEu);

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <View style={estilos.barra}>
        <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={aoVoltar} style={estilos.voltar}>
          <Svg width={22} height={22} viewBox="0 0 24 24">
            <Path d="M15 5 L8 12 L15 19" fill="none" stroke={cores.tinta} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={estilos.titulo}>Ranking</Text>
      </View>
      <View style={estilos.abas} accessibilityRole="tablist">
        {(
          [
            ['geral', 'Geral'],
            ['amigos', 'Amigos'],
          ] as const
        ).map(([id, nome]) => (
          <Pressable
            key={id}
            accessibilityRole="tab"
            accessibilityState={{ selected: escopo === id }}
            onPress={() => setEscopo(id)}
            style={[estilos.aba, escopo === id && estilos.abaAtiva]}
          >
            <Text style={[estilos.abaTexto, escopo === id && { color: cores.tinta }]}>{nome}</Text>
          </Pressable>
        ))}
      </View>

      {!dados ? (
        erro ? <Text style={estilos.erro}>{erro}</Text> : <ActivityIndicator color={cores.destaque} style={{ marginTop: 32 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 8 }}
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
          <Text style={estilos.legenda}>
            {dados.participantes} {dados.participantes === 1 ? 'colecionador' : 'colecionadores'}
            {escopo === 'geral' && dados.participantes > 50 ? ' · mostrando os 50 primeiros' : ''}. Mais figurinhas coladas na frente; empate decidido pelas Lendárias
            e por quem chegou antes.
          </Text>
          {dados.lista.length === 0 && (
            <Text style={estilos.vazio}>
              {escopo === 'amigos' ? 'Adicione amigos na aba Trocas para comparar coleções.' : 'Ninguém colou figurinhas ainda.'}
            </Text>
          )}
          {dados.lista.map((l) => (
            <Linha key={`${l.posicao}-${l.apelido}`} l={l} total={perfil?.album.total ?? 136} />
          ))}
          {foraDoTop && dados.eu && (
            <>
              <Text style={estilos.reticencias}>· · ·</Text>
              <Linha l={dados.eu} total={perfil?.album.total ?? 136} />
            </>
          )}
          {!dados.eu && dados.lista.length > 0 && (
            <Text style={estilos.vazio}>Cole sua primeira figurinha para entrar no ranking.</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function Linha({ l, total }: { l: LinhaRanking; total: number }) {
  return (
    <View
      style={[estilos.linha, l.souEu && estilos.linhaEu]}
      accessible
      accessibilityLabel={`${l.posicao}º, ${l.souEu ? 'você, ' : ''}${l.apelido}, ${l.coladas} de ${total} figurinhas, ${l.lendarias} lendárias`}
    >
      <View style={[estilos.posicao, l.posicao <= 3 && { backgroundColor: MEDALHA[l.posicao - 1] }]}>
        <Text style={[estilos.posicaoTexto, l.posicao <= 3 && { color: '#FFFFFF' }]}>{l.posicao}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={estilos.apelido} numberOfLines={1}>
          {l.apelido}
          {l.souEu ? ' (você)' : ''}
        </Text>
        <Text style={estilos.detalhe}>
          {l.lendarias} {l.lendarias === 1 ? 'Lendária' : 'Lendárias'}
        </Text>
      </View>
      {l.campeao && <Trofeu tamanho={30} />}
      <Text style={estilos.coladas}>
        {l.coladas}
        <Text style={estilos.detalhe}>/{total}</Text>
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 6 },
  voltar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 22, fontWeight: '800', color: cores.tinta, textTransform: 'uppercase' },
  abas: { flexDirection: 'row', backgroundColor: cores.vazio, borderRadius: 12, padding: 4, marginHorizontal: 16 },
  aba: { flex: 1, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  abaAtiva: { backgroundColor: '#FFFFFF' },
  abaTexto: { fontSize: 15, fontWeight: '700', color: cores.apagado },
  legenda: { fontSize: 13, color: cores.apagado, lineHeight: 18, marginBottom: 4 },
  vazio: { fontSize: 15, color: cores.apagado, marginTop: 8 },
  reticencias: { textAlign: 'center', color: cores.apagado, fontSize: 18 },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: cores.borda,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  linhaEu: { borderColor: cores.destaque, borderWidth: 2, backgroundColor: '#E6F4F3' },
  posicao: { width: 34, height: 34, borderRadius: 17, backgroundColor: cores.vazio, alignItems: 'center', justifyContent: 'center' },
  posicaoTexto: { fontSize: 15, fontWeight: '800', color: cores.tinta },
  apelido: { fontSize: 16, fontWeight: '700', color: cores.tinta },
  detalhe: { fontSize: 12, color: cores.apagado, fontWeight: '500' },
  coladas: { fontSize: 20, fontWeight: '800', color: cores.tinta },
  erro: { color: cores.erro, fontWeight: '600', margin: 16 },
});
