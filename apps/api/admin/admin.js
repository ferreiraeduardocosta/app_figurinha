'use strict';
/*
 * Painel de administração da Liga Aurora.
 * JavaScript puro, sem build. Todo dado vindo da API entra na página como texto
 * (textContent), nunca como HTML, para evitar injeção de código.
 * O token fica em sessionStorage: some ao fechar a aba.
 */

const CHAVE_TOKEN = 'liga-aurora.admin.token';
const RARIDADES = { COMUM: 'Comum', RARA: 'Rara', EPICA: 'Épica', LENDARIA: 'Lendária' };
const TIPOS = { ESCUDO: 'Escudo', ESTADIO: 'Estádio', TECNICO: 'Técnico', JOGADOR: 'Jogador', MASCOTE: 'Mascote', LENDA: 'Lenda', MOMENTO: 'Momento' };
const POSICOES = ['', 'GOL', 'ZAG', 'LAT', 'VOL', 'MEI', 'PON', 'ATA', 'TEC'];
const ATRIBUTOS = [['ataque', 'ATA'], ['defesa', 'DEF'], ['tecnica', 'TEC'], ['velocidade', 'VEL'], ['fisico', 'FIS']];
const ACOES = { CRIAR: 'Criou', EDITAR: 'Editou', EXCLUIR: 'Excluiu' };

const estado = { usuario: null, aba: 'resumo', figurinhas: [], clubes: [], filtros: { busca: '', secao: '', raridade: '', tipo: '' } };

/* ---------- utilidades ---------- */

