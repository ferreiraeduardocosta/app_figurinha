import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { OrigemPacote } from '../api';
import { Botao } from '../componentes/Botao';
import { Missoes } from '../componentes/Missoes';
import { Trofeu } from '../componentes/Recompensas';
import { useJogo } from '../jogo';
import { cores } from '../tema';

function contagem(ate: string | null): string {
  if (!ate) return '';
  const ms = Math.max(0, new Date(ate).getTime() - Date.now());
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${String(m).padStart(2, '0')}min`;
}

export function Inicio({
  aoAbrirPacote,
  aoVerProbabilidades,
}: {
  aoAbrirPacote: (origem: OrigemPacote) => void;
  aoVerProbabilidades: () => void;
}) {
  const { perfil, recarregar, sair } = useJogo();
  const [atualizando, setAtualizando] = useState(false);
  const [, setRelogio] = useState(0);

  // Atualiza a contagem regressiva a cada 30 s.
  useEffect(() => {
    const id = setInterval(() => setRelogio((x) => x + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!perfil) return null;
  const { coladas, total } = perfil.album;
  const pct = total ? coladas / total : 0;
  const campeao = perfil.recompensas.some((r) => r.tipo === 'ALBUM');
  const paginas = perfil.recompensas.filter((r) => r.tipo === 'PAGINA').length;

  return (
    <ScrollView
      contentContainerStyle={estilos.conteudo}
      refreshControl={
        <RefreshControl
          refreshing={atualizando}
          onRefresh={async () => {
            setAtualizando(true);
            await recarregar().catch(() => undefined);
            setAtualizando(false);
          }}
        />
      }
    >
      <View style={estilos.cabecalho}>
        <View style={{ flex: 1 }}>
          <Text style={estilos.ola}>Olá,</Text>
          <Text style={estilos.apelido} numberOfLines={1}>
            {perfil.apelido}
          </Text>
        </View>
        <View style={estilos.moedas} accessible accessibilityLabel={`${perfil.moedas} moedas`}>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path d="M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18Z" fill="#D4A017" />
            <Path d="M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10Z" fill="none" stroke="#FFF7D6" strokeWidth={2} />
          </Svg>
          <Text style={estilos.moedasTexto}>{perfil.moedas.toLocaleString('pt-BR')}</Text>
        </View>
      </View>

      <View style={estilos.cartao}>
        <Text style={estilos.rotulo}>Meu álbum</Text>
        <Text style={estilos.numeroGrande}>
          {coladas} <Text style={estilos.deTotal}>de {total}</Text>
        </Text>
        <View
          style={estilos.barra}
          accessible
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: total, now: coladas }}
        >
          <View style={[estilos.barraCheia, { width: `${Math.round(pct * 100)}%` }]} />
        </View>
        <Text style={estilos.paginas}>{paginas} de 10 páginas completas · cada página completa vale 1 pacote</Text>
      </View>

      <View style={[estilos.cartao, { backgroundColor: cores.tinta, borderColor: cores.tinta }]}>
        <Text style={[estilos.rotulo, { color: '#D1D5DB' }]}>Pacote grátis do dia</Text>
        <Text style={[estilos.pacoteTitulo]}>Pacote Liga Aurora</Text>
        <Text style={{ color: '#D1D5DB', fontSize: 14, marginBottom: 14 }}>5 figurinhas</Text>
        {perfil.pacoteDiario.disponivel ? (
          <Botao titulo="Abrir pacote" onPress={() => aoAbrirPacote('diario')} />
        ) : (
          <View style={estilos.espera}>
            <Text style={estilos.esperaTexto}>Próximo pacote grátis em {contagem(perfil.pacoteDiario.proximoEm)}</Text>
          </View>
        )}
      </View>

      <Missoes />

      {perfil.pacotesComprados > 0 && (
        <View style={estilos.cartao}>
          <Text style={estilos.rotulo}>Pacotes comprados</Text>
          <Text style={estilos.bonusTexto}>
            Você tem {perfil.pacotesComprados} {perfil.pacotesComprados === 1 ? 'pacote' : 'pacotes'} para abrir.
          </Text>
          <Botao titulo="Abrir pacote comprado" onPress={() => aoAbrirPacote('comprado')} />
        </View>
      )}

      {perfil.pacotesBonus > 0 && (
        <View style={[estilos.cartao, { borderColor: '#FBBF24', borderWidth: 2 }]}>
          <Text style={estilos.rotulo}>Pacotes de recompensa</Text>
          <Text style={estilos.bonusTexto}>
            Você tem {perfil.pacotesBonus} {perfil.pacotesBonus === 1 ? 'pacote' : 'pacotes'} por completar páginas do álbum.
          </Text>
          <Botao titulo="Abrir pacote de recompensa" onPress={() => aoAbrirPacote('bonus')} />
        </View>
      )}

      {campeao && (
        <View style={[estilos.cartao, estilos.trofeu]}>
          <Trofeu tamanho={88} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[estilos.rotulo, { color: '#FBBF24' }]}>Exclusivo</Text>
            <Text style={estilos.trofeuTitulo}>Troféu Liga Aurora</Text>
            <Text style={{ color: '#D1D5DB', fontSize: 14 }}>Álbum da Temporada 1 completo.</Text>
          </View>
        </View>
      )}

      <View style={estilos.cartao}>
        <Text style={estilos.rotulo}>Garantia mínima</Text>
        <Linha texto="Épica garantida em" valor={perfil.garantia.pacotesParaEpica} />
        <Linha texto="Lendária garantida em" valor={perfil.garantia.pacotesParaLendaria} />
        <Pressable accessibilityRole="link" onPress={aoVerProbabilidades} style={estilos.link}>
          <Text style={estilos.linkTexto}>Ver probabilidades do pacote</Text>
        </Pressable>
      </View>

      <Pressable accessibilityRole="button" onPress={sair} style={estilos.link}>
        <Text style={[estilos.linkTexto, { color: cores.apagado }]}>Sair da conta</Text>
      </Pressable>
    </ScrollView>
  );
}

function Linha({ texto, valor }: { texto: string; valor: number }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={{ fontSize: 15, color: cores.tinta }}>{texto}</Text>
      <Text style={{ fontSize: 15, fontWeight: '700', color: cores.tinta }}>
        {valor} {valor === 1 ? 'pacote' : 'pacotes'}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: 16, gap: 14 },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  ola: { fontSize: 14, color: cores.apagado },
  apelido: { fontSize: 28, fontWeight: '800', color: cores.tinta },
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
  cartao: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: cores.borda, borderRadius: 16, padding: 16, gap: 4 },
  rotulo: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: cores.apagado },
  numeroGrande: { fontSize: 40, fontWeight: '800', color: cores.tinta },
  deTotal: { fontSize: 18, fontWeight: '600', color: cores.apagado },
  barra: { height: 10, borderRadius: 5, backgroundColor: cores.vazio, overflow: 'hidden', marginTop: 4 },
  barraCheia: { height: '100%', borderRadius: 5, backgroundColor: cores.destaque },
  pacoteTitulo: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', textTransform: 'uppercase' },
  espera: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: '#3F4453', alignItems: 'center', justifyContent: 'center', padding: 12 },
  esperaTexto: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  paginas: { fontSize: 13, color: cores.apagado, marginTop: 6 },
  bonusTexto: { fontSize: 15, color: cores.tinta, marginBottom: 10 },
  trofeu: { backgroundColor: '#17122E', borderColor: '#FBBF24', flexDirection: 'row', alignItems: 'center', gap: 14 },
  trofeuTitulo: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', textTransform: 'uppercase' },
  link: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  linkTexto: { fontSize: 15, fontWeight: '700', color: cores.destaque },
});
