/**
 * Craques da Várzea — gera as artes das figurinhas com o Cloudflare Workers AI.
 *
 * Para cada linha com "Link da Imagem" vazio: traduz "O que o desenho deve trazer"
 * para inglês (o FLUX entende bem melhor), gera a imagem com o FLUX.1 schnell,
 * salva numa pasta do seu Google Drive (uma subpasta por aba) e escreve o link.
 *
 * Como instalar: veja docs/arte/apps-script/README.md.
 */

const MODELO_IMAGEM = '@cf/black-forest-labs/flux-1-schnell';
const MODELO_TRADUCAO = '@cf/meta/m2m100-1.2b';
const PASSOS = 8; // 4 é mais rápido e barato; 8 (máximo) tem mais detalhe.
// O FLUX não tem "prompt negativo"; isto vai no fim de todo pedido.
const SEM_TEXTO = 'Clean illustration with no text, no letters, no numbers, no logos, no watermark.';
const PASTA_RAIZ = 'Craques da Várzea - Artes (Cloudflare)';
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
    .addItem('1. Configurar conta da Cloudflare', 'configurarChave')
    .addItem('Gerar só a linha selecionada (teste)', 'gerarLinhaSelecionada')
    .addItem('Gerar as que faltam (até 5 min)', 'gerarFaltantes')
    .addSeparator()
    .addItem('Ligar geração automática (a cada 10 min)', 'ligarAutomatico')
    .addItem('Desligar geração automática', 'desligarAutomatico')
    .addToUi();
}

function configurarChave() {
  const ui = SpreadsheetApp.getUi();
  const conta = ui.prompt('Cloudflare (1/2)', 'Account ID (painel da Cloudflare > Workers AI > Use REST API):', ui.ButtonSet.OK_CANCEL);
  if (conta.getSelectedButton() !== ui.Button.OK || !conta.getResponseText().trim()) return;
  const token = ui.prompt('Cloudflare (2/2)', 'API token com permissão "Workers AI" (mesma tela, Create a Workers AI API Token):', ui.ButtonSet.OK_CANCEL);
  if (token.getSelectedButton() !== ui.Button.OK || !token.getResponseText().trim()) return;
  PropertiesService.getUserProperties().setProperties({
    CF_ACCOUNT_ID: conta.getResponseText().trim(),
    CF_API_TOKEN: token.getResponseText().trim(),
  });
  ui.alert('Conta salva só no seu usuário (não fica visível na planilha).');
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
    const prompt = `${traduzir(String(v[cols.descricao]))} ${SEM_TEXTO}`.slice(0, 2048);
    const blob = gerarImagem(prompt).setName(`${codigo}.jpg`);

    const pasta = subpasta(aba.getName());
    for (const antigo of iterar(pasta.getFilesByName(`${codigo}.jpg`))) antigo.setTrashed(true);
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

function chamarCloudflare(modelo, corpo) {
  const p = PropertiesService.getUserProperties();
  const conta = p.getProperty('CF_ACCOUNT_ID');
  const token = p.getProperty('CF_API_TOKEN');
  if (!conta || !token) throw new Error('Configure a conta no menu 🎨 Artes > 1. Configurar conta da Cloudflare.');
  const resp = UrlFetchApp.fetch(`https://api.cloudflare.com/client/v4/accounts/${conta}/ai/run/${modelo}`, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${token}` },
    muteHttpExceptions: true,
    payload: JSON.stringify(corpo),
  });
  let json = {};
  try {
    json = JSON.parse(resp.getContentText() || '{}');
  } catch (e) {
    // resposta não é JSON
  }
  if (resp.getResponseCode() !== 200 || json.success === false) {
    const msg = (json.errors ?? []).map((e) => e.message).join('; ') || resp.getContentText().slice(0, 200);
    throw new Error(`Cloudflare ${resp.getResponseCode()}: ${msg}`);
  }
  return json.result ?? json;
}

/** Português -> inglês. Se a tradução falhar, segue com o texto original. */
function traduzir(texto) {
  try {
    const r = chamarCloudflare(MODELO_TRADUCAO, { text: texto, source_lang: 'portuguese', target_lang: 'english' });
    return r.translated_text || texto;
  } catch (e) {
    console.warn('Tradução falhou, usando o português:', e.message);
    return texto;
  }
}

function gerarImagem(prompt) {
  const r = chamarCloudflare(MODELO_IMAGEM, { prompt, steps: PASSOS });
  if (!r.image) throw new Error('A Cloudflare não devolveu imagem.');
  return Utilities.newBlob(Utilities.base64Decode(r.image), 'image/jpeg');
}

function subpasta(nome) {
  const raiz = pegarOuCriar(DriveApp.getRootFolder(), PASTA_RAIZ);
  return pegarOuCriar(raiz, nome);
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
