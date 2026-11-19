import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Polygon, Rect, Stop, Text as SvgText } from 'react-native-svg';
import type { Clube, Figurinha as DadosFigurinha } from '../api';
import { cores, estiloRaridade } from '../tema';
import { Avatar } from './Avatar';
import { BrilhoLendario } from './BrilhoLendario';
import { Escudo } from './Escudo';

const BASE_L = 280;
const BASE_A = 392;

export function notaGeral(f: DadosFigurinha): number | null {
  const v = [f.ataque, f.defesa, f.tecnica, f.velocidade, f.fisico];
  if (v.some((x) => x == null)) return null;
  return Math.round((v as number[]).reduce((s, x) => s + x, 0) / 5);
}

/**
 * A figurinha, igual ao kit visual. Desenhada em 280×392 e escalada por `largura`.
 */
export function Figurinha({
  figurinha: f,
  clube,
  largura = BASE_L,
  brilhante = false,
  emAlta = false,
}: {
  figurinha: DadosFigurinha;
  clube: Clube;
  largura?: number;
  brilhante?: boolean;
  /** Craque da última rodada da liga. */
  emAlta?: boolean;
}) {
  const k = largura / BASE_L;
  const r = estiloRaridade[f.raridade];
  const geral = notaGeral(f);
  const ehEscudo = f.tipo === 'ESCUDO';
  const nomeGrande = ehEscudo ? 'Escudo' : f.apelido ?? f.nome;
  const linhaSub = ehEscudo
    ? clube.nome
    : f.apelido
      ? `${f.nome}${f.camisa ? ` · #${f.camisa}` : ''}`
      : f.camisa
        ? `#${f.camisa}`
        : r.nome;
  const idGrad = `moldura-${f.raridade}`;
  const lendaria = f.raridade === 'LENDARIA';
  const retratoA = 214 * k;
  const retratoL = largura - 16 * k;

  return (
    <View style={lendaria ? brilhoExterno(k) : undefined}>
    <View
      style={{ width: largura, height: BASE_A * k, borderRadius: 18 * k, overflow: 'hidden' }}
      accessible
      accessibilityLabel={`${nomeGrande}, ${r.nome}, ${f.codigo}${emAlta ? ', em alta' : ''}`}
    >
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 140" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={idGrad} x1="0" y1="0" x2="1" y2="1">
            {r.moldura.map((c, i) => (
              <Stop key={i} offset={i / Math.max(1, r.moldura.length - 1)} stopColor={c} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="140" fill={`url(#${idGrad})`} />
      </Svg>

      <View
        style={[
          estilos.interno,
          { margin: 8 * k, borderRadius: 12 * k, backgroundColor: r.interno },
          lendaria && { borderWidth: 1.5 * k, borderColor: '#FBBF24' },
        ]}
      >
        <View style={{ height: retratoA, backgroundColor: clube.corPrimaria, overflow: 'hidden' }}>
          <Retrato f={f} clube={clube} largura={retratoL} altura={retratoA} k={k} />
          <View style={[estilos.topo, { top: 10 * k, left: 10 * k, right: 10 * k }]}>
            {geral != null ? (
              <View style={[estilos.nota, { borderRadius: 10 * k, paddingHorizontal: 10 * k, paddingVertical: 4 * k }]}>
                <Text style={{ fontSize: 32 * k, fontWeight: '800', color: cores.tinta, lineHeight: 34 * k }}>{geral}</Text>
                <Text style={{ fontSize: 11 * k, fontWeight: '700', color: '#3F4453' }}>{f.posicao}</Text>
              </View>
            ) : (
              <View />
            )}
            <View style={[estilos.circulo, { width: 50 * k, height: 50 * k, borderRadius: 25 * k }]}>
              <Escudo sigla={clube.sigla} tamanho={38 * k} />
            </View>
          </View>
          {f.tipo === 'LENDA' && <Etiqueta texto="LENDA" k={k} lado="esquerda" cor="#B7791F" />}
          {emAlta && <Etiqueta texto="EM ALTA" k={k} lado="esquerda" cor="#EA580C" />}
          {brilhante && <Etiqueta texto="BRILHANTE" k={k} lado="direita" claro />}
        </View>

        <View style={{ paddingHorizontal: 14 * k, paddingTop: 10 * k, gap: 2 * k }}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={[
              { fontSize: tamanhoNome(nomeGrande) * k, fontWeight: '800', color: r.texto, textTransform: 'uppercase' },
              lendaria && { color: '#FDE68A', textShadowColor: '#F59E0B', textShadowRadius: 8 * k, textShadowOffset: { width: 0, height: 0 } },
            ]}
          >
            {nomeGrande}
          </Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ fontSize: 12 * k, fontWeight: '500', color: r.sub }}>
            {linhaSub}
          </Text>
        </View>

        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 10 * k }}>
          {geral != null ? (
            <View style={{ flexDirection: 'row' }}>
              {(
                [
                  ['ATA', f.ataque],
                  ['DEF', f.defesa],
                  ['TEC', f.tecnica],
                  ['VEL', f.velocidade],
                  ['FIS', f.fisico],
                ] as const
              ).map(([rotulo, valor]) => (
                <View key={rotulo} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 10 * k, fontWeight: '700', color: r.sub, letterSpacing: 0.8 * k }}>{rotulo}</Text>
                  <Text style={{ fontSize: 22 * k, fontWeight: '700', color: r.texto }}>{valor}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text numberOfLines={2} style={{ fontSize: 13 * k, color: r.sub, paddingHorizontal: 4 * k }}>
              {f.destaque}
            </Text>
          )}
        </View>

        <View
          style={[
            estilos.rodape,
            { borderTopColor: r.linha, paddingHorizontal: 14 * k, paddingTop: 8 * k, paddingBottom: 10 * k },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 * k }}>
            <View style={{ flexDirection: 'row', gap: 4 * k }}>
              {Array.from({ length: r.losangos }, (_, i) => (
                <View
                  key={i}
                  style={{ width: 7 * k, height: 7 * k, backgroundColor: r.losango, transform: [{ rotate: '45deg' }] }}
                />
              ))}
            </View>
            <Text style={{ fontSize: 11 * k, fontWeight: '700', color: r.texto, letterSpacing: 1 * k, textTransform: 'uppercase' }}>
              {r.nome}
            </Text>
          </View>
          <Text style={{ fontSize: 11 * k, fontWeight: '600', color: r.sub, fontFamily: 'monospace' }}>{f.codigo}</Text>
        </View>
      </View>

      {brilhante && (
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 140" preserveAspectRatio="none" pointerEvents="none">
          <Defs>
            <LinearGradient id="holo" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FF0099" stopOpacity={0} />
              <Stop offset="0.3" stopColor="#FF0099" stopOpacity={0.22} />
              <Stop offset="0.5" stopColor="#00E5FF" stopOpacity={0.25} />
              <Stop offset="0.7" stopColor="#FFEB3B" stopOpacity={0.22} />
              <Stop offset="1" stopColor="#FF0099" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="140" fill="url(#holo)" />
        </Svg>
      )}
      {lendaria && <BrilhoLendario largura={largura} altura={BASE_A * k} k={k} />}
    </View>
    </View>
  );
}

