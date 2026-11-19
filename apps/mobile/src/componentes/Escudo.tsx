import { type ReactElement, useState } from 'react';
import { Image } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path, Polygon, Rect } from 'react-native-svg';
import { API_URL } from '../api';
import { useJogo } from '../jogo';

/**
 * Escudo do clube: a arte recortada que vem do servidor; sem ela (ou se não
 * carregar), o desenho vetorial do kit visual.
 */
export function Escudo({ sigla, tamanho }: { sigla: string; tamanho: number }) {
  const { clubes } = useJogo();
  const [falhou, setFalhou] = useState(false);
  const imagem = clubes[sigla]?.escudoImagem;
  if (imagem && !falhou) {
    return (
      <Image
        source={{ uri: API_URL + imagem }}
        onError={() => setFalhou(true)}
        style={{ width: tamanho, height: tamanho }}
        resizeMode="contain"
        accessibilityLabel={`Escudo ${clubes[sigla]?.nome ?? sigla}`}
      />
    );
  }
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 100 100" accessibilityLabel={`Escudo ${sigla}`}>
      {DESENHOS[sigla] ?? <Circle cx="50" cy="50" r="46" fill="#D5D9E0" />}
    </Svg>
  );
}

const DESENHOS: Record<string, ReactElement> = {
  TUB: (
    <G>
      <Path d="M50 4 L92 16 V50 C92 74 74 90 50 97 C26 90 8 74 8 50 V16 Z" fill="#0B2545" />
      <Path d="M50 11 L85 21 V50 C85 70 70 83 50 89 C30 83 15 70 15 50 V21 Z" fill="none" stroke="#FFFFFF" strokeWidth={2.5} />
      <Path d="M36 60 L56 22 L62 60 Z" fill="#FFFFFF" />
      <Path d="M18 62 Q26 55 34 62 T50 62 T66 62 T82 62 V70 Q74 77 66 70 T50 70 T34 70 T18 70 Z" fill="#FFFFFF" />
      <Path d="M30 74 Q38 69 46 74 T62 74 T78 74 V78 Q70 83 62 78 T46 78 T30 78 Z" fill="#8DA9C4" />
    </G>
  ),
  SER: (
    <G>
      <Path d="M50 4 L70 20 L92 12 V52 C92 76 74 91 50 97 C26 91 8 76 8 52 V12 L30 20 Z" fill="#1B5E20" />
      <Path d="M50 11 L69 26 L86 20 V52 C86 72 71 85 50 90 C29 85 14 72 14 52 V20 L31 26 Z" fill="none" stroke="#D4A017" strokeWidth={2.5} />
      <Path d="M20 80 L42 52 L50 62 L62 46 L82 80 Z" fill="#D4A017" />
      <Path d="M58 54 L62 46 L67 54 Z" fill="#FFFFFF" />
      <Path d="M50 40 C42 30 30 27 16 30 C28 33 36 39 42 46 Z" fill="#D4A017" />
      <Path d="M50 40 C58 30 70 27 84 30 C72 33 64 39 58 46 Z" fill="#D4A017" />
      <Circle cx="50" cy="40" r="5" fill="#D4A017" />
    </G>
  ),
  UNI: (
    <G>
      <Defs>
        <ClipPath id="clip-uni">
          <Path d="M50 6 L90 16 V50 C90 74 72 90 50 96 C28 90 10 74 10 50 V16 Z" />
        </ClipPath>
      </Defs>
      <Path d="M50 6 L90 16 V50 C90 74 72 90 50 96 C28 90 10 74 10 50 V16 Z" fill="#FFFFFF" />
      <G clipPath="url(#clip-uni)">
        <Rect x="10" y="0" width="13" height="100" fill="#C62828" />
        <Rect x="36" y="0" width="13" height="100" fill="#C62828" />
        <Rect x="62" y="0" width="13" height="100" fill="#C62828" />
        <Rect x="88" y="0" width="13" height="100" fill="#C62828" />
      </G>
      <Path d="M50 6 L90 16 V50 C90 74 72 90 50 96 C28 90 10 74 10 50 V16 Z" fill="none" stroke="#7F1D1D" strokeWidth={3} />
      <Circle cx="50" cy="56" r="16" fill="#FFFFFF" stroke="#7F1D1D" strokeWidth={2.5} />
      <Polygon points="50,49 56.7,53.9 54.1,61.8 45.9,61.8 43.3,53.9" fill="#7F1D1D" />
      <Polygon points="50.0,14.0 52.0,19.2 57.6,19.5 53.2,23.1 54.7,28.5 50.0,25.4 45.3,28.5 46.8,23.1 42.4,19.5 48.0,19.2" fill="#7F1D1D" />
    </G>
  ),
  CAP: (
    <G>
      <Path d="M26 24 L32 6 L41 17 L50 3 L59 17 L68 6 L74 24 Z" fill="#B0BEC5" />
      <Circle cx="32" cy="6" r="2.5" fill="#B0BEC5" />
      <Circle cx="50" cy="3" r="2.5" fill="#B0BEC5" />
      <Circle cx="68" cy="6" r="2.5" fill="#B0BEC5" />
      <Path d="M14 27 H86 V55 C86 77 70 90 50 97 C30 90 14 77 14 55 Z" fill="#4A148C" />
      <Path d="M20 33 H80 V55 C80 72 67 83 50 89 C33 83 20 72 20 55 Z" fill="none" stroke="#B0BEC5" strokeWidth={2} />
      <Path d="M36 78 C35 58 46 46 60 47 L74 52 L63 56 C59 56 57 60 59 65 C53 64 48 69 48 78 Z" fill="#B0BEC5" />
      <Circle cx="60" cy="52" r="2" fill="#4A148C" />
    </G>
  ),
  POL: (
    <G>
      <Circle cx="50" cy="50" r="47" fill="#81D4FA" />
      <Circle cx="50" cy="50" r="40" fill="#FFFFFF" />
      <Polygon
        points="50.0,20.0 54.2,39.8 71.2,28.8 60.2,45.8 80.0,50.0 60.2,54.2 71.2,71.2 54.2,60.2 50.0,80.0 45.8,60.2 28.8,71.2 39.8,54.2 20.0,50.0 39.8,45.8 28.8,28.8 45.8,39.8"
        fill="#0277BD"
      />
      <Circle cx="50" cy="50" r="5" fill="#FFFFFF" />
    </G>
  ),
  VEN: (
    <G>
      <Defs>
        <ClipPath id="clip-ven">
          <Path d="M12 8 H88 V50 C88 74 72 89 50 96 C28 89 12 74 12 50 Z" />
        </ClipPath>
      </Defs>
      <Path d="M12 8 H88 V50 C88 74 72 89 50 96 C28 89 12 74 12 50 Z" fill="#EF6C00" />
      <G clipPath="url(#clip-ven)">
        <Rect x="-10" y="20" width="140" height="7" fill="#111111" transform="rotate(-30 50 50)" />
        <Rect x="-10" y="76" width="140" height="7" fill="#111111" transform="rotate(-30 50 50)" />
      </G>
      <Path d="M12 8 H88 V50 C88 74 72 89 50 96 C28 89 12 74 12 50 Z" fill="none" stroke="#111111" strokeWidth={3} />
      {[0, 90, 180, 270].map((g) => (
        <Path key={g} d="M50 50 L50 26 L64 38 Z" fill="#FFFFFF" transform={`rotate(${g} 50 50)`} />
      ))}
      <Circle cx="50" cy="50" r="4" fill="#111111" />
    </G>
  ),
  DRA: (
    <G>
      <Path d="M50 94 L6 36 A62 62 0 0 1 94 36 Z" fill="#B71C1C" />
      <Path d="M50 94 L6 36 A62 62 0 0 1 94 36 Z" fill="none" stroke="#111111" strokeWidth={3} />
      <Path d="M50 94 L28 18 M50 94 L50 12 M50 94 L72 18" stroke="#7F1414" strokeWidth={1.5} />
      <Circle cx="50" cy="52" r="12" fill="#FFFFFF" />
      <Path d="M22 66 C16 38 44 24 64 34 C80 42 76 66 58 66" fill="none" stroke="#111111" strokeWidth={6} strokeLinecap="round" />
      <Path d="M58 66 L50 60 L52 72 Z" fill="#111111" />
      <Path d="M18 62 L28 56 L26 70 Z" fill="#111111" />
    </G>
  ),
  LEO: (
    <G>
      <Path d="M50 4 L92 14 V50 C92 75 74 90 50 97 C26 90 8 75 8 50 V14 Z" fill="#F9A825" />
      <Path d="M50 10 L86 19 V50 C86 71 71 84 50 90 C29 84 14 71 14 50 V19 Z" fill="none" stroke="#1B4332" strokeWidth={2.5} />
      <Polygon
        points="50.0,23.0 54.2,31.5 61.7,25.7 61.8,35.1 71.1,33.2 67.1,41.8 76.3,44.0 69.0,50.0 76.3,56.0 67.1,58.2 71.1,66.8 61.8,64.9 61.7,74.3 54.2,68.5 50.0,77.0 45.8,68.5 38.3,74.3 38.2,64.9 28.9,66.8 32.9,58.2 23.7,56.0 31.0,50.0 23.7,44.0 32.9,41.8 28.9,33.2 38.2,35.1 38.3,25.7 45.8,31.5"
        fill="#1B4332"
        transform="translate(0 2)"
      />
      <Circle cx="50" cy="52" r="13" fill="#F9A825" />
      <Circle cx="45" cy="49" r="1.8" fill="#1B4332" />
      <Circle cx="55" cy="49" r="1.8" fill="#1B4332" />
      <Path d="M46 55 H54 L50 60 Z" fill="#1B4332" />
    </G>
  ),
};
