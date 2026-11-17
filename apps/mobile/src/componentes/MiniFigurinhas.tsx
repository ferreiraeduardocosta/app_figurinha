import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ItemTroca } from '../api';
import { useJogo } from '../jogo';
import { cores } from '../tema';
import { Figurinha } from './Figurinha';

const LARGURA = 84;

/** Fileira horizontal de figurinhas pequenas (com "x2" quando há mais de uma cópia). */
export function MiniFigurinhas({ itens, vazio = 'Nenhuma' }: { itens: ItemTroca[]; vazio?: string }) {
  const { porCodigo, clubes } = useJogo();
  if (itens.length === 0) return <Text style={estilos.vazio}>{vazio}</Text>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {itens.map(({ codigo, quantidade }) => {
        const f = porCodigo[codigo];
        if (!f) return null;
        return (
          <View key={codigo}>
            <Figurinha figurinha={f} clube={clubes[f.clubeSigla]} largura={LARGURA} />
            {quantidade > 1 && <Text style={estilos.qtd}>x{quantidade}</Text>}
          </View>
        );
      })}
    </ScrollView>
  );
}

/** Grade de figurinhas que podem ser marcadas (para montar uma proposta). */
export function SeletorFigurinhas({
  codigos,
  marcados,
  aoAlternar,
  destaque,
}: {
  codigos: string[];
  marcados: Set<string>;
  aoAlternar: (codigo: string) => void;
  /** Códigos que o outro jogador não tem (aparecem com selo "Falta"). */
  destaque?: Set<string>;
}) {
  const { porCodigo, clubes } = useJogo();
  if (codigos.length === 0) return <Text style={estilos.vazio}>Nenhuma figurinha disponível.</Text>;
  return (
    <View style={estilos.grade}>
      {codigos.map((codigo) => {
        const f = porCodigo[codigo];
        if (!f) return null;
        const marcado = marcados.has(codigo);
        return (
          <Pressable
            key={codigo}
            onPress={() => aoAlternar(codigo)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: marcado }}
            accessibilityLabel={`${f.apelido ?? f.nome}, ${codigo}`}
            style={[estilos.opcao, marcado && estilos.opcaoMarcada]}
          >
            <Figurinha figurinha={f} clube={clubes[f.clubeSigla]} largura={LARGURA} />
            {destaque?.has(codigo) && <Text style={estilos.falta}>Falta</Text>}
            {marcado && (
              <View style={estilos.check}>
                <Text style={estilos.checkTexto}>✓</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  vazio: { fontSize: 14, color: cores.apagado, paddingVertical: 6 },
  qtd: { position: 'absolute', top: 4, right: 4, backgroundColor: cores.tinta, color: '#FFFFFF', fontSize: 11, fontWeight: '800', borderRadius: 8, paddingHorizontal: 5 },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  opcao: { borderRadius: 12, padding: 3, borderWidth: 3, borderColor: 'transparent' },
  opcaoMarcada: { borderColor: cores.destaque },
  falta: {
    position: 'absolute',
    bottom: 6,
    alignSelf: 'center',
    backgroundColor: '#FBBF24',
    color: cores.tinta,
    fontSize: 10,
    fontWeight: '800',
    borderRadius: 6,
    paddingHorizontal: 6,
    overflow: 'hidden',
  },
  check: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: cores.destaque,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkTexto: { color: '#FFFFFF', fontWeight: '800' },
});