/** Aura dourada em volta da carta lendária. */
function brilhoExterno(k: number) {
  return Platform.select({
    web: { borderRadius: 18 * k, boxShadow: `0 0 ${14 * k}px ${3 * k}px rgba(251, 191, 36, 0.65), 0 0 ${28 * k}px ${6 * k}px rgba(168, 85, 247, 0.35)` },
    default: {
      borderRadius: 18 * k,
      // No Android a sombra precisa de um fundo para aparecer.
      backgroundColor: '#7C3AED',
      shadowColor: '#F59E0B',
      shadowOpacity: 0.9,
      shadowRadius: 12 * k,
      shadowOffset: { width: 0, height: 0 },
      elevation: 12,
    },
  }) as object;
}

function Retrato({ f, clube, largura, altura, k }: { f: DadosFigurinha; clube: Clube; largura: number; altura: number; k: number }) {
  if (f.tipo === 'JOGADOR' || f.tipo === 'LENDA' || f.tipo === 'TECNICO') {
    return (
      <Avatar
        codigo={f.codigo}
        fundo={clube.corPrimaria}
        camisa={f.tipo === 'TECNICO' ? '#2B2F3A' : clube.corSecundaria}
        numero={f.tipo === 'LENDA' ? '★' : f.camisa ? String(f.camisa) : ''}
        largura={largura}
        altura={altura}
        barbaBranca={f.tipo === 'LENDA'}
      />
    );
  }
  if (f.tipo === 'MOMENTO') {
    const ano = f.destaque?.split('·')[0]?.trim() ?? '';
    return (
      <Svg width={largura} height={altura} viewBox="0 0 264 214">
        <Rect x="0" y="0" width="264" height="214" fill={clube.corPrimaria} />
        <Polygon
          points="132,40 146,86 194,86 155,114 170,160 132,132 94,160 109,114 70,86 118,86"
          fill={clube.corSecundaria}
          opacity={0.9}
        />
        <SvgText x="132" y="200" fill={clube.corSecundaria} fontSize="30" fontWeight="800" textAnchor="middle">
          {ano}
        </SvgText>
      </Svg>
    );
  }
  // Escudo, estádio e mascote: o escudo do clube sobre o papel, com a legenda do tipo.
  const legenda = { ESCUDO: '', ESTADIO: 'ESTÁDIO', MASCOTE: 'MASCOTE' }[f.tipo as 'ESCUDO' | 'ESTADIO' | 'MASCOTE'];
  return (
    <View style={{ width: largura, height: altura, backgroundColor: cores.fundo, alignItems: 'center', justifyContent: 'center', gap: 8 * k }}>
      <Escudo sigla={clube.sigla} tamanho={(legenda ? 120 : 150) * k} />
      {!!legenda && (
        <Text style={{ fontSize: 14 * k, fontWeight: '800', letterSpacing: 2 * k, color: cores.apagado }}>{legenda}</Text>
      )}
    </View>
  );
}

