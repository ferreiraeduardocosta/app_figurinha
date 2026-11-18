import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { RecompensaNova } from '../api';
import { cores } from '../tema';

/** Troféu Craques da Várzea — Temporada 1: a peça exclusiva de quem completa o álbum. */
export function Trofeu({ tamanho = 96 }: { tamanho?: number }) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 100 100" accessibilityLabel="Troféu Craques da Várzea">
      <Circle cx="50" cy="50" r="48" fill="#17122E" />
      <Path d="M30 22 H70 V40 C70 54 61 63 50 63 C39 63 30 54 30 40 Z" fill="#FBBF24" />
      <Path d="M30 27 H20 C20 40 26 46 32 47 M70 27 H80 C80 40 74 46 68 47" fill="none" stroke="#FBBF24" strokeWidth={4} strokeLinecap="round" />
      <Rect x="45" y="62" width="10" height="10" fill="#D4A017" />
      <Rect x="34" y="72" width="32" height="8" rx="2" fill="#D4A017" />
      <Path d="M50 30 L53 38 L61 38 L55 43 L57 51 L50 46 L43 51 L45 43 L39 38 L47 38 Z" fill="#FFF7D6" />
      <Path d="M20 84 Q50 74 80 84" fill="none" stroke="#22D3EE" strokeWidth={2} opacity={0.8} />
    </Svg>
  );
}

/** Texto curto de uma recompensa recém-ganha. */
export function descreverRecompensa(r: RecompensaNova): string {
  if (r.tipo === 'ALBUM') return 'Álbum completo! Você ganhou o Troféu Craques da Várzea.';
  return `Página completa: ${r.chave}! +${r.pacotes} ${r.pacotes === 1 ? 'pacote' : 'pacotes'} de recompensa.`;
}

/** Faixa de comemoração com as recompensas ganhas agora. */
export function AvisoRecompensas({ recompensas }: { recompensas: RecompensaNova[] }) {
  if (recompensas.length === 0) return null;
  const album = recompensas.some((r) => r.tipo === 'ALBUM');
  return (
    <View style={estilos.aviso} accessibilityRole="alert">
      {album && <Trofeu tamanho={72} />}
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={estilos.titulo}>{album ? 'Campeão!' : 'Recompensa!'}</Text>
        {recompensas.map((r) => (
          <Text key={`${r.tipo}:${r.chave}`} style={estilos.texto}>
            {descreverRecompensa(r)}
          </Text>
        ))}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: cores.tinta,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FBBF24',
    padding: 16,
  },
  titulo: { color: '#FBBF24', fontSize: 20, fontWeight: '800', textTransform: 'uppercase' },
  texto: { color: '#FFFFFF', fontSize: 15, lineHeight: 21 },
});
