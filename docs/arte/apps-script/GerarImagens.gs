/**
 * Craques da Várzea — gera as artes das figurinhas com o Gemini direto da planilha.
 *
 * Para cada linha com "Link da Imagem" vazio, manda "O que o desenho deve trazer"
 * (+ "Evitar") para a API de imagem do Gemini, salva o PNG numa pasta do seu
 * Google Drive (uma subpasta por aba) e escreve o link na coluna.
 *
 * Como instalar: veja docs/arte/apps-script/README.md.
 */

// Modelos tentados em ordem. Se o primeiro não existir mais, usa o seguinte.
const MODELOS = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image'];
const PASTA_RAIZ = 'Craques da Várzea - Artes';
const LIMITE_MS = 5 * 60 * 1000; // o Apps Script corta em 6 min; paramos antes.
const COLUNAS = {
  codigo: 'Código',
  descricao: 'O que o desenho deve trazer',
  evitar: 'Evitar',
  formato: 'Formato',
  link: 'Link da Imagem',
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎨 Artes')
    .addItem('1. Configurar chave do Gemini', 'configurarChave')
    .addItem('Gerar só a linha selecionada (teste)', 'gerarLinhaSelecionada')
    .addItem('Gerar as que faltam (até 5 min)', 'gerarFaltantes')
    .addSeparator()
    .addItem('Ligar geração automática (a cada 10 min)', 'ligarAutomatico')
    .addItem('Desligar geração automática', 'desligarAutomatico')
    .addToUi();
}

function configurarChave() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('Chave da API do Gemini', 'Cole a chave criada em aistudio.google.com/apikey:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const chave = r.getResponseText().trim();
  if (!chave) return;
  PropertiesService.getUserProperties().setProperty('GEMINI_API_KEY', chave);
  ui.alert('Chave salva só na sua conta (não fica visível na planilha).');
}

/** Gera (ou regera) a imagem da linha onde está o cursor. */
function gerarLinhaSelecionada() {
  const aba = SpreadsheetApp.getActiveSheet();
  const linha = aba.getActiveCell().getRow();
  const cols = colunas(aba);
  if (!cols || linha < 2) {
    SpreadsheetApp.getUi().alert('Selecione uma linha de figurinha numa aba de briefing.');
    return;
  }
  const r = gerarLinha(aba, linha, cols);
  SpreadsheetApp.getUi().alert(r.ok ? `Pronto: ${r.codigo}` : `Erro em ${r.codigo}: ${r.erro}`);
}

/** Percorre todas as abas de briefing e gera o que estiver sem link, até o limite de tempo. */
function gerarFaltantes() {
  const inicio = Date.now();
  let feitas = 0;
  let erros = 0;
  let faltam = 0;
  for (const aba of SpreadsheetApp.getActiveSpreadsheet().getSheets()) {
    const cols = colunas(aba);
    if (!cols) continue;
    const valores = aba.getDataRange().getValues();
    for (let i = 1; i < valores.length; i++) {
      if (!valores[i][cols.codigo] || valores[i][cols.link]) continue;
      if (Date.now() - inicio > LIMITE_MS) {
        faltam++;
        continue;
      }
      const r = gerarLinha(aba, i + 1, cols);
      if (r.ok) feitas++;
      else erros++;
    }
  }
  const msg = `Geradas: ${feitas}. Com erro: ${erros} (ver nota na célula). Faltam: ${faltam}.`;
  console.log(msg);
  if (faltam === 0 && erros === 0) desligarAutomatico();
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(msg, 'Artes', 10);
  } catch (e) {
    // Rodando por acionador: sem interface.
  }
}

function ligarAutomatico() {
  desligarAutomatico();
  ScriptApp.newTrigger('gerarFaltantes').timeBased().everyMinutes(10).create();
  SpreadsheetApp.getUi().alert('Ligado: a cada 10 minutos gera o que falta e desliga sozinho quando terminar.');
}

function desligarAutomatico() {
  for (const t of ScriptApp.getProjectTriggers()) {
    if (t.getHandlerFunction() === 'gerarFaltantes') ScriptApp.deleteTrigger(t);
  }
}

