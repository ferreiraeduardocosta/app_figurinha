import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, PainelLiga, PartidaLiga } from '../api';
import { Escudo } from '../componentes/Escudo';
import { Figurinha } from '../componentes/Figurinha';
import { useJogo } from '../jogo';
import { cores } from '../tema';

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Liga Aurora: craque da rodada, resultados, próxima rodada, tabela e artilharia. */
export function Liga() {
  const { porCodigo, clubes, album } = useJogo();
  const [liga, setLiga] = useState<PainelLiga | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setLiga(await api.liga());
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar a liga.');
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (!liga) {
    return erro ? <Text style={[estilos.erro, { margin: 16 }]}>{erro}</Text> : <ActivityIndicator color={cores.destaque} style={{ flex: 1 }} />;
  }

  const craque = liga.emAlta ? porCodigo[liga.emAlta.codigo] : null;
  const tenhoCraque = !!craque && !!album?.itens.some((i) => i.codigo === craque.codigo);

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 16 }}
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
      <View style={{ gap: 2, marginTop: 8 }}>
        <Text style={estilos.sobretitulo}>Temporada {liga.temporada}</Text>
        <Text style={estilos.titulo}>Liga Aurora</Text>
        <Text style={estilos.legenda}>
          {liga.ultimaRodada === 0 ? 'A liga ainda não começou.' : `Rodada ${liga.ultimaRodada} de ${liga.totalRodadas} disputada.`}
          {liga.proximaRodada ? ` Próxima: ${dataHora(liga.proximaRodada.data)}.` : ' Temporada encerrada.'}
        </Text>
      </View>

      {liga.emAlta && craque && (
        <View style={estilos.craque}>
          <Figurinha figurinha={craque} clube={clubes[craque.clubeSigla]} largura={120} emAlta />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={estilos.craqueRotulo}>Craque da rodada {liga.emAlta.rodada}</Text>
            <Text style={estilos.craqueNome}>{liga.emAlta.nome}</Text>
            <Text style={estilos.craqueTexto}>
              {liga.emAlta.gols} {liga.emAlta.gols === 1 ? 'gol' : 'gols'} na rodada. A figurinha fica "Em alta" até a próxima.
            </Text>
            <Text style={[estilos.craqueTexto, { fontWeight: '700', color: tenhoCraque ? '#7DD3C8' : '#FBBF24' }]}>
              {tenhoCraque ? 'Ela está no seu álbum!' : 'Você ainda não tem essa figurinha.'}
            </Text>
          </View>
        </View>
      )}

      {liga.jogosDaUltima.length > 0 && (
        <View style={estilos.cartao}>
          <Text style={estilos.rotulo}>Resultados da rodada {liga.ultimaRodada}</Text>
          {liga.jogosDaUltima.map((p) => (
            <Jogo key={p.mandante} partida={p} />
          ))}
        </View>
      )}

      {liga.jogosDaProxima.length > 0 && liga.proximaRodada && (
        <View style={estilos.cartao}>
          <Text style={estilos.rotulo}>Rodada {liga.proximaRodada.numero}</Text>
          {liga.jogosDaProxima.map((p) => (
            <Jogo key={p.mandante} partida={p} />
          ))}
        </View>
      )}

      <View style={estilos.cartao}>
        <Text style={estilos.rotulo}>Classificação</Text>
        <View style={[estilos.linhaTabela, estilos.cabecalhoTabela]}>
          <Text style={[estilos.celCab, { width: 24 }]}>#</Text>
          <Text style={[estilos.celCab, { flex: 1 }]}>Clube</Text>
          {['P', 'J', 'V', 'E', 'D', 'SG'].map((c) => (
            <Text key={c} style={[estilos.celCab, estilos.num]}>
              {c}
            </Text>
          ))}
        </View>
        {liga.classificacao.map((l, i) => (
          <View
            key={l.sigla}
            style={[estilos.linhaTabela, i === 0 && liga.ultimaRodada > 0 && { backgroundColor: '#FFF7D6' }]}
            accessible
            accessibilityLabel={`${i + 1}º, ${clubes[l.sigla]?.nome}, ${l.pontos} pontos, ${l.jogos} jogos, saldo ${l.saldo}`}
          >
            <Text style={[estilos.cel, { width: 24, fontWeight: '700' }]}>{i + 1}</Text>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Escudo sigla={l.sigla} tamanho={22} />
              <Text style={[estilos.cel, { fontWeight: '700' }]}>{l.sigla}</Text>
            </View>
            <Text style={[estilos.cel, estilos.num, { fontWeight: '800' }]}>{l.pontos}</Text>
            <Text style={[estilos.cel, estilos.num]}>{l.jogos}</Text>
            <Text style={[estilos.cel, estilos.num]}>{l.vitorias}</Text>
            <Text style={[estilos.cel, estilos.num]}>{l.empates}</Text>
            <Text style={[estilos.cel, estilos.num]}>{l.derrotas}</Text>
            <Text style={[estilos.cel, estilos.num]}>{l.saldo > 0 ? `+${l.saldo}` : l.saldo}</Text>
          </View>
        ))}
      </View>

      {liga.artilharia.length > 0 && (
        <View style={estilos.cartao}>
          <Text style={estilos.rotulo}>Artilharia</Text>
          {liga.artilharia.slice(0, 5).map((a, i) => (
            <View key={a.codigo} style={estilos.artilheiro}>
              <Text style={[estilos.cel, { width: 24, fontWeight: '700' }]}>{i + 1}</Text>
              <Escudo sigla={a.clube} tamanho={22} />
              <Text style={[estilos.cel, { flex: 1 }]}>{a.nome}</Text>
              <Text style={[estilos.cel, { fontWeight: '800' }]}>
                {a.gols} {a.gols === 1 ? 'gol' : 'gols'}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function Jogo({ partida: p }: { partida: PartidaLiga }) {
  const jogado = p.golsMandante !== null;
  const gols = (sigla: string) =>
    p.gols
      .filter((g) => g.sigla === sigla)
      .map((g) => `${g.nome} ${g.minuto}'`)
      .join(', ');
  return (
    <View style={estilos.jogo}>
      <View style={estilos.placar} accessible accessibilityLabel={jogado ? `${p.mandante} ${p.golsMandante} a ${p.golsVisitante} ${p.visitante}` : `${p.mandante} contra ${p.visitante}`}>
        <View style={[estilos.time, { justifyContent: 'flex-end' }]}>
          <Text style={estilos.sigla}>{p.mandante}</Text>
          <Escudo sigla={p.mandante} tamanho={28} />
        </View>
        <Text style={estilos.gols}>{jogado ? `${p.golsMandante} × ${p.golsVisitante}` : '×'}</Text>
        <View style={estilos.time}>
          <Escudo sigla={p.visitante} tamanho={28} />
          <Text style={estilos.sigla}>{p.visitante}</Text>
        </View>
      </View>
      {jogado && p.gols.length > 0 && (
        <Text style={estilos.autores}>
          {[gols(p.mandante), gols(p.visitante)].filter(Boolean).join(' · ')}
        </Text>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  sobretitulo: { fontSize: 12, fontWeight: '600', letterSpacing: 1.5, textTransform: 'uppercase', color: cores.destaque },
  titulo: { fontSize: 30, fontWeight: '800', color: cores.tinta, textTransform: 'uppercase' },
  legenda: { fontSize: 14, color: cores.apagado, lineHeight: 20 },
  craque: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: cores.tinta, borderRadius: 16, padding: 14 },
  craqueRotulo: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', color: '#FB923C' },
  craqueNome: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', textTransform: 'uppercase' },
  craqueTexto: { fontSize: 13, color: '#D1D5DB', lineHeight: 18 },
  cartao: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: cores.borda, padding: 14, gap: 10 },
  rotulo: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: cores.apagado },
  jogo: { gap: 4, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#EFEBE3' },
  placar: { flexDirection: 'row', alignItems: 'center' },
  time: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sigla: { fontSize: 15, fontWeight: '700', color: cores.tinta },
  gols: { width: 72, textAlign: 'center', fontSize: 20, fontWeight: '800', color: cores.tinta },
  autores: { fontSize: 12, color: cores.apagado, textAlign: 'center' },
  linhaTabela: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4, borderRadius: 6 },
  cabecalhoTabela: { borderBottomWidth: 1, borderBottomColor: cores.borda },
  celCab: { fontSize: 11, fontWeight: '700', color: '#3F4453', textTransform: 'uppercase' },
  cel: { fontSize: 14, color: cores.tinta },
  num: { width: 30, textAlign: 'right' },
  artilheiro: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  erro: { color: cores.erro, fontWeight: '600' },
});