/** Cria um elemento. Filhos string viram nós de texto. */
function h(tag, atributos, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(atributos || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const f of filhos.flat()) {
    if (f === null || f === undefined || f === false) continue;
    el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return el;
}

const app = () => document.getElementById('app');
const token = () => sessionStorage.getItem(CHAVE_TOKEN);
const pct = (x) => (x * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
const data = (iso) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const geral = (f) => {
  const v = ATRIBUTOS.map(([k]) => f[k]);
  return v.some((x) => x == null) ? '' : Math.round(v.reduce((s, x) => s + x, 0) / 5);
};

class ErroApi extends Error {
  constructor(status, corpo) {
    super((corpo && (corpo.mensagem || corpo.message)) || 'Algo deu errado.');
    this.status = status;
    this.campo = corpo && corpo.campo;
  }
}

async function api(metodo, rota, corpo) {
  const r = await fetch(rota, {
    method: metodo,
    headers: { 'content-type': 'application/json', ...(token() ? { authorization: 'Bearer ' + token() } : {}) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await r.text();
  const dados = texto ? JSON.parse(texto) : null;
  if (r.status === 401) {
    sessionStorage.removeItem(CHAVE_TOKEN);
    estado.usuario = null;
    telaLogin('Sua sessão expirou. Entre de novo.');
    throw new ErroApi(401, dados);
  }
  if (!r.ok) throw new ErroApi(r.status, dados);
  return dados;
}

/* ---------- login ---------- */

function telaLogin(mensagem) {
  const erro = h('p', { class: 'erro', role: 'alert', hidden: !mensagem }, mensagem || '');
  const email = h('input', { type: 'email', name: 'email', autocomplete: 'username', required: true });
  const senha = h('input', { type: 'password', name: 'senha', autocomplete: 'current-password', required: true });
  const botao = h('button', { class: 'botao', type: 'submit' }, 'Entrar');
  const form = h(
    'form',
    {
      class: 'login',
      onsubmit: async (e) => {
        e.preventDefault();
        botao.disabled = true;
        erro.hidden = true;
        try {
          const r = await api('POST', '/auth/entrar', { email: email.value.trim(), senha: senha.value });
          if (r.usuario.papel !== 'ADMIN') {
            await fetch('/auth/sair', { method: 'POST', headers: { authorization: 'Bearer ' + r.token } });
            throw new Error('Esta conta não é de administrador.');
          }
          sessionStorage.setItem(CHAVE_TOKEN, r.token);
          estado.usuario = r.usuario;
          await iniciar();
        } catch (err) {
          erro.textContent = err.message;
          erro.hidden = false;
        } finally {
          botao.disabled = false;
        }
      },
    },
    h('p', { class: 'sobretitulo' }, 'Liga Aurora'),
    h('h1', {}, 'Painel'),
    h('p', { class: 'aviso' }, 'Acesso restrito a administradores.'),
    h('label', {}, 'E-mail', email),
    h('label', {}, 'Senha', senha),
    erro,
    botao,
  );
  app().replaceChildren(form);
  email.focus();
}

/* ---------- estrutura ---------- */

const ABAS = [
  ['resumo', 'Resumo'],
  ['figurinhas', 'Figurinhas'],
  ['alteracoes', 'Alterações'],
  ['usuarios', 'Usuários'],
];

function estrutura() {
  const sair = h('button', {
    class: 'botao secundario',
    type: 'button',
    onclick: async () => {
      await api('POST', '/auth/sair').catch(() => undefined);
      sessionStorage.removeItem(CHAVE_TOKEN);
      telaLogin('Você saiu do painel.');
    },
  }, 'Sair');
  const nav = h('nav', { class: 'abas', role: 'tablist', 'aria-label': 'Seções do painel' },
    ABAS.map(([id, nome]) =>
      h('button', {
        type: 'button',
        role: 'tab',
        id: 'aba-' + id,
        'aria-selected': String(estado.aba === id),
        'aria-controls': 'conteudo',
        onclick: () => trocarAba(id),
      }, nome),
    ),
  );
  app().replaceChildren(
    h('header', { class: 'topo' },
      h('span', { class: 'marca' }, 'Liga Aurora · Painel'),
      h('span', { class: 'quem' }, estado.usuario ? estado.usuario.apelido : '', sair),
    ),
    nav,
    h('section', { class: 'conteudo', id: 'conteudo', role: 'tabpanel', 'aria-labelledby': 'aba-' + estado.aba }),
  );
}

async function trocarAba(id) {
  estado.aba = id;
  estrutura();
  const alvo = document.getElementById('conteudo');
  alvo.replaceChildren(h('p', { class: 'carregando' }, 'Carregando…'));
  try {
    const telas = { resumo: telaResumo, figurinhas: telaFigurinhas, alteracoes: telaAlteracoes, usuarios: telaUsuarios };
    await telas[id](alvo);
  } catch (err) {
    if (err.status !== 401) alvo.replaceChildren(h('p', { class: 'erro', role: 'alert' }, err.message));
  }
}

/* ---------- resumo ---------- */

async function telaResumo(alvo) {
  const r = await api('GET', '/admin/resumo');
  const cartao = (rotulo, numero) =>
    h('div', { class: 'cartao' }, h('div', { class: 'rotulo' }, rotulo), h('div', { class: 'numero' }, numero.toLocaleString('pt-BR')));
  const s = r.sorteio;
  const linhas = s.porRaridade.map((x) => {
    const dif = (x.observado - x.esperado) * 100;
    // Com poucas figurinhas sorteadas, diferenças grandes são normais.
    const amostraBoa = s.figurinhasSorteadas >= 2000;
    const alta = amostraBoa && Math.abs(dif) > 2;
    return h('tr', {},
      h('td', {}, h('span', { class: 'chip ' + x.raridade }, RARIDADES[x.raridade])),
      h('td', { class: 'num' }, x.quantidade.toLocaleString('pt-BR')),
      h('td', { class: 'num' }, pct(x.observado)),
      h('td', { class: 'num' }, pct(x.esperado)),
      h('td', { class: 'num ' + (!amostraBoa ? '' : alta ? 'diferenca-alta' : 'diferenca-ok') }, (dif >= 0 ? '+' : '') + dif.toFixed(1) + ' p.p.'),
    );
  });
  const brilhantesObs = s.figurinhasSorteadas ? s.brilhantes / s.figurinhasSorteadas : 0;
  alvo.replaceChildren(
    h('h2', {}, 'Resumo'),
    h('div', { class: 'cartoes' },
      cartao('Jogadores', r.usuarios),
      cartao('Pacotes abertos', r.aberturas),
      cartao('Pacotes hoje', r.aberturasHoje),
      cartao('Figurinhas no álbum', r.figurinhasNoCatalogo),
      cartao('Páginas completadas', r.paginasCompletas),
      cartao('Álbuns completos', r.albunsCompletos),
      cartao('Trocas feitas', r.trocasFeitas),
      cartao('Compras', r.loja.compras),
      h('div', { class: 'cartao' },
        h('div', { class: 'rotulo' }, 'Receita bruta'),
        h('div', { class: 'numero' }, (r.loja.receitaCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })),
        h('div', { class: 'sub' }, `${r.loja.estornos} estorno(s) · antes da comissão das lojas`)),
    ),
    h('h2', {}, 'Conferência do sorteio'),
    h('p', { class: 'aviso' },
      `${s.figurinhasSorteadas.toLocaleString('pt-BR')} figurinhas sorteadas. A tabela não conta as ${s.garantidas.toLocaleString('pt-BR')} que vieram da garantia mínima. ` +
      'Diferenças só são destacadas a partir de 2.000 figurinhas sorteadas; antes disso, variação grande é normal.'),
    h('div', { class: 'caixa-tabela' },
      h('table', {},
        h('thead', {}, h('tr', {},
          h('th', {}, 'Raridade'), h('th', { class: 'num' }, 'Saíram'), h('th', { class: 'num' }, 'Observado'),
          h('th', { class: 'num' }, 'Esperado'), h('th', { class: 'num' }, 'Diferença'))),
        h('tbody', {}, linhas,
          h('tr', {},
            h('td', {}, 'Brilhante'),
            h('td', { class: 'num' }, s.brilhantes.toLocaleString('pt-BR')),
            h('td', { class: 'num' }, pct(brilhantesObs)),
            h('td', { class: 'num' }, pct(s.brilhanteEsperado)),
            h('td', { class: 'num' }, ((brilhantesObs - s.brilhanteEsperado) * 100 >= 0 ? '+' : '') + ((brilhantesObs - s.brilhanteEsperado) * 100).toFixed(1) + ' p.p.'),
          )),
      ),
    ),
  );
}

/* ---------- figurinhas ---------- */

async function telaFigurinhas(alvo) {
  const [figurinhas, clubes] = await Promise.all([api('GET', '/admin/figurinhas'), api('GET', '/clubes')]);
  estado.figurinhas = figurinhas;
  estado.clubes = clubes;
  const secoes = [...new Set(figurinhas.map((f) => f.secao))];
  const f = estado.filtros;

  const corpoTabela = h('tbody');
  const contagem = h('p', { class: 'contagem', role: 'status' });

  const desenhar = () => {
    const termo = f.busca.trim().toLowerCase();
    const lista = estado.figurinhas.filter((x) =>
      (!f.secao || x.secao === f.secao) &&
      (!f.raridade || x.raridade === f.raridade) &&
      (!f.tipo || x.tipo === f.tipo) &&
      (!termo || [x.codigo, x.nome, x.apelido || ''].some((t) => t.toLowerCase().includes(termo))),
    );
    contagem.textContent = `${lista.length} de ${estado.figurinhas.length} figurinhas`;
    corpoTabela.replaceChildren(...lista.map((x) => h('tr', {
      class: 'clicavel',
      tabindex: '0',
      'aria-label': `Editar ${x.codigo} ${x.nome}`,
      onclick: () => abrirEditor(x),
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirEditor(x); } },
    },
      h('td', { class: 'num' }, x.numero),
      h('td', { class: 'codigo' }, x.codigo),
      h('td', {}, x.apelido ? x.apelido : x.nome, x.apelido ? h('span', { class: 'sub' }, x.nome) : null),
      h('td', {}, x.secao),
      h('td', {}, TIPOS[x.tipo]),
      h('td', {}, h('span', { class: 'chip ' + x.raridade }, RARIDADES[x.raridade])),
      h('td', { class: 'num' }, geral(x)),
      h('td', { class: 'num' }, x.donos),
    )));
  };

  const filtro = (rotulo, chave, opcoes) => h('label', {}, rotulo,
    h('select', { onchange: (e) => { f[chave] = e.target.value; desenhar(); } },
      h('option', { value: '' }, 'Todas'),
      opcoes.map(([v, t]) => h('option', { value: v, selected: f[chave] === v }, t)),
    ));

  alvo.replaceChildren(
    h('h2', {}, 'Figurinhas'),
    h('div', { class: 'filtros' },
      h('label', {}, 'Buscar', h('input', {
        type: 'search', value: f.busca, placeholder: 'Código, nome ou apelido',
        oninput: (e) => { f.busca = e.target.value; desenhar(); },
      })),
      filtro('Seção', 'secao', secoes.map((s) => [s, s])),
      filtro('Raridade', 'raridade', Object.entries(RARIDADES)),
      filtro('Tipo', 'tipo', Object.entries(TIPOS)),
      h('button', { class: 'botao', type: 'button', onclick: () => abrirEditor(null) }, 'Nova figurinha'),
    ),
    contagem,
    h('div', { class: 'caixa-tabela' },
      h('table', {},
        h('thead', {}, h('tr', {},
          h('th', { class: 'num' }, 'Nº'), h('th', {}, 'Código'), h('th', {}, 'Nome'), h('th', {}, 'Seção'),
          h('th', {}, 'Tipo'), h('th', {}, 'Raridade'), h('th', { class: 'num' }, 'Geral'), h('th', { class: 'num' }, 'Donos'))),
        corpoTabela,
      ),
    ),
  );
  desenhar();
}

function abrirEditor(fig) {
  const nova = !fig;
  const v = fig || { tipo: 'JOGADOR', raridade: 'COMUM' };
  const campos = {};
  const campo = (rotulo, nome, el) => { campos[nome] = el; el.name = nome; return h('label', {}, rotulo, el); };
  const entrada = (valor, extra) => h('input', { value: valor ?? '', ...extra });
  const escolha = (valor, opcoes) => h('select', {}, opcoes.map(([o, t]) => h('option', { value: o, selected: (valor ?? '') === o }, t)));

  const erro = h('p', { class: 'erro', role: 'alert', hidden: true });
  const avisoRaridade = h('p', { class: 'aviso', hidden: true },
    'Atenção: mudar a raridade muda a chance desta figurinha nos próximos pacotes.');

  const identificacao = nova
    ? h('div', { class: 'grade-campos' },
        campo('Código', 'codigo', entrada('', { placeholder: 'ABC-16', maxlength: 6, required: true })),
        campo('Número no álbum', 'numero', entrada('', { type: 'number', min: 1, max: 9999, required: true })),
        campo('Clube', 'clubeSigla', escolha('', estado.clubes.map((c) => [c.sigla, c.nome]))),
        campo('Seção do álbum', 'secao', entrada(estado.clubes[0] ? estado.clubes[0].nome : '', { maxlength: 60, required: true })),
      )
    : h('p', { class: 'aviso' }, `${v.codigo} · nº ${v.numero} · ${v.secao}. ${v.donos} jogador(es) têm esta figurinha.`);

  // Ao trocar o clube de uma figurinha nova, a seção acompanha (se ainda for o nome de um clube).
  if (nova) {
    campos.clubeSigla.addEventListener('change', () => {
      const nomes = estado.clubes.map((c) => c.nome);
      if (!campos.secao.value || nomes.includes(campos.secao.value)) {
        const clube = estado.clubes.find((c) => c.sigla === campos.clubeSigla.value);
        if (clube) campos.secao.value = clube.nome;
      }
    });
  }

  const raridade = escolha(v.raridade, Object.entries(RARIDADES));
  raridade.addEventListener('change', () => { avisoRaridade.hidden = nova || raridade.value === fig.raridade; });

  const form = h('form', { method: 'dialog', novalidate: true },
    h('h2', {}, nova ? 'Nova figurinha' : `Editar ${v.codigo}`),
    identificacao,
    h('div', { class: 'grade-campos' },
      campo('Nome', 'nome', entrada(v.nome, { maxlength: 60, required: true })),
      campo('Apelido', 'apelido', entrada(v.apelido, { maxlength: 30 })),
      campo('Tipo', 'tipo', escolha(v.tipo, Object.entries(TIPOS))),
      campo('Raridade', 'raridade', raridade),
      campo('Posição', 'posicao', escolha(v.posicao, POSICOES.map((p) => [p, p || '—']))),
      campo('Camisa', 'camisa', entrada(v.camisa, { type: 'number', min: 1, max: 99 })),
      campo('Idade', 'idade', entrada(v.idade, { type: 'number', min: 15, max: 80 })),
    ),
    avisoRaridade,
    h('fieldset', {},
      h('legend', {}, 'Atributos (30 a 99; deixe os 5 vazios para figurinhas sem atributos)'),
      h('div', { class: 'grade-atributos' },
        ATRIBUTOS.map(([k, sigla]) => campo(sigla, k, entrada(v[k], { type: 'number', min: 30, max: 99 })))),
    ),
    campo('Traço especial / destaque', 'destaque', entrada(v.destaque, { maxlength: 120 })),
    campo('Mini-história', 'historia', h('textarea', { maxlength: 500, required: true }, v.historia || '')),
    campo('Descrição visual (briefing de arte)', 'descricaoVisual', h('textarea', { maxlength: 500, required: true }, v.descricaoVisual || '')),
    erro,
  );

  const dialogo = h('dialog', { 'aria-label': nova ? 'Nova figurinha' : `Editar ${v.codigo}` }, form);
  const fechar = () => { dialogo.close(); dialogo.remove(); };

  const lerCampos = () => {
    const numero = (x) => (x.value === '' ? null : Number(x.value));
    const textoOuNulo = (x) => (x.value.trim() === '' ? null : x.value);
    const corpo = {
      nome: campos.nome.value,
      apelido: textoOuNulo(campos.apelido),
      tipo: campos.tipo.value,
      raridade: campos.raridade.value,
      posicao: campos.posicao.value || null,
      camisa: numero(campos.camisa),
      idade: numero(campos.idade),
      destaque: textoOuNulo(campos.destaque),
      historia: campos.historia.value,
      descricaoVisual: campos.descricaoVisual.value,
    };
    for (const [k] of ATRIBUTOS) corpo[k] = numero(campos[k]);
    if (nova) {
      corpo.codigo = campos.codigo.value;
      corpo.numero = numero(campos.numero);
      corpo.clubeSigla = campos.clubeSigla.value;
      corpo.secao = campos.secao.value;
    }
    return corpo;
  };

  const salvar = h('button', {
    class: 'botao',
    type: 'submit',
    onclick: async (e) => {
      e.preventDefault();
      erro.hidden = true;
      salvar.disabled = true;
      try {
        if (nova) await api('POST', '/admin/figurinhas', lerCampos());
        else await api('PATCH', '/admin/figurinhas/' + encodeURIComponent(v.codigo), lerCampos());
        fechar();
        await trocarAba('figurinhas');
      } catch (err) {
        erro.textContent = err.message;
        erro.hidden = false;
        if (err.campo && campos[err.campo]) campos[err.campo].focus();
      } finally {
        salvar.disabled = false;
      }
    },
  }, nova ? 'Criar' : 'Salvar');

  const excluir = nova ? null : h('button', {
    class: 'botao perigo esquerda',
    type: 'button',
    disabled: v.donos > 0,
    title: v.donos > 0 ? 'Jogadores já têm esta figurinha' : undefined,
    onclick: async () => {
      if (!confirm(`Excluir ${v.codigo} (${v.nome})? Isso não pode ser desfeito.`)) return;
      try {
        await api('DELETE', '/admin/figurinhas/' + encodeURIComponent(v.codigo));
        fechar();
        await trocarAba('figurinhas');
      } catch (err) {
        erro.textContent = err.message;
        erro.hidden = false;
      }
    },
  }, 'Excluir');

  form.append(h('div', { class: 'acoes' },
    excluir,
    h('button', { class: 'botao secundario', type: 'button', onclick: fechar }, 'Cancelar'),
    salvar,
  ));
  dialogo.addEventListener('cancel', () => dialogo.remove());
  document.body.append(dialogo);
  dialogo.showModal();
}

/* ---------- alterações ---------- */

async function telaAlteracoes(alvo) {
  const lista = await api('GET', '/admin/alteracoes');
  const mudancas = (a) => {
    if (a.acao !== 'EDITAR') return a.acao === 'CRIAR' ? 'Figurinha criada' : 'Figurinha excluída';
    return h('ul', { class: 'mudancas' },
      Object.keys(a.depois || {}).map((k) =>
        h('li', {}, h('strong', {}, k + ': '), String(a.antes?.[k] ?? '—'), ' → ', String(a.depois[k] ?? '—'))));
  };
  alvo.replaceChildren(
    h('h2', {}, 'Alterações'),
    h('p', { class: 'aviso' }, 'As 100 alterações mais recentes feitas no painel.'),
    lista.length === 0
      ? h('p', { class: 'contagem' }, 'Nenhuma alteração ainda.')
      : h('div', { class: 'caixa-tabela' },
          h('table', {},
            h('thead', {}, h('tr', {}, h('th', {}, 'Quando'), h('th', {}, 'Quem'), h('th', {}, 'Ação'), h('th', {}, 'Figurinha'), h('th', {}, 'Mudanças'))),
            h('tbody', {}, lista.map((a) => h('tr', {},
              h('td', {}, data(a.criadoEm)),
              h('td', {}, a.adminApelido),
              h('td', {}, ACOES[a.acao]),
              h('td', { class: 'codigo' }, a.figurinhaCodigo),
              h('td', {}, mudancas(a)),
            ))),
          )),
  );
}

/* ---------- usuários ---------- */

async function telaUsuarios(alvo) {
  const corpo = h('tbody');
  const contagem = h('p', { class: 'contagem', role: 'status' });
  let espera;
  const carregar = async (busca) => {
    const lista = await api('GET', '/admin/usuarios' + (busca ? '?busca=' + encodeURIComponent(busca) : ''));
    contagem.textContent = lista.length === 50 ? 'Mostrando os 50 mais recentes' : `${lista.length} jogador(es)`;
    corpo.replaceChildren(...lista.map((u) => h('tr', {},
      h('td', {}, u.apelido, u.papel === 'ADMIN' ? [' ', h('span', { class: 'chip ADMIN' }, 'Admin')] : null),
      h('td', {}, u.email),
      h('td', { class: 'num' }, u.coladas),
      h('td', { class: 'num' }, u.pacotesAbertos),
      h('td', { class: 'num' }, u.moedas),
      h('td', {}, data(u.criadoEm)),
    )));
  };
  alvo.replaceChildren(
    h('h2', {}, 'Usuários'),
    h('div', { class: 'filtros' },
      h('label', {}, 'Buscar', h('input', {
        type: 'search', placeholder: 'Apelido ou e-mail',
        oninput: (e) => { clearTimeout(espera); espera = setTimeout(() => carregar(e.target.value).catch(() => undefined), 300); },
      }))),
    contagem,
    h('div', { class: 'caixa-tabela' },
      h('table', {},
        h('thead', {}, h('tr', {}, h('th', {}, 'Apelido'), h('th', {}, 'E-mail'), h('th', { class: 'num' }, 'Coladas'),
          h('th', { class: 'num' }, 'Pacotes'), h('th', { class: 'num' }, 'Moedas'), h('th', {}, 'Cadastro'))),
        corpo)),
  );
  await carregar('');
}

/* ---------- início ---------- */

async function iniciar() {
  if (!token()) return telaLogin();
  try {
    // Confere se o token ainda vale e se é de admin.
    await api('GET', '/admin/resumo');
  } catch (err) {
    if (err.status === 403) {
      sessionStorage.removeItem(CHAVE_TOKEN);
      return telaLogin('Esta conta não é de administrador.');
    }
    if (err.status !== 401) return telaLogin(err.message);
    return;
  }
  if (!estado.usuario) {
    const eu = await api('GET', '/eu');
    estado.usuario = { apelido: eu.apelido };
  }
  await trocarAba(estado.aba);
}

iniciar();