function Etiqueta({
  texto,
  k,
  lado,
  claro = false,
  cor,
}: {
  texto: string;
  k: number;
  lado: 'esquerda' | 'direita';
  claro?: boolean;
  cor?: string;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        bottom: 10 * k,
        [lado === 'esquerda' ? 'left' : 'right']: 10 * k,
        backgroundColor: cor ?? (claro ? '#FFFFFF' : cores.tinta),
        borderRadius: 6 * k,
        paddingHorizontal: 8 * k,
        paddingVertical: 4 * k,
      }}
    >
      <Text style={{ fontSize: 10 * k, fontWeight: '700', letterSpacing: 1.2 * k, color: claro ? cores.tinta : '#FFFFFF' }}>{texto}</Text>
    </View>
  );
}

/** Espaço vazio no álbum, para figurinha que o jogador ainda não tem. */
export function EspacoVazio({ codigo, rotulo, largura }: { codigo: string; rotulo: string; largura: number }) {
  const k = largura / BASE_L;
  return (
    <View
      style={{
        width: largura,
        height: BASE_A * k,
        borderRadius: 14 * k,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: cores.vazioBorda,
        backgroundColor: cores.vazio,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
      }}
      accessible
      accessibilityLabel={`${codigo}, ${rotulo}, ainda não tem`}
    >
      <Text style={{ fontSize: 34, fontWeight: '800', color: '#8E8573' }}>?</Text>
      <Text style={{ fontSize: 10, fontWeight: '700', color: cores.vazioTexto, textTransform: 'uppercase' }}>{rotulo}</Text>
      <Text style={{ fontSize: 9, color: cores.vazioTexto, fontFamily: 'monospace' }}>{codigo}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  interno: { flex: 1, overflow: 'hidden' },
  topo: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  nota: { backgroundColor: '#FFFFFF', alignItems: 'center' },
  circulo: { backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  rodape: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1 },
});

/**
 * Tamanho do nome (na escala da carta de 280 px) para caber numa linha.
 * Letra maiúscula em negrito ocupa ~0,72 do tamanho da fonte; sobram 236 px de largura.
 * O adjustsFontSizeToFit ainda reduz um pouco mais se a fonte do aparelho for mais larga.
 */
function tamanhoNome(nome: string) {
  return Math.max(13, Math.min(26, 236 / (nome.length * 0.72)));
}

