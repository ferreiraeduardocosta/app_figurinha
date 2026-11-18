import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ErroApi } from '../api';
import { Botao } from '../componentes/Botao';
import { useJogo } from '../jogo';
import { cores } from '../tema';

/** Exclusão de conta (LGPD e exigência das lojas). Pede a senha e a palavra EXCLUIR. */
export function ExcluirConta({ aoVoltar }: { aoVoltar: () => void }) {
  const { excluirConta, perfil } = useJogo();
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const excluir = async () => {
    setErro(null);
    setEnviando(true);
    try {
      await excluirConta(senha);
    } catch (e) {
      setErro(e instanceof ErroApi || e instanceof Error ? e.message : 'Não foi possível excluir a conta.');
      setEnviando(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: cores.fundo }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={estilos.barra}>
        <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={aoVoltar} style={estilos.voltar}>
          <Svg width={22} height={22} viewBox="0 0 24 24">
            <Path d="M15 5 L8 12 L15 19" fill="none" stroke={cores.tinta} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={estilos.titulo}>Excluir conta</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
        <View style={estilos.alerta}>
          <Text style={estilos.alertaTitulo}>Isto não pode ser desfeito</Text>
          <Text style={estilos.texto}>
            Ao excluir a conta {perfil ? `"${perfil.apelido}"` : ''}, apagamos seu apelido, e-mail, data de nascimento, álbum, figurinhas,
            moedas, pacotes não abertos, amizades, trocas e missões.
          </Text>
          <Text style={estilos.texto}>
            Se você fez compras, guardamos apenas o registro da compra, sem seus dados pessoais, porque a lei exige. Pacotes comprados e não
            abertos são perdidos.
          </Text>
        </View>

        <Text style={estilos.rotulo} nativeID="rotulo-senha-excluir">
          Sua senha
        </Text>
        <TextInput
          value={senha}
          onChangeText={setSenha}
          secureTextEntry
          autoCapitalize="none"
          accessibilityLabel="Sua senha"
          accessibilityLabelledBy="rotulo-senha-excluir"
          style={estilos.entrada}
        />
        <Text style={estilos.rotulo} nativeID="rotulo-confirmar-excluir">
          Digite EXCLUIR para confirmar
        </Text>
        <TextInput
          value={confirmacao}
          onChangeText={setConfirmacao}
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel="Digite EXCLUIR para confirmar"
          accessibilityLabelledBy="rotulo-confirmar-excluir"
          style={estilos.entrada}
        />
        {erro && (
          <Text style={estilos.erro} accessibilityRole="alert">
            {erro}
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: confirmacao.trim() !== 'EXCLUIR' || senha.length < 8 || enviando }}
          disabled={confirmacao.trim() !== 'EXCLUIR' || senha.length < 8 || enviando}
          onPress={excluir}
          style={({ pressed }) => [
            estilos.botaoPerigo,
            (confirmacao.trim() !== 'EXCLUIR' || senha.length < 8 || enviando) && { opacity: 0.45 },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={estilos.botaoPerigoTexto}>{enviando ? 'Excluindo…' : 'Excluir minha conta'}</Text>
        </Pressable>
        <Botao titulo="Cancelar" variante="secundario" onPress={aoVoltar} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  barra: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 6 },
  voltar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 22, fontWeight: '800', color: cores.tinta, textTransform: 'uppercase' },
  alerta: { backgroundColor: '#FEF3F2', borderColor: '#FDA29B', borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  alertaTitulo: { color: cores.erro, fontSize: 16, fontWeight: '800' },
  texto: { fontSize: 15, lineHeight: 22, color: cores.tinta },
  rotulo: { fontSize: 13, fontWeight: '700', color: cores.tinta },
  entrada: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    fontSize: 16,
    color: cores.tinta,
  },
  erro: { color: cores.erro, fontWeight: '600' },
  botaoPerigo: { minHeight: 52, borderRadius: 14, backgroundColor: cores.erro, alignItems: 'center', justifyContent: 'center' },
  botaoPerigoTexto: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
});
