import Svg, { Circle, Ellipse, Path, Rect, Text as SvgText } from 'react-native-svg';

const PELES = ['#F1C9A5', '#D9A47A', '#B07A52', '#8A5A3B', '#5A3825', '#4A2E1F'];
const CABELOS = ['#1A1A1A', '#3B2416', '#2B1B12', '#B5532A', '#8D8D8D', '#D6B370'];
const ESTILOS = ['curto', 'afro', 'raspado', 'curto'] as const;

/** Número estável a partir do código, para cada jogador ter sempre o mesmo visual. */
function hash(texto: string) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Avatar provisório (silhueta sem rosto) até a arte final chegar.
 * Tom de pele, cabelo e barba saem do código da figurinha.
 */
export function Avatar({
  codigo,
  fundo,
  camisa,
  numero,
  largura,
  altura,
  barbaBranca = false,
}: {
  codigo: string;
  fundo: string;
  camisa: string;
  numero: string;
  largura: number;
  altura: number;
  barbaBranca?: boolean;
}) {
  const h = hash(codigo);
  const pele = PELES[h % PELES.length];
  const cabelo = barbaBranca ? '#9CA3AF' : CABELOS[(h >>> 4) % CABELOS.length];
  const estilo = barbaBranca ? 'raspado' : ESTILOS[(h >>> 8) % ESTILOS.length];
  const barba = barbaBranca ? '#E5E7EB' : (h >>> 12) % 5 === 0 ? cabelo : null;

  return (
    <Svg width={largura} height={altura} viewBox="0 0 264 214" preserveAspectRatio="xMidYMax slice">
      <Rect x="0" y="0" width="264" height="214" fill={fundo} />
      <Rect x="150" y="-60" width="34" height="360" fill={camisa} opacity={0.14} transform="rotate(25 132 107)" />
      <Rect x="204" y="-60" width="14" height="360" fill={camisa} opacity={0.14} transform="rotate(25 132 107)" />
      <SvgText x="132" y="168" fill={camisa} opacity={0.18} fontSize="170" fontWeight="800" textAnchor="middle">
        {numero}
      </SvgText>
      {estilo === 'afro' && <Circle cx="132" cy="86" r="45" fill={cabelo} />}
      <Rect x="118" y="122" width="28" height="32" fill={pele} />
      <Path d="M50 214 C54 170 90 151 132 151 C174 151 210 170 214 214 Z" fill={camisa} />
      <Path d="M114 152 L132 174 L150 152 Z" fill={fundo} />
      <Ellipse cx="100" cy="100" rx="5" ry="8" fill={pele} />
      <Ellipse cx="164" cy="100" rx="5" ry="8" fill={pele} />
      <Ellipse cx="132" cy="98" rx="32" ry="38" fill={pele} />
      {estilo === 'curto' && <Path d="M99 94 C96 56 168 56 165 94 C160 74 104 74 99 94 Z" fill={cabelo} />}
      {estilo === 'raspado' && <Path d="M101 86 C104 62 160 62 163 86 C150 77 114 77 101 86 Z" fill={cabelo} opacity={0.55} />}
      {barba && <Path d="M101 102 C105 142 159 142 163 102 C153 126 111 126 101 102 Z" fill={barba} />}
    </Svg>
  );
}
