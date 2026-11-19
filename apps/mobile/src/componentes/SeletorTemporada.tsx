import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useJogo } from '../jogo';
import { cores } from '../tema';

/**
 * Troca a temporada do álbum, da liga e dos pacotes. Só aparece quando há mais de
 * uma temporada publicada. Temporada bloqueada mostra o cadeado e o que falta.
 */
export function SeletorTemporada() {
  const { perfil, temporada, setTemporada } = useJogo();
  const [aviso, setAviso] = useState<string | null>(null);
  const lista = perfil?.temporadas ?? [];
  if (lista.length <= 1) return null;

  return (
    <View style={{ gap: 6 }}>
      <View style={estilos.linha} accessibilityRole="tablist">
        {lista.map((t) => {
          const ativa = t.numero === temporada;
          return (
            <Pressable
              key={t.numero}
              accessibilityRole="tab"
              accessibilityState={{ selected: ativa, disabled: !t.liberada }}
              accessibilityLabel={t.liberada ? t.nome : `${t.nome}, bloqueada`}
              onPress={() => {
                if (t.liberada) {
                  setAviso(null);
                  setTemporada(t.numero);
                  return;
                }
                const req = lista.find((x) => x.numero === t.requisito);
                setAviso(
                  req
                    ? `Complete o álbum da ${req.nome} para liberar a ${t.nome}. Faltam ${req.album.total - req.album.coladas} figurinhas.`
                    : `${t.nome} ainda está bloqueada.`,
                );
              }}
              style={[estilos.aba, ativa && estilos.abaAtiva, !t.liberada && estilos.abaBloqueada]}
            >
              <Text style={[estilos.texto, ativa && { color: '#FFFFFF' }]}>
                {t.liberada ? '' : '🔒 '}
                {t.nome}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {aviso && (
        <Text style={estilos.aviso} accessibilityRole="alert">
          {aviso}
        </Text>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  aba: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: cores.borda,
    backgroundColor: cores.papel,
    justifyContent: 'center',
  },
  abaAtiva: { backgroundColor: cores.destaque, borderColor: cores.destaque },
  abaBloqueada: { borderStyle: 'dashed', opacity: 0.75 },
  texto: { fontSize: 14, fontWeight: '800', color: cores.tinta },
  aviso: { fontSize: 13, color: cores.apagado, fontWeight: '600' },
});
