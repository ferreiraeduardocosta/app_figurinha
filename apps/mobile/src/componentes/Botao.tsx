import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { cores } from '../tema';

export function Botao({
  titulo,
  onPress,
  variante = 'primario',
  carregando = false,
  desabilitado = false,
}: {
  titulo: string;
  onPress: () => void;
  variante?: 'primario' | 'secundario';
  carregando?: boolean;
  desabilitado?: boolean;
}) {
  const primario = variante === 'primario';
  const inativo = desabilitado || carregando;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inativo, busy: carregando }}
      disabled={inativo}
      onPress={onPress}
      style={({ pressed }) => [
        estilos.base,
        primario ? estilos.primario : estilos.secundario,
        inativo && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={primario ? '#FFFFFF' : cores.destaque} />
      ) : (
        <Text style={[estilos.texto, { color: primario ? '#FFFFFF' : cores.destaque }]}>{titulo}</Text>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  primario: { backgroundColor: cores.destaque },
  secundario: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: cores.destaque },
  texto: { fontSize: 17, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
});
