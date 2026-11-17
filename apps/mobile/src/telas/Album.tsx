import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { ErroApi, Figurinha as DadosFigurinha, RecompensaNova } from '../api';
import { Botao } from '../componentes/Botao';
import { Escudo } from '../componentes/Escudo';
import { EspacoVazio, Figurinha } from '../componentes/Figurinha';
import { AvisoRecompensas } from '../componentes/Recompensas';
import { useJogo } from '../jogo';
import { cores, estiloRaridade } from '../tema';

const ROTULO_TIPO: Record<string, string> = {
  ESCUDO: 'Escudo',
  ESTADIO: 'Estádio',
  TECNICO: 'Técnico',
  MASCOTE: 'Mascote',
  LENDA: 'Lenda',
  MOMENTO: 'Momento',
};

export function Album({ secaoInicial }: { secaoInicial?: string }) {
  const { figurinhas, clubes, album, perfil } = useJogo();
  const paginasCompletas = useMemo(
    () => new Set((perfil?.recompensas ?? []).filter((r) => r.tipo === 'PAGINA').map((r) => r.chave)),
    [perfil],
  );
  const { width } = useWindowDimensions();
  const secoes = useMemo(() => [...new Set(figurinhas.map((f) => f.secao))], [figurinhas]);
  const [secao, setSecao] = useState(secaoInicial ?? secoes[0]);
  const [aberta, setAberta] = useState<DadosFigurinha | null>(null);

  const tenho = useMemo(() => Object.fromEntries((album?.itens ?? []).map((i) => [i.codigo, i])), [album]);
  const daSecao = figurinhas.filter((f) => f.secao === secao);
  const coladasSecao = daSecao.filter((f) => tenho[f.codigo]).length;
  const largura = (width - 16 * 2 - 10 * 2) / 3;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={estilos.abas}
        accessibilityRole="tablist"
        style={{ flexGrow: 0 }}
      >
        {secoes.map((s) => {
          const clube = Object.values(clubes).find((c) => c.nome === s);
          const ativa = s === secao;
          return (
            <Pressable
              key={s}
              accessibilityRole="tab"
              accessibilityState={{ selected: ativa }}
              accessibilityLabel={paginasCompletas.has(s) ? `${s}, página completa` : s}
              onPress={() => setSecao(s)}
              style={[estilos.aba, ativa && estilos.abaAtiva]}
            >
              {paginasCompletas.has(s) && (
                <View style={estilos.selo}>
                  <Text style={estilos.seloTexto}>✓</Text>
                </View>
              )}
              {clube ? (
                <Escudo sigla={clube.sigla} tamanho={30} />
              ) : (
                <Text style={[estilos.abaTexto, ativa && { color: '#FFFFFF' }]}>{s === 'Lendas da Liga' ? 'Lendas' : 'Momentos'}</Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View style={estilos.cabecalho}>
          <Text style={estilos.titulo}>{secao}</Text>
          <Text style={estilos.progresso}>
            {coladasSecao} de {daSecao.length} coladas
            {paginasCompletas.has(secao) ? ' · página completa, recompensa recebida' : ' · complete a página e ganhe 1 pacote'}
          </Text>
        </View>
        <View style={estilos.grade}>
          {daSecao.map((f) => {
            const item = tenho[f.codigo];
            const rotulo = f.posicao && f.tipo === 'JOGADOR' ? f.posicao : ROTULO_TIPO[f.tipo] ?? f.tipo;
            return (
              <Pressable key={f.codigo} onPress={() => setAberta(f)} accessibilityRole="button" accessibilityHint="Abre os detalhes">
                {item ? (
                  <View>
                    <Figurinha figurinha={f} clube={clubes[f.clubeSigla]} largura={largura} brilhante={item.brilhantes > 0} />
                    {item.quantidade > 1 && (
                      <View style={estilos.repetidas} accessible accessibilityLabel={`${item.quantidade - 1} repetidas`}>
                        <Text style={estilos.repetidasTexto}>+{item.quantidade - 1}</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <EspacoVazio codigo={f.codigo} rotulo={rotulo} largura={largura} />
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {aberta && <Detalhe figurinha={aberta} aoFechar={() => setAberta(null)} />}
    </View>
  );
}

function Detalhe({ figurinha: f, aoFechar }: { figurinha: DadosFigurinha; aoFechar: () => void }) {
  const { clubes, album, trocarNoBalcao } = useJogo();
  const { width } = useWindowDimensions();
  const [trocando, setTrocando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ganhas, setGanhas] = useState<RecompensaNova[]>([]);
  const item = album?.itens.find((i) => i.codigo === f.codigo);
  const r = estiloRaridade[f.raridade];
  const custo = album?.balcao.repetidasPorNova ?? 4;
  const repetidas = album?.repetidas[f.raridade] ?? 0;

  const trocar = async () => {
    setErro(null);
    setTrocando(true);
    try {
      setGanhas(await trocarNoBalcao(f.codigo));
    } catch (e) {
      setErro(e instanceof ErroApi || e instanceof Error ? e.message : 'Não foi possível trocar.');
    } finally {
      setTrocando(false);
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={aoFechar} presentationStyle="pageSheet">
      <ScrollView style={{ backgroundColor: cores.fundo }} contentContainerStyle={{ padding: 20, gap: 16, alignItems: 'center' }}>
        {item ? (
          <Figurinha figurinha={f} clube={clubes[f.clubeSigla]} largura={Math.min(300, width - 80)} brilhante={item.brilhantes > 0} />
        ) : (
          <EspacoVazio codigo={f.codigo} rotulo={r.nome} largura={Math.min(220, width - 120)} />
        )}

        <View style={{ alignSelf: 'stretch' }}>
          <AvisoRecompensas recompensas={ganhas} />
        </View>
        <View style={{ alignSelf: 'stretch', gap: 8 }}>
          <Text style={estilos.detalheTitulo}>{item ? f.apelido ?? f.nome : `${f.codigo} · ${r.nome}`}</Text>
          {item ? (
            <>
              <Text style={estilos.detalheTexto}>{f.historia}</Text>
              {f.destaque && <Text style={estilos.detalheDestaque}>{f.destaque}</Text>}
              <Text style={estilos.detalheMeta}>
                Você tem {item.quantidade} {item.quantidade === 1 ? 'cópia' : 'cópias'}
                {item.brilhantes > 0 ? `, ${item.brilhantes} brilhante${item.brilhantes > 1 ? 's' : ''}` : ''}.
              </Text>
            </>
          ) : (
            <>
              <Text style={estilos.detalheTexto}>Você ainda não tem esta figurinha. Ela pode vir num pacote, numa troca ou no balcão.</Text>
              <View style={estilos.balcao}>
                <Text style={estilos.balcaoTitulo}>Balcão de repetidas</Text>
                <Text style={estilos.detalheTexto}>
                  Troque {custo} repetidas {r.nome === 'Épica' ? 'Épicas' : `${r.nome}s`} por esta figurinha. Você tem {repetidas}.
                </Text>
                {erro && (
                  <Text style={{ color: cores.erro, fontWeight: '600' }} accessibilityRole="alert">
                    {erro}
                  </Text>
                )}
                <Botao
                  titulo={`Trocar ${custo} repetidas`}
                  onPress={trocar}
                  carregando={trocando}
                  desabilitado={repetidas < custo}
                />
              </View>
            </>
          )}
        </View>
        <View style={{ alignSelf: 'stretch' }}>
          <Botao titulo="Fechar" onPress={aoFechar} variante="secundario" />
        </View>
      </ScrollView>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  abas: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  aba: {
    minWidth: 48,
    height: 48,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: cores.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  abaAtiva: { borderColor: cores.destaque, borderWidth: 2, backgroundColor: cores.destaque },
  selo: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FBBF24',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  seloTexto: { fontSize: 11, fontWeight: '800', color: cores.tinta },
  abaTexto: { fontSize: 13, fontWeight: '700', color: cores.tinta },
  cabecalho: { gap: 2 },
  titulo: { fontSize: 26, fontWeight: '800', color: cores.tinta, textTransform: 'uppercase' },
  progresso: { fontSize: 14, color: cores.apagado },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  repetidas: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: cores.destaque,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: cores.fundo,
  },
  repetidasTexto: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  detalheTitulo: { fontSize: 24, fontWeight: '800', color: cores.tinta, textTransform: 'uppercase' },
  detalheTexto: { fontSize: 15, lineHeight: 22, color: cores.tinta },
  detalheDestaque: { fontSize: 13, fontWeight: '700', color: cores.apagado, textTransform: 'uppercase', letterSpacing: 1 },
  detalheMeta: { fontSize: 14, color: cores.apagado },
  balcao: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: cores.borda, padding: 16, gap: 10, marginTop: 6 },
  balcaoTitulo: { fontSize: 13, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: cores.apagado },
});
