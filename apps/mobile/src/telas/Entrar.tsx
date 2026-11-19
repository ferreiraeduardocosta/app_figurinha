import { type ComponentRef, forwardRef, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ErroApi } from '../api';
import { Botao } from '../componentes/Botao';
import { Escudo } from '../componentes/Escudo';
import { RolagemComTeclado } from '../componentes/RolagemComTeclado';
import { useJogo } from '../jogo';
import { cores } from '../tema';

export function Entrar() {
  const { entrar, cadastrar } = useJogo();
  const [modo, setModo] = useState<'entrar' | 'cadastro'>('entrar');
  const [apelido, setApelido] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<{ campo?: Campo; mensagem: string } | null>(null);
  const refEmail = useRef<ComponentRef<typeof TextInput>>(null);
  const refSenha = useRef<ComponentRef<typeof TextInput>>(null);

  const enviar = async () => {
    setErro(null);
    const local = conferir(modo, apelido.trim(), email.trim(), senha);
    if (local) {
      setErro(local);
      return;
    }
    Keyboard.dismiss();
    setEnviando(true);
    try {
      if (modo === 'entrar') await entrar(email.trim(), senha);
      else await cadastrar(apelido.trim(), email.trim(), senha);
    } catch (e) {
      const campo = e instanceof ErroApi ? (e.dados.campo as Campo | undefined) : undefined;
      setErro({ campo, mensagem: e instanceof Error ? e.message : 'Algo deu errado.' });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <RolagemComTeclado contentContainerStyle={estilos.conteudo}>
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
            <CampoTexto
              rotulo="Apelido"
              valor={apelido}
              aoMudar={setApelido}
              dica="3 a 20 caracteres: letras sem acento, números, ponto, hífen ou _. Sem espaços."
              erro={erro?.campo === 'apelido' ? erro.mensagem : undefined}
              proximo={() => refEmail.current?.focus()}
            />
          )}
          <CampoTexto
            ref={refEmail}
            rotulo="E-mail"
            valor={email}
            aoMudar={setEmail}
            teclado="email-address"
            erro={erro?.campo === 'email' ? erro.mensagem : undefined}
            proximo={() => refSenha.current?.focus()}
          />
          <CampoTexto
            ref={refSenha}
            rotulo="Senha"
            valor={senha}
            aoMudar={setSenha}
            secreto
            dica={modo === 'cadastro' ? 'Pelo menos 8 caracteres. Pode ser só letras.' : undefined}
            erro={erro?.campo === 'senha' ? erro.mensagem : undefined}
            aoEnviar={enviar}
          />
          {erro && !['apelido', 'email', 'senha'].includes(erro.campo ?? '') && (
            <Text style={estilos.erro} accessibilityRole="alert">
              {erro.mensagem}
            </Text>
          )}
          <Botao titulo={modo === 'entrar' ? 'Entrar' : 'Criar conta'} onPress={enviar} carregando={enviando} />
        </View>
    </RolagemComTeclado>
  );
}

type Campo = 'apelido' | 'email' | 'senha';

/** Confere no aparelho as mesmas regras do servidor, para o erro aparecer no campo certo. */
function conferir(modo: 'entrar' | 'cadastro', apelido: string, email: string, senha: string) {
  if (modo === 'cadastro') {
    if (apelido.length < 3 || apelido.length > 20) return { campo: 'apelido' as const, mensagem: 'O apelido deve ter de 3 a 20 caracteres.' };
    if (!/^[A-Za-z0-9_.-]+$/.test(apelido))
      return { campo: 'apelido' as const, mensagem: 'O apelido não pode ter espaço nem acento. Ex.: eduardo.costa' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { campo: 'email' as const, mensagem: 'Confira o e-mail.' };
  if (senha.length < 8) return { campo: 'senha' as const, mensagem: 'A senha precisa de pelo menos 8 caracteres.' };
  return null;
}

const CampoTexto = forwardRef<
  ComponentRef<typeof TextInput>,
  {
    rotulo: string;
    valor: string;
    aoMudar: (v: string) => void;
    dica?: string;
    erro?: string;
    secreto?: boolean;
    teclado?: 'default' | 'email-address';
    proximo?: () => void;
    aoEnviar?: () => void;
  }
>(function CampoTexto({ rotulo, valor, aoMudar, dica, erro, secreto = false, teclado = 'default', proximo, aoEnviar }, ref) {
  const [visivel, setVisivel] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={estilos.rotulo} nativeID={`rotulo-${rotulo}`}>
        {rotulo}
      </Text>
      <View style={[estilos.entrada, erro && { borderColor: cores.erro, borderWidth: 1.5 }]}>
        <TextInput
          ref={ref}
          accessibilityLabel={rotulo}
          accessibilityLabelledBy={`rotulo-${rotulo}`}
          value={valor}
          onChangeText={aoMudar}
          secureTextEntry={secreto && !visivel}
          keyboardType={teclado}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={secreto ? 'password' : teclado === 'email-address' ? 'email' : 'off'}
          returnKeyType={aoEnviar ? 'go' : 'next'}
          submitBehavior={proximo ? 'submit' : 'blurAndSubmit'}
          onSubmitEditing={proximo ?? aoEnviar}
          style={estilos.texto}
          placeholderTextColor={cores.apagado}
        />
        {secreto && (
          <Pressable
            onPress={() => setVisivel((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={visivel ? 'Ocultar senha' : 'Mostrar senha'}
            hitSlop={8}
            style={estilos.olho}
          >
            <Text style={estilos.olhoTexto}>{visivel ? 'Ocultar' : 'Mostrar'}</Text>
          </Pressable>
        )}
      </View>
      {erro ? (
        <Text style={estilos.erro} accessibilityRole="alert">
          {erro}
        </Text>
      ) : (
        dica && <Text style={estilos.dica}>{dica}</Text>
      )}
    </View>
  );
});

const estilos = StyleSheet.create({
  conteudo: { flexGrow: 1, padding: 24, paddingTop: 48, paddingBottom: 32, gap: 8 },
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  texto: { flex: 1, minHeight: 50, paddingHorizontal: 14, fontSize: 16, color: cores.tinta },
  olho: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center' },
  olhoTexto: { fontSize: 14, fontWeight: '700', color: cores.destaque },
  dica: { fontSize: 12, color: cores.apagado },
  erro: { fontSize: 14, color: cores.erro, fontWeight: '600' },
});
