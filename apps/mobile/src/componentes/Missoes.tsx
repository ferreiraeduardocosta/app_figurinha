import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { api, ErroApi, MissoesDoDia } from '../api';
import { useJogo } from '../jogo';
import { cores } from '../tema';

function faltam(ate: string) {
  const ms = Math.max(0, new Date(ate).getTime() - Date.now());
  return `${Math.floor(ms / 3_600_000)}h ${String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, '0')}min`;
}

/** Cartão das missões do dia: progresso de cada uma e botão de resgatar moedas. */
export function Missoes() {
  const { sessao, perfil, recarregar } = useJogo();
  const [dados, setDados] = useState<MissoesDoDia | null>(null);
  const [resgatando, setResgatando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const token = sessao?.token ?? '';

  const carregar = useCallback(async () => {
    try {
      setDados(await api.missoes(token));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar as missões.');
    }
  }, [token]);

  // Recarrega sempre que o perfil muda (abriu pacote, trocou, etc.).
  useEffect(() => {
    carregar();
  }, [carregar, perfil]);

  const resgatar = async (id: string) => {
    setErro(null);
    setResgatando(id);
    try {
      const r = await api.resgatarMissao(token, id);
      setAviso(`+${r.ganhou} moedas!`);
      await recarregar();
    } catch (e) {
      setErro(e instanceof ErroApi || e instanceof Error ? e.message : 'Não foi possível resgatar.');
    } finally {
      setResgatando(null);
    }
  };

  if (!dados) {
    return (
      <View style={estilos.cartao}>
        <Text style={estilos.rotulo}>Missões do dia</Text>
        {erro ? <Text style={estilos.erro}>{erro}</Text> : <ActivityIndicator color={cores.destaque} />}
      </View>
    );
  }

  const feitas = dados.missoes.filter((m) => m.resgatada).length;
  return (
    <View style={estilos.cartao}>
      <View style={estilos.topo}>
        <Text style={estilos.rotulo}>Missões do dia</Text>
        <Text style={estilos.renova}>
          {feitas}/{dados.missoes.length} · renovam em {faltam(dados.renovaEm)}
        </Text>
      </View>
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
      {dados.missoes.map((m) => {
        const pct = Math.min(1, m.progresso / m.meta);
        return (
          <View key={m.id} style={estilos.missao}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={[estilos.titulo, m.resgatada && estilos.feita]}>{m.titulo}</Text>
              <View
                style={estilos.barra}
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel={m.titulo}
                accessibilityValue={{ min: 0, max: m.meta, now: m.progresso }}
              >
                <View style={[estilos.barraCheia, { width: `${Math.round(pct * 100)}%` }, m.resgatada && { backgroundColor: '#9CA3AF' }]} />
              </View>
              <Text style={estilos.progresso}>
                {m.progresso}/{m.meta}
              </Text>
            </View>
            {m.resgatada ? (
              <View style={estilos.ok} accessible accessibilityLabel="Resgatada">
                <Svg width={20} height={20} viewBox="0 0 24 24">
                  <Path d="M5 12 L10 17 L19 7" fill="none" stroke={cores.destaque} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={m.concluida ? `Resgatar ${m.recompensa} moedas` : `${m.recompensa} moedas ao concluir`}
                accessibilityState={{ disabled: !m.concluida, busy: resgatando === m.id }}
                disabled={!m.concluida || resgatando !== null}
                onPress={() => resgatar(m.id)}
                style={[estilos.premio, m.concluida && estilos.premioPronto]}
              >
                {resgatando === m.id ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={[estilos.premioTexto, m.concluida && { color: '#FFFFFF' }]}>
                    {m.concluida ? `Resgatar +${m.recompensa}` : `+${m.recompensa}`}
                  </Text>
                )}
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: cores.borda, borderRadius: 16, padding: 16, gap: 12 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rotulo: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: cores.apagado },
  renova: { fontSize: 12, color: cores.apagado },
  missao: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titulo: { fontSize: 15, fontWeight: '600', color: cores.tinta },
  feita: { color: cores.apagado, textDecorationLine: 'line-through' },
  barra: { height: 8, borderRadius: 4, backgroundColor: cores.vazio, overflow: 'hidden' },
  barraCheia: { height: '100%', borderRadius: 4, backgroundColor: cores.destaque },
  progresso: { fontSize: 12, color: cores.apagado },
  premio: {
    minWidth: 76,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D4A017',
    backgroundColor: '#FFF7D6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  premioPronto: { backgroundColor: cores.destaque, borderColor: cores.destaque },
  premioTexto: { fontSize: 14, fontWeight: '800', color: '#6B4E16' },
  ok: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  aviso: { backgroundColor: '#FFF7D6', color: '#6B4E16', fontWeight: '800', padding: 10, borderRadius: 10, overflow: 'hidden', textAlign: 'center' },
  erro: { color: cores.erro, fontWeight: '600' },
});
