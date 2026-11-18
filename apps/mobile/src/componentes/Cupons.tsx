import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { api, CupomMeu } from '../api';
import { useJogo } from '../jogo';
import { cores } from '../tema';
import { Botao } from './Botao';

const plural = (n: number) => `${n} ${n === 1 ? 'pacote' : 'pacotes'}`;

function Presente() {
  return (
    <Svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 11h16v9H4z" />
      <Path d="M3 7h18v4H3z" />
      <Path d="M12 7v13" />
      <Path d="M12 7c-1.5-3-5-3.5-5-1.5S10 7 12 7Zm0 0c1.5-3 5-3.5 5-1.5S14 7 12 7Z" />
    </Svg>
  );
}

/**
 * Cupons de pacotes bônus: mostra os que o painel mandou para esta conta
 * e deixa digitar um código recebido de outra forma.
 */
export function Cupons() {
  const { sessao, perfil, recarregar } = useJogo();
  const token = sessao?.token ?? '';
  const [meus, setMeus] = useState<CupomMeu[]>([]);
  const [digitando, setDigitando] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [resgatando, setResgatando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(() => {
    if (token) api.cupons(token).then(setMeus, () => undefined);
  }, [token]);
  // Recarrega quando o perfil muda (inclusive na atualização automática do app).
  useEffect(carregar, [carregar, perfil]);

  const resgatar = async (c: string) => {
    setErro(null);
    setAviso(null);
    setResgatando(c);
    try {
      const r = await api.resgatarCupom(token, c);
      setAviso(`+${plural(r.pacotes)} bônus! Abra logo abaixo.`);
      setCodigo('');
      setDigitando(false);
      await recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível resgatar o cupom.');
    } finally {
      setResgatando(null);
    }
  };

  return (
    <>
      {meus.map((c) => (
        <View key={c.codigo} style={estilos.presente}>
          <Presente />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={estilos.presenteRotulo}>Você ganhou um presente</Text>
            <Text style={estilos.presenteTitulo}>{plural(c.pacotes)}</Text>
            {c.descricao ? <Text style={estilos.presenteTexto}>{c.descricao}</Text> : null}
            {c.validoAte ? (
              <Text style={estilos.presenteTexto}>
                Resgate até {new Date(c.validoAte).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
              </Text>
            ) : null}
            <View style={{ marginTop: 10 }}>
              <Botao titulo="Resgatar" carregando={resgatando === c.codigo} onPress={() => resgatar(c.codigo)} />
            </View>
          </View>
        </View>
      ))}

      {aviso && (
        <Text style={estilos.aviso} accessibilityRole="alert">
          {aviso}
        </Text>
      )}

      {digitando ? (
        <View style={estilos.cartao}>
          <Text style={estilos.rotulo} nativeID="rotulo-cupom">
            Código do cupom
          </Text>
          <TextInput
            value={codigo}
            onChangeText={(t) => setCodigo(t.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={20}
            placeholder="Ex.: VARZEA-2026"
            placeholderTextColor="#8A8F9C"
            accessibilityLabel="Código do cupom"
            accessibilityLabelledBy="rotulo-cupom"
            style={estilos.entrada}
            onSubmitEditing={() => codigo.trim().length >= 4 && resgatar(codigo.trim())}
          />
          {erro && (
            <Text style={estilos.erro} accessibilityRole="alert">
              {erro}
            </Text>
          )}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Botao titulo="Cancelar" variante="secundario" onPress={() => { setDigitando(false); setErro(null); }} />
            </View>
            <View style={{ flex: 1 }}>
              <Botao
                titulo="Resgatar"
                desabilitado={codigo.trim().length < 4}
                carregando={resgatando === codigo.trim()}
                onPress={() => resgatar(codigo.trim())}
              />
            </View>
          </View>
        </View>
      ) : (
        <>
          {erro && (
            <Text style={estilos.erro} accessibilityRole="alert">
              {erro}
            </Text>
          )}
          <Pressable accessibilityRole="button" onPress={() => { setDigitando(true); setErro(null); setAviso(null); }} style={estilos.link}>
            <Text style={estilos.linkTexto}>Tenho um código de cupom</Text>
          </Pressable>
        </>
      )}
    </>
  );
}

const estilos = StyleSheet.create({
  presente: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: cores.tinta,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FBBF24',
    padding: 16,
  },
  presenteRotulo: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: '#FBBF24' },
  presenteTitulo: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', textTransform: 'uppercase' },
  presenteTexto: { fontSize: 14, color: '#D1D5DB' },
  cartao: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: cores.borda, borderRadius: 16, padding: 16, gap: 10 },
  rotulo: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: cores.apagado },
  entrada: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 1,
    color: cores.tinta,
    backgroundColor: '#FFFFFF',
  },
  aviso: { backgroundColor: '#FFF7D6', color: '#6B4E16', fontWeight: '800', padding: 10, borderRadius: 10, overflow: 'hidden', textAlign: 'center' },
  erro: { color: cores.erro, fontWeight: '600' },
  link: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  linkTexto: { fontSize: 15, fontWeight: '700', color: cores.destaque },
});