// ---------------------------------------------------------------------------

function colunas(aba) {
  const cab = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0].map(String);
  const idx = {};
  for (const [k, nome] of Object.entries(COLUNAS)) idx[k] = cab.indexOf(nome);
  return idx.codigo >= 0 && idx.descricao >= 0 && idx.link >= 0 ? idx : null;
}

function gerarLinha(aba, linha, cols) {
  const v = aba.getRange(linha, 1, 1, aba.getLastColumn()).getValues()[0];
  const codigo = String(v[cols.codigo]).trim();
  const celulaLink = aba.getRange(linha, cols.link + 1);
  try {
    const evitar = cols.evitar >= 0 && v[cols.evitar] ? ` Evite: ${v[cols.evitar]}.` : '';
    const horizontal = cols.formato >= 0 && /horizontal/i.test(String(v[cols.formato]));
    const blob = gerarImagem(`${v[cols.descricao]}${evitar}`, horizontal ? '5:4' : '1:1').setName(`${codigo}.png`);

    const pasta = subpasta(aba.getName(), codigo);
    for (const antigo of iterar(pasta.getFilesByName(`${codigo}.png`))) antigo.setTrashed(true);
    const arquivo = pasta.createFile(blob);
    // Qualquer pessoa com o link pode ver: assim a imagem pode ser baixada para o app.
    arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    celulaLink.setValue(arquivo.getUrl()).setNote(null);
    SpreadsheetApp.flush();
    return { ok: true, codigo };
  } catch (e) {
    celulaLink.setNote(`Erro ${new Date().toLocaleString('pt-BR')}: ${e.message}`);
    console.error(codigo, e.message);
    return { ok: false, codigo, erro: e.message };
  }
}

function gerarImagem(prompt, proporcao) {
  const chave = PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY');
  if (!chave) throw new Error('Configure a chave no menu 🎨 Artes > 1. Configurar chave do Gemini.');
  let ultimoErro = '';
  for (const modelo of MODELOS) {
    const resp = UrlFetchApp.fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
      {
        method: 'post',
        contentType: 'application/json',
        headers: { 'x-goog-api-key': chave },
        muteHttpExceptions: true,
        payload: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: proporcao } },
        }),
      },
    );
    const status = resp.getResponseCode();
    if (status === 404) {
      ultimoErro = `modelo ${modelo} não encontrado`;
      continue;
    }
    const corpo = JSON.parse(resp.getContentText() || '{}');
    if (status !== 200) throw new Error(`Gemini ${status}: ${corpo.error?.message ?? resp.getContentText().slice(0, 200)}`);
    const partes = corpo.candidates?.[0]?.content?.parts ?? [];
    const img = partes.find((p) => p.inlineData?.data);
    if (!img) {
      const motivo = corpo.candidates?.[0]?.finishReason ?? corpo.promptFeedback?.blockReason ?? 'sem imagem na resposta';
      throw new Error(`Gemini não devolveu imagem (${motivo}).`);
    }
    return Utilities.newBlob(Utilities.base64Decode(img.inlineData.data), img.inlineData.mimeType || 'image/png');
  }
  throw new Error(ultimoErro);
}

/** Pasta da imagem: PASTA_RAIZ / Temporada N / aba (a temporada vem do código: T2-FUR-04 → 2). */
function subpasta(nome, codigo) {
  const raiz = pegarOuCriar(DriveApp.getRootFolder(), PASTA_RAIZ);
  const m = /^T(\d+)-/.exec(codigo || '');
  const temporada = pegarOuCriar(raiz, `Temporada ${m ? m[1] : 1}`);
  return pegarOuCriar(temporada, nome);
}

function pegarOuCriar(pai, nome) {
  const it = pai.getFoldersByName(nome);
  return it.hasNext() ? it.next() : pai.createFolder(nome);
}

function iterar(it) {
  const lista = [];
  while (it.hasNext()) lista.push(it.next());
  return lista;
}
