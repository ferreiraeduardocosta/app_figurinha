import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, ErroApi, Troca, UsuarioResumo } from '../api';
import { Botao } from '../componentes/Botao';
import { MiniFigurinhas, SeletorFigurinhas } from '../componentes/MiniFigurinhas';
import { useJogo } from '../jogo';
import { cores } from '../tema';

const MAX_POR_LADO = 5;

/**
 * Monta uma proposta para um amigo: "Você dá" (suas repetidas) e "Você recebe"
 * (repetidas do amigo que faltam para você). Com `respondendo`, vira contraproposta.
 */
export function MontarTroca({
  amigo,
  respondendo,
  aoFechar,
  aoEnviar,
}: {
  amigo: UsuarioResumo;
  respondendo?: Troca;
  aoFechar: () => void;
  aoEnviar: () => void;
}) {
  const { sessao, album } = useJogo();
  const [carregando, setCarregando] = useState(true);
  const [recebiveis, setRecebiveis] = useState<string[]>([]);
  const [queFaltamPraEle, setQueFaltamPraEle] = useState<Set<string>>(new Set());
  const [dou, setDou] = useState<Set<string>>(new Set());
  const [recebo, setRecebo] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!sessao) return;
    api
      .sugestoes(sessao.token)
      .then((lista) => {
        const s = lista.find((x) => x.amigo.id === amigo.id);
        setRecebiveis(s?.euRecebo ?? []);
        setQueFaltamPraEle(new Set(s?.euDou ?? []));
      })
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [sessao, amigo.id]);

  // Minhas repetidas: primeiro as que faltam para o amigo.
  const minhasRepetidas = useMemo(
    () =>
      (album?.itens ?? [])
        .filter((i) => i.quantidade > 1)
        .map((i) => i.codigo)
        .sort((a, b) => Number(queFaltamPraEle.has(b)) - Number(queFaltamPraEle.has(a))),
    [album, queFaltamPraEle],
  );

  const alternar = (conjunto: Set<string>, definir: (s: Set<string>) => void) => (codigo: string) => {
    const novo = new Set(conjunto);
    if (novo.has(codigo)) novo.delete(codigo);
    else if (novo.size < MAX_POR_LADO) novo.add(codigo);
    definir(novo);
  };

  const enviar = async () => {
    if (!sessao) return;
    setErro(null);
    setEnviando(true);
    try {
      const itens = (s: Set<string>) => [...s].map((codigo) => ({ codigo, quantidade: 1 }));
      await api.proporTroca(sessao.token, amigo.id, itens(dou), itens(recebo), respondendo?.id);
      aoEnviar();
    } catch (e) {
      setErro(e instanceof ErroApi || e instanceof Error ? e.message : 'Não foi possível enviar.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={aoFechar}>
      <View style={{ flex: 1, backgroundColor: cores.fundo }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <Text style={estilos.titulo}>{respondendo ? 'Contraproposta' : 'Nova troca'}</Text>
          <Text style={estilos.sub}>com {amigo.apelido} · até {MAX_POR_LADO} figurinhas de cada lado</Text>

          {respondendo && (
            <View style={estilos.caixa}>
              <Text style={estilos.rotulo}>Proposta de {amigo.apelido}</Text>
              <Text style={estilos.legenda}>Oferecia:</Text>
              <MiniFigurinhas itens={respondendo.oferta} />
              <Text style={estilos.legenda}>Pedia:</Text>
              <MiniFigurinhas itens={respondendo.pedido} />
            </View>
          )}

          {carregando ? (
            <ActivityIndicator color={cores.destaque} />
          ) : (
            <>
              <View style={estilos.caixa}>
                <Text style={estilos.rotulo}>Você recebe ({recebo.size}/{MAX_POR_LADO})</Text>
                <Text style={estilos.legenda}>Repetidas de {amigo.apelido} que faltam no seu álbum.</Text>
                <SeletorFigurinhas codigos={recebiveis} marcados={recebo} aoAlternar={alternar(recebo, setRecebo)} />
              </View>
              <View style={estilos.caixa}>
                <Text style={estilos.rotulo}>Você dá ({dou.size}/{MAX_POR_LADO})</Text>
                <Text style={estilos.legenda}>Suas repetidas. "Falta" = {amigo.apelido} ainda não tem.</Text>
                <SeletorFigurinhas
                  codigos={minhasRepetidas}
                  marcados={dou}
                  aoAlternar={alternar(dou, setDou)}
                  destaque={queFaltamPraEle}
                />
              </View>
            </>
          )}
          {erro && (
            <Text style={estilos.erro} accessibilityRole="alert">
              {erro}
            </Text>
          )}
        </ScrollView>
        <View style={estilos.rodape}>
          <Botao
            titulo={respondendo ? 'Enviar contraproposta' : 'Enviar proposta'}
            onPress={enviar}
            carregando={enviando}
            desabilitado={dou.size === 0 || recebo.size === 0}
          />
          <Botao titulo="Cancelar" onPress={aoFechar} variante="secundario" />
        </View>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  titulo: { fontSize: 28, fontWeight: '800', color: cores.tinta, textTransform: 'uppercase' },
  sub: { fontSize: 14, color: cores.apagado, marginTop: -8 },
  caixa: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: cores.borda, padding: 14, gap: 8 },
  rotulo: { fontSize: 13, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: cores.tinta },
  legenda: { fontSize: 13, color: cores.apagado },
  erro: { color: cores.erro, fontWeight: '600', fontSize: 14 },
  rodape: { padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: cores.borda, backgroundColor: cores.fundo },
});
