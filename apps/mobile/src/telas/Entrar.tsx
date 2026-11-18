import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ErroApi } from '../api';
import { Botao } from '../componentes/Botao';
import { Escudo } from '../componentes/Escudo';
import { useJogo } from '../jogo';
import { cores } from '../tema';

export function Entrar() {
  const { entrar, cadastrar } = useJogo();
  const [modo, setModo] = useState<'entrar' | 'cadastro'>('entrar');
  const [apelido, setApelido] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = async () => {
    setErro(null);
    setEnviando(true);
    try {
      if (modo === 'entrar') await entrar(email.trim(), senha);
      else await cadastrar(apelido.trim(), email.trim(), senha);
    } catch (e) {
      setErro(e instanceof ErroApi || e instanceof Error ? e.message : 'Algo deu errado.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <View style={estilos.escudos} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {['TUB', 'UNI', 'POL', 'LEO'].map((s) => (
            <Escudo key={s} sigla={s} tamanho={52} />
          ))}
        </View>
        <Text style={estilos.sobretitulo}>Temporada 1</Text>
        <Text style={estilos.titulo}>Craques da Várzea</Text>
        <Text style={estilos.subtitulo}>Abra pacotes, complete o álbum e troque com os amigos.</Text>

        <View style={estilos.abas} accessibilityRole="tablist">
          {(['entrar', 'cadastro'] as const).map((m) => (
            <Pressable
              key={m}
              accessibilityRole="tab"
              accessibilityState={{ selected: modo === m }}
              onPress={() => {
                setModo(m);
                setErro(null);
              }}
              style={[estilos.aba, modo === m && estilos.abaAtiva]}
            >
              <Text style={[estilos.abaTexto, modo === m && { color: cores.tinta }]}>
                {m === 'entrar' ? 'Entrar' : 'Criar conta'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ gap: 14 }}>
          {modo === 'cadastro' && (
            <Campo
              rotulo="Apelido"
              valor={apelido}
              aoMudar={setApelido}
              dica="3 a 20 letras, números, ponto ou hífen"
              autoCapitalize="none"
            />
          )}
          <Campo rotulo="E-mail" valor={email} aoMudar={setEmail} teclado="email-address" autoCapitalize="none" />
          <Campo
            rotulo="Senha"
            valor={senha}
            aoMudar={setSenha}
            secreto
            dica={modo === 'cadastro' ? 'Pelo menos 8 caracteres' : undefined}
          />
          {erro && (
            <Text style={estilos.erro} accessibilityRole="alert">
              {erro}
            </Text>
          )}
          <Botao titulo={modo === 'entrar' ? 'Entrar' : 'Criar conta'} onPress={enviar} carregando={enviando} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Campo({
  rotulo,
  valor,
  aoMudar,
  dica,
  secreto = false,
  teclado = 'default',
  autoCapitalize = 'sentences',
}: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  dica?: string;
  secreto?: boolean;
  teclado?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences';
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={estilos.rotulo} nativeID={`rotulo-${rotulo}`}>
        {rotulo}
      </Text>
      <TextInput
        accessibilityLabel={rotulo}
        accessibilityLabelledBy={`rotulo-${rotulo}`}
        value={valor}
        onChangeText={aoMudar}
        secureTextEntry={secreto}
        keyboardType={teclado}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        style={estilos.entrada}
        placeholderTextColor={cores.apagado}
      />
      {dica && <Text style={estilos.dica}>{dica}</Text>}
    </View>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: 24, paddingTop: 48, gap: 8 },
  escudos: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  sobretitulo: { fontSize: 12, fontWeight: '600', letterSpacing: 1.5, textTransform: 'uppercase', color: cores.destaque },
  titulo: { fontSize: 44, fontWeight: '800', color: cores.tinta, textTransform: 'uppercase', lineHeight: 48 },
  subtitulo: { fontSize: 15, color: cores.apagado, marginBottom: 20 },
  abas: { flexDirection: 'row', backgroundColor: cores.vazio, borderRadius: 12, padding: 4, marginBottom: 16 },
  aba: { flex: 1, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  abaAtiva: { backgroundColor: '#FFFFFF' },
  abaTexto: { fontSize: 15, fontWeight: '700', color: cores.apagado },
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
  dica: { fontSize: 12, color: cores.apagado },
  erro: { fontSize: 14, color: cores.erro, fontWeight: '600' },
});
