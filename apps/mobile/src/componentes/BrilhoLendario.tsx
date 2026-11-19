import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

const nativo = Platform.OS !== 'web';

/** Respeita "reduzir movimento" do aparelho. */
function useMovimentoReduzido() {
  const [reduzido, setReduzido] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduzido).catch(() => {});
    const s = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduzido);
    return () => s.remove();
  }, []);
  return reduzido;
}

// Estrelinhas: posição (fração da carta), tamanho (escala 280) e atraso.
const ESTRELAS = [
  { x: 0.62, y: 0.2, t: 16, atraso: 0 },
  { x: 0.82, y: 0.3, t: 12, atraso: 500 },
  { x: 0.12, y: 0.47, t: 10, atraso: 1100 },
  { x: 0.9, y: 0.6, t: 14, atraso: 800 },
  { x: 0.55, y: 0.06, t: 9, atraso: 1500 },
  { x: 0.08, y: 0.9, t: 11, atraso: 300 },
];

/**
 * Camada por cima da carta lendária: holográfico fixo, faixa de luz que passa
 * pela carta de tempos em tempos e estrelinhas piscando.
 */
export function BrilhoLendario({ largura, altura, k }: { largura: number; altura: number; k: number }) {
  const reduzido = useMovimentoReduzido();
  const faixa = useRef(new Animated.Value(0)).current;
  const pisca = useRef(ESTRELAS.map(() => new Animated.Value(0.35))).current;

  useEffect(() => {
    if (reduzido) return;
    const varrer = Animated.loop(
      Animated.sequence([
        Animated.timing(faixa, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: nativo }),
        Animated.delay(2400),
        Animated.timing(faixa, { toValue: 0, duration: 0, useNativeDriver: nativo }),
      ]),
    );
    const piscar = pisca.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(ESTRELAS[i].atraso),
          Animated.timing(v, { toValue: 1, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: nativo }),
          Animated.timing(v, { toValue: 0.25, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: nativo }),
          Animated.delay(1600 - ESTRELAS[i].atraso),
        ]),
      ),
    );
    varrer.start();
    piscar.forEach((a) => a.start());
    return () => {
      varrer.stop();
      piscar.forEach((a) => a.stop());
    };
  }, [reduzido, faixa, pisca]);

  const larguraFaixa = largura * 0.42;
  const translateX = faixa.interpolate({ inputRange: [0, 1], outputRange: [-larguraFaixa * 1.6, largura + larguraFaixa * 0.6] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Holográfico fixo, bem suave. */}
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 140" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="holo-lenda" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#F0ABFC" stopOpacity={0} />
            <Stop offset="0.35" stopColor="#F0ABFC" stopOpacity={0.14} />
            <Stop offset="0.5" stopColor="#67E8F9" stopOpacity={0.16} />
            <Stop offset="0.65" stopColor="#FDE68A" stopOpacity={0.14} />
            <Stop offset="1" stopColor="#FDE68A" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="140" fill="url(#holo-lenda)" />
      </Svg>

      {/* Faixa de luz atravessando a carta. */}
      {!reduzido && (
        <Animated.View
          style={{
            position: 'absolute',
            top: -altura * 0.25,
            left: 0,
            width: larguraFaixa,
            height: altura * 1.5,
            transform: [{ translateX }, { rotate: '18deg' }],
          }}
        >
          <Svg width="100%" height="100%" viewBox="0 0 10 10" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="faixa-lenda" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
                <Stop offset="0.42" stopColor="#FFF7D6" stopOpacity={0.55} />
                <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.85} />
                <Stop offset="0.58" stopColor="#FFF7D6" stopOpacity={0.55} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="10" height="10" fill="url(#faixa-lenda)" />
          </Svg>
        </Animated.View>
      )}

      {/* Estrelinhas. */}
      {ESTRELAS.map((e, i) => {
        const t = e.t * k;
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: e.x * largura - t / 2,
              top: e.y * altura - t / 2,
              opacity: reduzido ? 0.8 : pisca[i],
              transform: reduzido ? [] : [{ scale: pisca[i] }],
            }}
          >
            <Svg width={t} height={t} viewBox="0 0 20 20">
              <Path d="M10 0 C11 7 13 9 20 10 C13 11 11 13 10 20 C9 13 7 11 0 10 C7 9 9 7 10 0 Z" fill="#FFF7D6" />
            </Svg>
          </Animated.View>
        );
      })}
    </View>
  );
}
