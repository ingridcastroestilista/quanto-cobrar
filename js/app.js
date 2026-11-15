import * as store from './store.js';
import { GRUPOS, SUGESTOES_MATERIAL, SUGESTOES_EXTRA, uid, novoRascunho } from './store.js';
import {
  custoDaHora, calcPeca, composicao, taxaVenda, alocarPagamentos, ordenarParcelas, planoMaterial,
  entradaMinima, gerarParcelas, resumoMes, dadosVenda, hojeISO, somaMeses, mesDe,
} from './calc.js';
import {
  esc, brl, pct, num, horasTxt, dataBR, mesNome, mesCurto, maiuscula, campo, campoUn, linha, segmentado, barra, frase,
  lerCampo, valorCampo, toast,
} from './ui.js';
import { novaProposta, formasDePagamento, textoProposta, canvasProposta, pngDe, pdfDe, prepararLogo, validoAte } from './proposta.js';

const S = () => store.get();
const $main = document.getElementById('main');
const MARGEM_MIN = 0.2;

// Estado só da tela (não é guardado).
const ui = { busca: '', filtro: 'todos', mes: mesDe(hojeISO()), fechar: null, editParcelas: false, novoItem: '' };

// ---------- Caminhos de dados (data-bind) ----------
// 'custo.despesas#ID.valor' → state.custo.despesas.find(id).valor ; 'ui.x' → estado da tela

function resolver(caminho) {
  const partes = caminho.split('.');
  let alvo = partes[0] === 'ui' ? ui : S();
  if (partes[0] === 'ui') partes.shift();
  for (let i = 0; i < partes.length - 1; i++) {
    const [k, id] = partes[i].split('#');
    alvo = alvo[k];
    if (id) alvo = alvo.find((x) => x.id === id);
    if (!alvo) return null;
  }
  return { alvo, chave: partes[partes.length - 1], doUi: caminho.startsWith('ui.') };
}

function setPath(caminho, valor) {
  const r = resolver(caminho);
  if (!r) return;
  r.alvo[r.chave] = valor;
  // Tempo de uma etapa vira o "meu tempo" padrão para as próximas peças.
  const m = caminho.match(/^rascunho\.etapas#([^.]+)\.min$/);
  if (m) {
    const e = S().etapas.find((x) => x.id === m[1]);
    if (e) e.min = valor;
  }
  if (caminho.startsWith('custo.')) S().custo.atualizadoEm = new Date().toISOString();
  if (!r.doUi) store.salvar();
}

// ---------- Cálculos usados pelas telas ----------

const custoAtual = () => custoDaHora(S().custo);
const rascunho = () => (S().rascunho ||= novoRascunho(S()));
const chDoRascunho = (r) => r.custoFixo || custoAtual();
const calcOrc = (o) => calcPeca(o.snap, o.snap);

// ---------- Roteamento ----------

const telas = {};
let telaAtual = null;

function rota() {
  const [nome, id] = (location.hash.replace(/^#\/?/, '') || 'inicio').split('/');
  return { nome: telas[nome] ? nome : 'inicio', id };
}

function render() {
  const { nome, id } = rota();
  telaAtual = telas[nome];
  $main.innerHTML = telaAtual.render(id);
  atualizar();
  telaAtual.depois?.(id);
  document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('ativo', a.dataset.tela === (telaAtual.aba || nome)));
  document.body.dataset.tela = nome;
}

function atualizar() {
  if (!telaAtual?.saidas) return;
  const { id } = rota();
  const out = telaAtual.saidas(id) || {};
  document.querySelectorAll('[data-out]').forEach((el) => { if (el.dataset.out in out) el.textContent = out[el.dataset.out]; });
  document.querySelectorAll('[data-html]').forEach((el) => { if (el.dataset.html in out) el.innerHTML = out[el.dataset.html]; });
}

const ir = (h) => { if (location.hash === h) render(); else location.hash = h; };

// ---------- Componentes ----------

const cab = (titulo, sub = '', voltar = '') => `
  <header class="topo">
    ${voltar ? `<a class="voltar" href="${voltar}" aria-label="Voltar">‹</a>` : ''}
    <div><h1>${titulo}</h1>${sub ? `<p>${sub}</p>` : ''}</div>
  </header>`;

const cartao = (conteudo, cls = '') => `<section class="cartao ${cls}">${conteudo}</section>`;

const STATUS = { enviado: 'Enviado', fechado: 'Fechado', recusado: 'Recusado' };
const pill = (s) => `<span class="pill pill-${s}">${STATUS[s] || s}</span>`;

function itemOrc(o) {
  const r = calcOrc(o);
  const valor = o.status === 'fechado' ? o.fechamento.valor : r.preco;
  return `<a class="orc" href="#/orcamento/${o.id}">
    <div><b>${esc(o.cliente || 'Sem nome')}</b><span>${esc(o.peca || 'Peça')} · ${dataBR(hojeISO(new Date(o.criadoEm)))}</span></div>
    <div class="orc-dir"><b>${brl(valor)}</b>${pill(o.status)}</div>
  </a>`;
}

// ---------- Tela: Início ----------

const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const instalado = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
let promptInstalar = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); promptInstalar = e; if (rota().nome === 'inicio') render(); });

function avisoInstalar() {
  if (instalado() || S().avisoInstalarVisto) return '';
  const como = ehIOS()
    ? 'No Safari, toque em <b>Compartilhar</b> <span aria-hidden="true">⎙</span> e depois em <b>Adicionar à Tela de Início</b>.'
    : promptInstalar ? '' : 'No menu do navegador <span aria-hidden="true">⋮</span>, toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.';
  return cartao(`
    <h2>Instale na tela do celular</h2>
    <p>Seus dados ficam guardados só neste aparelho. Instalado, o app abre como um aplicativo e o celular não apaga os seus orçamentos.${ehIOS() ? ' No iPhone isso é importante: sites que ficam 7 dias sem abrir podem ter os dados apagados.' : ''}</p>
    ${como ? `<p>${como}</p>` : ''}
    <div class="acoes">${promptInstalar ? '<button class="btn" data-acao="instalar">Instalar agora</button>' : ''}<button class="btn sec" data-acao="fecharInstalar">Já instalei</button></div>
  `, 'destaque');
}

function avisoBackup() {
  const s = S();
  if (!s.orcamentos.length) return '';
  const dias = s.ultimoBackup ? (Date.now() - new Date(s.ultimoBackup)) / 864e5 : Infinity;
  if (dias < 14) return '';
  return cartao(`
    <h2>Hora de fazer um backup</h2>
    <p>${s.ultimoBackup ? `Seu último backup foi em ${dataBR(hojeISO(new Date(s.ultimoBackup)))}.` : 'Você ainda não fez nenhum backup.'} Se o celular quebrar ou for trocado, é ele que traz os seus orçamentos de volta.</p>
    <div class="acoes"><button class="btn" data-acao="exportar">Fazer backup agora</button></div>
  `, 'aviso');
}

telas.inicio = {
  render() {
    const s = S();
    const ch = custoAtual();
    const m = resumoMes(s.orcamentos, mesDe(hojeISO()), hojeISO(), calcOrc);
    const ultimos = [...s.orcamentos].sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1)).slice(0, 3);
    return `
      <header class="marca"><img src="icons/icon.svg" alt="" width="40" height="40"><div><h1>Quanto Cobrar</h1><p>Precificação para costureiras</p></div>
        <a class="engrenagem" href="#/ajustes" aria-label="Ajustes">⚙︎</a></header>
      ${avisoInstalar()}${avisoBackup()}
      ${ch.custoHora > 0
        ? cartao(`<div class="kpi"><span>Custo da sua hora</span><b>${brl(ch.custoHora)}</b></div>
            <p class="ajuda">Refaça a cada três meses${s.custo.atualizadoEm ? ` · atualizado em ${dataBR(hojeISO(new Date(s.custo.atualizadoEm)))}` : ''}.</p>
            <div class="acoes"><a class="btn grande" href="#/peca">Calcular o preço de uma peça</a><a class="btn sec" href="#/custo">Rever o custo da hora</a></div>`)
        : cartao(`<span class="passo">Passo 1</span><h2>Comece pelo custo da sua hora</h2>
            <p>Faça uma vez: você anota o que paga todo mês e quantas horas trabalha. O app descobre quanto custa cada hora sua. Depois disso, cada peça sai em poucos minutos.</p>
            <div class="acoes"><a class="btn grande" href="#/custo">Começar</a></div>`, 'destaque')}
      ${s.orcamentos.length ? cartao(`
        <div class="cartao-cab"><h2>${maiuscula(mesNome(mesDe(hojeISO())))}</h2><a href="#/mes">Ver o mês</a></div>
        <div class="kpis"><div class="kpi"><span>Vendido</span><b>${brl(m.vendido)}</b></div><div class="kpi"><span>Recebido</span><b>${brl(m.recebido)}</b></div></div>
        ${m.atrasadas.length ? `<p class="alerta">${m.atrasadas.length} pagamento(s) atrasado(s). <a href="#/mes">Ver</a></p>` : ''}
      `) : ''}
      ${ultimos.length ? cartao(`<div class="cartao-cab"><h2>Últimos orçamentos</h2><a href="#/orcamentos">Ver todos</a></div><div class="lista">${ultimos.map(itemOrc).join('')}</div>`) : ''}
    `;
  },
};

// ---------- Tela: Custo da hora ----------

telas.custo = {
  render() {
    const c = S().custo;
    const grupos = GRUPOS.map((g) => {
      const itens = c.despesas.filter((d) => d.grupo === g.k);
      return `<details class="grupo" ${itens.some((d) => d.valor) ? 'open' : ''}>
        <summary><span>${g.nome}</span><b data-out="g-${g.k}"></b></summary>
        ${itens.map((d) => `<div class="item">${campo(`custo.despesas#${d.id}.nome`, d.nome, 'text', 'aria-label="Nome da despesa" class="nome"')}${campoUn(`custo.despesas#${d.id}.valor`, d.valor, 'money', 'R$', `aria-label="${esc(d.nome)}"`)}<button class="x" data-acao="removerDespesa" data-id="${d.id}" aria-label="Remover ${esc(d.nome)}">×</button></div>`).join('')}
        <button class="link" data-acao="addDespesa" data-grupo="${g.k}">+ Adicionar em ${g.nome.toLowerCase()}</button>
      </details>`;
    }).join('');
    return `
      ${cab('Custo da sua hora', 'Faça uma vez. Refaça a cada três meses ou quando algo mudar.')}
      ${cartao(`
        <span class="passo">1</span><h2>O seu salário</h2>
        ${linha('Quanto você quer receber por mês', campoUn('custo.proLabore', c.proLabore, 'money', 'R$'))}
        <p class="ajuda">Isso é o pró-labore. É custo da empresa, igual ao aluguel. Não é o seu lucro.</p>
        <label class="check"><input type="checkbox" data-bind="custo.provisoes" ${c.provisoes ? 'checked' : ''}> Guardar todo mês para o 13º e as férias <b data-out="provisoes"></b></label>
      `)}
      ${cartao(`
        <span class="passo">2</span><h2>O que você paga todo mês</h2>
        <p class="ajuda">Tudo o que você paga tendo venda ou não. Tecido e aviamento de uma peça específica <b>não</b> entram aqui: eles vão no preço de cada peça.</p>
        ${grupos}
      `)}
      ${cartao(`
        <span class="passo">3</span><h2>Quantas horas você trabalha</h2>
        ${c.pessoas.map((p, i) => `<div class="pessoa">
          ${campo(`custo.pessoas#${p.id}.nome`, p.nome, 'text', 'aria-label="Quem produz" class="nome"')}
          <label class="mini">Dias/mês ${campo(`custo.pessoas#${p.id}.dias`, p.dias, 'num')}</label>
          <label class="mini">Horas/dia ${campo(`custo.pessoas#${p.id}.horas`, p.horas, 'num')}</label>
          ${i ? `<button class="x" data-acao="removerPessoa" data-id="${p.id}" aria-label="Remover">×</button>` : '<span class="x-vazio"></span>'}
        </div>`).join('')}
        <button class="link" data-acao="addPessoa">+ Outra pessoa que costura com você</button>
        ${linha('Quanto disso é costura mesmo', campoUn('custo.produtividade', c.produtividade, 'pct', '%'), 'Comece com 70%')}
        <p class="ajuda">Ninguém costura 8 horas em 8 horas de ateliê: tem prova, conversa, compra e limpeza. Suba para 80% só se você mede o próprio tempo.</p>
        <div class="soma"><span>Horas produtivas do mês</span><b data-out="horas"></b></div>
      `)}
      ${cartao(`
        <div class="soma"><span>Total do mês</span><b data-out="total"></b></div>
        <div class="kpi grande"><span>Custo da sua hora</span><b data-out="custoHora"></b></div>
        <p class="ajuda">É o quanto a sua estrutura custa por hora, mesmo sem encomendas. Ele já inclui o seu salário.</p>
        <div class="acoes"><a class="btn grande" href="#/peca">Calcular o preço de uma peça</a></div>
      `, 'resultado')}
    `;
  },
  saidas() {
    const c = S().custo;
    const ch = custoAtual();
    const out = {
      provisoes: c.provisoes ? `(${brl(ch.provisoes)})` : '',
      horas: `${num(ch.horasProdutivas)} h`,
      total: brl(ch.total),
      custoHora: ch.horasProdutivas ? brl(ch.custoHora) : 'Preencha as horas',
    };
    for (const g of GRUPOS) out[`g-${g.k}`] = brl(c.despesas.filter((d) => d.grupo === g.k).reduce((t, d) => t + (d.valor || 0), 0));
    return out;
  },
};

// ---------- Tela: Preço da peça ----------

const REFERENCIAS = [['Ajuste simples', '2 a 4 h'], ['Vestido de festa simples', '12 a 18 h'], ['Vestido de festa trabalhado', '20 a 32 h'], ['Noiva simples', '28 a 40 h'], ['Noiva trabalhado', '45 a 80 h']];

telas.peca = {
  render() {
    const r = rascunho();
    const atual = custoAtual();
    const editando = r.id && S().orcamentos.some((o) => o.id === r.id);
    const tempo = r.modoHoras === 'etapas'
      ? `<p class="ajuda">Preencha o <b>seu</b> tempo em cada etapa (ex.: 1:30) e marque quantas vezes ela acontece nesta peça. O seu tempo fica guardado para as próximas.</p>
         <div class="etapas">${r.etapas.map((e) => `<div class="etapa ${e.qtd ? 'usada' : ''}">
           <span class="etapa-nome">${esc(e.nome)}</span>
           ${campo(`rascunho.etapas#${e.id}.min`, e.min, 'tempo', `aria-label="Tempo de ${esc(e.nome)}" class="tempo"`)}
           <div class="qtd"><button data-acao="qtd" data-id="${e.id}" data-d="-1" aria-label="Menos">−</button><b>${e.qtd}</b><button data-acao="qtd" data-id="${e.id}" data-d="1" aria-label="Mais">+</button></div>
         </div>`).join('')}</div>`
      : `${linha('Quantas horas essa peça leva', campoUn('rascunho.horas', r.horas, 'num', 'h'))}
         <p class="ajuda">Conte tudo: atendimento, compra de tecido, modelagem, corte, costura, prova, acabamento e entrega.</p>
         <details class="ref"><summary>Ainda não sabe o seu tempo? Veja uma referência</summary>
           <table>${REFERENCIAS.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>
           <p class="ajuda">É média de ateliê, não o seu tempo. Cronometre a próxima peça.</p></details>`;

    const materiais = r.modoMat === 'lista'
      ? `<div class="mats">${r.materiais.map((m) => `<div class="mat">
          ${campo(`rascunho.materiais#${m.id}.nome`, m.nome, 'text', 'aria-label="Material" class="nome"')}
          <label class="mini">Qtd ${campo(`rascunho.materiais#${m.id}.qtd`, m.qtd, 'num')}</label>
          <label class="mini">Unidade ${campo(`rascunho.materiais#${m.id}.unidade`, m.unidade, 'text')}</label>
          <label class="mini">Preço ${campo(`rascunho.materiais#${m.id}.preco`, m.preco, 'money')}</label>
          <button class="x" data-acao="removerMat" data-id="${m.id}" aria-label="Remover">×</button>
        </div>`).join('')}</div>
        <div class="chips">${SUGESTOES_MATERIAL.map((s) => `<button class="chip" data-acao="addMat" data-nome="${esc(s)}">+ ${esc(s)}</button>`).join('')}</div>
        <div class="soma"><span>Subtotal</span><b data-out="matSub"></b></div>`
      : linha('Total gasto em materiais', campoUn('rascunho.matTotal', r.matTotal, 'money', 'R$'), 'Tecido, forro, aviamentos, bojo, renda…');

    return `
      ${cab(editando ? 'Editar orçamento' : 'Preço da peça', 'Uma peça por vez.', editando ? `#/orcamento/${r.id}` : '')}
      ${atual.custoHora <= 0 && !r.custoFixo ? `<p class="alerta">Você ainda não calculou o custo da sua hora. <a href="#/custo">Calcular agora</a></p>` : ''}
      ${cartao(`
        <div class="duplo">${linha('Cliente', campo('rascunho.cliente', r.cliente, 'text', 'placeholder="Nome da cliente"'))}${linha('Peça', campo('rascunho.peca', r.peca, 'text', 'placeholder="Ex.: vestido de festa"'))}</div>
      `)}
      ${cartao(`
        <span class="passo">1</span><h2>O seu tempo</h2>
        ${segmentado('rascunho.modoHoras', r.modoHoras, [['direto', 'Digitar as horas'], ['etapas', 'Somar etapas']])}
        ${tempo}
        <div class="soma"><span>Tempo total</span><b data-out="horas"></b></div>
        <div class="soma"><span>× custo da hora</span><b data-out="custoHora"></b></div>
        <div data-html="custoFixo"></div>
        <div class="soma forte"><span>Custo do seu trabalho</span><b data-out="trabalho"></b></div>
      `)}
      ${cartao(`
        <span class="passo">2</span><h2>Materiais desta peça</h2>
        ${segmentado('rascunho.modoMat', r.modoMat, [['total', 'Valor total'], ['lista', 'Listar um por um']])}
        ${materiais}
        ${linha('Perda de corte', campoUn('rascunho.perda', r.perda, 'pct', '%'), 'Sobra de tecido, metro quebrado, peça de teste. Entre 5% e 15%.')}
        <div class="soma forte"><span>Total de materiais</span><b data-out="materiais"></b></div>
      `)}
      ${cartao(`
        <span class="passo">3</span><h2>Custos extras</h2>
        <p class="ajuda">Serviços e itens que só existem por causa desta peça. Se a cliente paga o frete à parte, deixe de fora.</p>
        ${r.extras.map((e) => `<div class="item">${campo(`rascunho.extras#${e.id}.nome`, e.nome, 'text', 'aria-label="Item" class="nome"')}${campoUn(`rascunho.extras#${e.id}.valor`, e.valor, 'money', 'R$')}<button class="x" data-acao="removerExtra" data-id="${e.id}" aria-label="Remover">×</button></div>`).join('')}
        <div class="chips">${SUGESTOES_EXTRA.map((s) => `<button class="chip" data-acao="addExtra" data-nome="${esc(s)}">+ ${esc(s)}</button>`).join('')}<button class="chip" data-acao="addExtra" data-nome="">+ Outro</button></div>
        <div class="soma forte"><span>Total de extras</span><b data-out="extras"></b></div>
      `)}
      ${cartao(`
        <span class="passo">4</span><h2>Reserva para imprevistos</h2>
        ${linha('Perda de tecido, refação, erro', campoUn('rascunho.reservaPct', r.reservaPct, 'pct', '%'))}
        <p class="ajuda">Mesmo a melhor profissional pode precisar refazer uma peça. Aqui você guarda um valor para isso.</p>
        <div class="soma"><span>Valor guardado</span><b data-out="reserva"></b></div>
        <div class="soma forte"><span>Custo total da peça</span><b data-out="custo"></b></div>
      `)}
      ${cartao(`
        <span class="passo">5</span><h2>Impostos e taxas</h2>
        ${linha('Imposto', campoUn('rascunho.imposto', r.imposto, 'pct', '%'), 'Se emite nota (MEI, Simples…)')}
        ${linha('Taxa do cartão', campoUn('rascunho.cartao', r.cartao, 'pct', '%'), 'Se não emite nota, use só a taxa da maquininha')}
        ${linha('Comissão de venda', campoUn('rascunho.comissao', r.comissao, 'pct', '%'))}
      `)}
      ${cartao(`
        <span class="passo">6</span><h2>Sua margem de lucro</h2>
        <p class="ajuda">O seu salário já está no custo da hora. A margem é o lucro da <b>empresa</b>, por cima disso: é ele que paga uma máquina nova, um curso e o crescimento do ateliê.</p>
        ${linha('Margem de lucro', campoUn('rascunho.margem', r.margem, 'pct', '%'))}
        <div class="chips">${[0.2, 0.3, 0.4, 0.5].map((v) => `<button class="chip ${Math.abs(r.margem - v) < 1e-6 ? 'on' : ''}" data-acao="margem" data-v="${v}">${pct(v)}</button>`).join('')}</div>
        <div data-html="avisoMargem"></div>
        <details class="ref"><summary>Até onde posso subir?</summary>
          <p><b>20% é o piso recomendado</b> para começar. Abaixo disso, qualquer imprevisto come o lucro.</p>
          <p>O <b>teto</b> é do seu negócio: depende de quanto as suas clientes já valorizam a sua marca. Reputação, portfólio, indicações, procura maior do que a sua agenda e peças exclusivas permitem margens maiores.</p>
          <p>Se as clientes fecham sem pechinchar, ou a sua agenda está sempre cheia, é sinal de que o preço pode subir.</p>
        </details>
      `)}
      ${cartao(`
        <div data-html="invalido"></div>
        <div class="kpi grande"><span>Cobre da cliente</span><b data-out="preco"></b></div>
        <h3>Desse preço, para onde vai:</h3>
        <div data-html="barra"></div>
        <p class="ajuda">Só o lucro é dinheiro livre da empresa. O resto já tem dono: fornecedor, ateliê, o seu salário e o governo.</p>
        ${`<label class="obs">Observações<textarea data-bind="rascunho.notas" data-tipo="text" rows="2" placeholder="Prazo, detalhes combinados…">${esc(r.notas)}</textarea></label>`}
        <div class="acoes"><button class="btn grande" data-acao="salvarOrc">${editando ? 'Salvar alterações' : 'Salvar orçamento'}</button>
        <button class="btn sec" data-acao="limparPeca">${editando ? 'Cancelar edição' : 'Começar outra peça'}</button></div>
      `, 'resultado')}
      <div class="barra-preco" aria-live="polite"><span>Cobre da cliente</span><b data-out="preco"></b></div>
    `;
  },
  saidas() {
    const r = rascunho();
    const atual = custoAtual();
    const ch = chDoRascunho(r);
    const c = calcPeca(r, ch);
    const diferente = r.custoFixo && Math.abs(r.custoFixo.custoHora - atual.custoHora) > 0.005;
    return {
      horas: horasTxt(c.horas),
      custoHora: brl(ch.custoHora),
      custoFixo: diferente ? `<p class="alerta">Este orçamento usa o custo da hora de quando foi criado (${brl(r.custoFixo.custoHora)}). O atual é ${brl(atual.custoHora)}. <button class="link" data-acao="usarCustoAtual">Usar o atual</button></p>` : '',
      trabalho: brl(c.trabalho),
      matSub: brl(c.matSub),
      materiais: brl(c.materiais),
      extras: brl(c.extras),
      reserva: brl(c.reserva),
      custo: brl(c.custo),
      preco: c.valido ? brl(c.preco) : '—',
      invalido: c.valido ? '' : '<p class="alerta perigo">Impostos, taxas e margem somam 90% ou mais. Assim não existe preço possível. Reduza a margem ou reveja as taxas.</p>',
      avisoMargem: r.margem < MARGEM_MIN - 1e-9 ? `<p class="alerta">Abaixo de 20%, qualquer imprevisto pode zerar o seu lucro. Você pode seguir, mas o recomendado é no mínimo 20%.</p>` : '',
      barra: c.valido ? barra(composicao(c, c.preco, taxaVenda(r))) : '',
    };
  },
};

// ---------- Tela: Orçamentos ----------

telas.orcamentos = {
  render() {
    return `
      ${cab('Meus orçamentos', 'Toque em um orçamento para ver todos os detalhes.')}
      <div class="busca">${campo('ui.busca', ui.busca, 'text', 'placeholder="Buscar cliente ou peça" aria-label="Buscar" enterkeyhint="search"')}</div>
      ${segmentado('ui.filtro', ui.filtro, [['todos', 'Todos'], ['enviado', 'Enviados'], ['fechado', 'Fechados'], ['recusado', 'Recusados']])}
      <div class="lista" data-html="lista"></div>
      <div class="acoes"><a class="btn grande" href="#/peca" data-acao="novaPeca">Novo orçamento</a></div>
    `;
  },
  saidas() {
    const q = ui.busca.trim().toLowerCase();
    const lista = S().orcamentos
      .filter((o) => ui.filtro === 'todos' || o.status === ui.filtro)
      .filter((o) => !q || `${o.cliente} ${o.peca}`.toLowerCase().includes(q))
      .sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1));
    return {
      lista: lista.length ? lista.map(itemOrc).join('')
        : `<p class="vazio">${S().orcamentos.length ? 'Nenhum orçamento encontrado.' : 'Você ainda não salvou nenhum orçamento. Calcule uma peça e toque em “Salvar orçamento”.'}</p>`,
    };
  },
};

// ---------- Tela: Detalhe do orçamento ----------

const acharOrc = (id) => S().orcamentos.find((o) => o.id === id);

function situacao(pc, hoje = hojeISO()) {
  if (pc.recebidoEm) return `<span class="pill pill-fechado">Recebido ${dataBR(pc.recebidoEm)}</span>`;
  if (pc.venc < hoje) return '<span class="pill pill-recusado">Atrasado</span>';
  return '<span class="pill">A receber</span>';
}

function blocoPlano(r, plano) {
  const primeiro = plano.linhas[0]?.rotulo === 'Entrada' ? 'A entrada' : plano.linhas.length > 1 ? 'O primeiro pagamento' : 'O pagamento';
  if (plano.doCaixa <= 0.5) {
    return `<p class="alerta ok">${primeiro} cobre todo o material (${brl(plano.necessario)}). Você não precisa tirar dinheiro do caixa.</p>`;
  }
  const meses = plano.repoem.map((l) => mesCurto(mesDe(l.venc)));
  const quanto = plano.repoem.map((l) => `<b>${brl(l.material)}</b> da parcela de ${mesCurto(mesDe(l.venc))}`);
  const ult = quanto.pop();
  return `<div class="alerta caixa">
    <p>O material desta peça custa <b>${brl(plano.necessario)}</b>. ${primeiro} cobre <b>${brl(plano.primeira)}</b>.</p>
    <p>Você vai tirar <b>${brl(plano.doCaixa)}</b> do seu caixa para comprar o material.</p>
    ${plano.repoem.length ? `<p>Esse dinheiro volta em <b>${plano.repoem.length} parcela${plano.repoem.length > 1 ? 's' : ''}</b> (${meses.join(', ')}). Não use esses valores para outras contas: guarde ${quanto.length ? `${quanto.join(', ')} e ` : ''}${ult} para repor o caixa.</p>`
      : '<p>Com esse valor, o material não é coberto pela venda. Reveja o preço.</p>'}
  </div>`;
}

function linhaTempo(plano) {
  return `<ol class="tempo-linha">${plano.linhas.map((l) => `<li>
    <div><b>${esc(l.rotulo || 'Parcela')}</b><span>${dataBR(l.venc)} · ${brl(l.valor)}</span></div>
    <div class="tl-partes">${l.material > 0.005 ? `<span class="tag mat">Repor material ${brl(l.material)}</span>` : ''}${l.impostos > 0.005 ? `<span class="tag">Taxas ${brl(l.impostos)}</span>` : ''}${l.livre > 0.005 ? `<span class="tag livre">Livre ${brl(l.livre)}</span>` : ''}</div>
  </li>`).join('')}</ol>`;
}

telas.orcamento = {
  aba: 'orcamentos',
  render(id) {
    const o = acharOrc(id);
    if (!o) return `${cab('Orçamento', '', '#/orcamentos')}<p class="vazio">Esse orçamento não existe mais.</p>`;
    const p = o.snap;
    const r = calcOrc(o);
    const fechado = o.status === 'fechado' && o.fechamento;
    const etapas = p.modoHoras === 'etapas' ? p.etapas.filter((e) => e.qtd) : [];
    const mats = p.modoMat === 'lista' ? p.materiais.filter((m) => m.qtd && m.preco) : [];

    let venda = '';
    if (fechado) {
      const v = dadosVenda(o, calcOrc);
      const plano = planoMaterial(v.r, v.aloc, v.ordenadas);
      const desconto = r.preco - o.fechamento.valor;
      venda = `
        ${cartao(`
          <h2>Venda fechada</h2>
          <div class="kpis"><div class="kpi"><span>Valor fechado</span><b>${brl(o.fechamento.valor)}</b></div><div class="kpi"><span>Fechado em</span><b>${dataBR(o.fechamento.data)}</b></div></div>
          ${desconto > 0.5 ? `<p class="alerta">Desconto de <b>${brl(desconto)}</b> sobre o preço sugerido. Ele saiu do seu lucro.</p>` : ''}
          <h3>Para onde vai o valor fechado</h3>
          ${barra(v.comp)}
        `)}
        ${cartao(`
          <div class="cartao-cab"><h2>Pagamentos</h2><button class="link" data-acao="editParcelas">${ui.editParcelas ? 'Pronto' : 'Editar'}</button></div>
          <div class="parcelas">${v.ordenadas.map((pc) => {
            const a = v.porId[pc.id];
            const mat = a.materiais + a.extras;
            return ui.editParcelas
              ? `<div class="parcela edit">
                  <label class="mini">Vencimento ${campo(`orcamentos#${o.id}.fechamento.parcelas#${pc.id}.venc`, pc.venc, 'date')}</label>
                  <label class="mini">Valor ${campo(`orcamentos#${o.id}.fechamento.parcelas#${pc.id}.valor`, pc.valor, 'money')}</label>
                  <button class="x" data-acao="removerParcela" data-id="${pc.id}" aria-label="Remover parcela">×</button></div>`
              : `<div class="parcela">
                  <div><b>${esc(pc.rotulo || 'Parcela')}</b><span>${dataBR(pc.venc)} · ${brl(pc.valor)}</span>
                    ${mat > 0.005 ? `<span class="tag mat">Repor material ${brl(mat)}</span>` : ''}</div>
                  <div class="parcela-dir">${situacao(pc)}
                    <button class="btn ${pc.recebidoEm ? 'sec' : ''} peq" data-acao="receber" data-id="${pc.id}">${pc.recebidoEm ? 'Desfazer' : 'Recebi'}</button></div>
                </div>`;
          }).join('')}</div>
          ${ui.editParcelas ? `<button class="link" data-acao="addParcela">+ Adicionar pagamento</button>
            <p class="ajuda">Soma dos pagamentos: <b data-out="somaParcelas"></b> · valor fechado ${brl(o.fechamento.valor)}</p>` : ''}
        `)}
        ${cartao(`<h2>O material e o seu caixa</h2>${blocoPlano(v.r, plano)}${linhaTempo(plano)}`)}
      `;
    }

    return `
      ${cab(esc(o.cliente || 'Sem nome'), `${esc(o.peca || 'Peça')} · criado em ${dataBR(hojeISO(new Date(o.criadoEm)))}`, '#/orcamentos')}
      ${cartao(`
        <div class="cartao-cab">${pill(o.status)}</div>
        <div class="kpi grande"><span>Preço sugerido</span><b>${brl(r.preco)}</b></div>
        <a class="btn sec bloco" href="#/cliente/${o.id}">Orçamento para a cliente</a>
        ${o.proposta?.enviadoEm ? `<p class="ajuda">Enviado para a cliente em ${dataBR(o.proposta.enviadoEm)} · ${brl(o.proposta.valor)}</p>` : ''}
        ${!fechado ? `<div class="acoes"><a class="btn grande" href="#/fechar/${o.id}">Fechar venda</a>
          ${o.status === 'recusado' ? `<button class="btn sec" data-acao="status" data-s="enviado">Marcar como enviado</button>` : `<button class="btn sec" data-acao="status" data-s="recusado">Cliente recusou</button>`}</div>` : ''}
      `)}
      ${venda}
      ${cartao(`
        <h2>Como o preço foi calculado</h2>
        <dl class="det">
          <dt>Tempo</dt><dd>${horasTxt(r.horas)}</dd>
          ${etapas.map((e) => `<dt class="sub">${esc(e.nome)}</dt><dd class="sub">${e.qtd} × ${horasTxt(e.min / 60)}</dd>`).join('')}
          <dt>Custo da hora (na época)</dt><dd>${brl(p.custoHora)}</dd>
          <dt><b>Custo do trabalho</b></dt><dd><b>${brl(r.trabalho)}</b></dd>
          ${mats.map((m) => `<dt class="sub">${esc(m.nome)}</dt><dd class="sub">${num(m.qtd)} ${esc(m.unidade || '')} × ${brl(m.preco)}</dd>`).join('')}
          <dt>Materiais${p.perda ? ` (+${pct(p.perda)} de perda)` : ''}</dt><dd>${brl(r.materiais)}</dd>
          ${p.extras.filter((e) => e.valor).map((e) => `<dt class="sub">${esc(e.nome || 'Extra')}</dt><dd class="sub">${brl(e.valor)}</dd>`).join('')}
          <dt>Custos extras</dt><dd>${brl(r.extras)}</dd>
          <dt>Reserva (${pct(p.reservaPct)})</dt><dd>${brl(r.reserva)}</dd>
          <dt><b>Custo total</b></dt><dd><b>${brl(r.custo)}</b></dd>
          <dt>Imposto · cartão · comissão</dt><dd>${pct(p.imposto)} · ${pct(p.cartao)} · ${pct(p.comissao)}</dd>
          <dt>Margem de lucro</dt><dd>${pct(p.margem)}</dd>
          <dt><b>Preço sugerido</b></dt><dd><b>${brl(r.preco)}</b></dd>
        </dl>
        ${!fechado ? `<h3>Para onde vai o preço sugerido</h3>${barra(composicao(r, r.preco, taxaVenda(p)))}` : ''}
        ${p.notas ? `<h3>Observações</h3><p>${esc(p.notas)}</p>` : ''}
      `)}
      <div class="acoes">
        <button class="btn sec" data-acao="editarOrc">Editar cálculo</button>
        <button class="btn sec" data-acao="duplicar">Duplicar para outra peça</button>
        ${fechado ? '<button class="btn sec" data-acao="desfazerFechamento">Desfazer fechamento</button>' : ''}
        <button class="btn perigo" data-acao="excluir">Excluir</button>
      </div>
    `;
  },
  saidas(id) {
    const o = acharOrc(id);
    if (!o?.fechamento) return {};
    return { somaParcelas: brl(o.fechamento.parcelas.reduce((t, p) => t + (p.valor || 0), 0)) };
  },
};

// ---------- Tela: Fechar venda ----------

function formFechar(o) {
  if (!ui.fechar || ui.fechar.id !== o.id) {
    const r = calcOrc(o);
    const hoje = hojeISO();
    const pr = o.proposta;
    ui.fechar = {
      id: o.id, data: hoje, valor: pr ? pr.valor : Math.round(r.preco * 100) / 100, cartaoPct: o.snap.cartao,
      forma: 'avista', entrada: 0, dataRestante: pr?.prazo || somaMeses(hoje, 1), nParcelas: 3, primeiraData: hoje, antecipa: false,
    };
    // Se a cliente só tinha a opção de entrada, já vem assim.
    if (pr?.formas.entrada && !pr.formas.avista && !pr.formas.cartao) Object.assign(ui.fechar, { forma: 'entrada', entrada: pr.entrada });
  }
  return ui.fechar;
}

telas.fechar = {
  aba: 'orcamentos',
  render(id) {
    const o = acharOrc(id);
    if (!o) return `${cab('Fechar venda', '', '#/orcamentos')}<p class="vazio">Esse orçamento não existe mais.</p>`;
    const f = formFechar(o);
    return `
      ${cab('Fechar venda', `${esc(o.cliente || 'Sem nome')} · ${esc(o.peca || 'Peça')}`, `#/orcamento/${o.id}`)}
      ${cartao(`
        ${linha('Data do fechamento', campo('ui.fechar.data', f.data, 'date'))}
        ${linha('Valor fechado', campoUn('ui.fechar.valor', f.valor, 'money', 'R$'), `Preço sugerido: ${brl(calcOrc(o).preco)}`)}
        <div data-html="desconto"></div>
        ${linha('Taxa do cartão nesta venda', campoUn('ui.fechar.cartaoPct', f.cartaoPct, 'pct', '%'), 'Parcelado no cartão costuma ter taxa maior. Use 0 se for Pix ou dinheiro.')}
      `)}
      ${cartao(`
        <h2>Como a cliente vai pagar</h2>
        ${segmentado('ui.fechar.forma', f.forma, [['avista', 'À vista'], ['entrada', 'Entrada + restante'], ['parcelado', 'Parcelado']])}
        ${f.forma === 'entrada' ? `
          ${linha('Valor da entrada', campoUn('ui.fechar.entrada', f.entrada, 'money', 'R$'))}
          <div data-html="entradaMin"></div>
          ${linha('Data do restante', campo('ui.fechar.dataRestante', f.dataRestante, 'date'), 'Por exemplo, na entrega')}` : ''}
        ${f.forma === 'parcelado' ? `
          <label class="check"><input type="checkbox" data-bind="ui.fechar.antecipa" ${f.antecipa ? 'checked' : ''}> No cartão, com antecipação (recebo tudo de uma vez)</label>
          ${f.antecipa ? '' : `${linha('Número de parcelas', campo('ui.fechar.nParcelas', f.nParcelas, 'int'))}${linha('Data da 1ª parcela', campo('ui.fechar.primeiraData', f.primeiraData, 'date'))}`}` : ''}
      `)}
      ${cartao(`<h2>Pagamentos previstos</h2><div data-html="previa"></div>`)}
      ${cartao(`<h2>O material e o seu caixa</h2><div data-html="plano"></div>`)}
      <div class="acoes"><button class="btn grande" data-acao="confirmarFechamento">Confirmar venda</button></div>
    `;
  },
  saidas(id) {
    const o = acharOrc(id);
    if (!o) return {};
    const f = formFechar(o);
    const r = calcOrc(o);
    const taxa = taxaVenda(o.snap, f.cartaoPct);
    const parcelas = gerarParcelas(f).map((p, i) => ({ ...p, id: String(i) }));
    const ord = ordenarParcelas(parcelas);
    const aloc = alocarPagamentos(r, f.valor, taxa, ord);
    const plano = planoMaterial(r, aloc, ord);
    const lucroSug = composicao(r, r.preco, taxaVenda(o.snap)).lucro;
    const lucroFech = composicao(r, f.valor, taxa).lucro;
    const desconto = r.preco - f.valor;
    const min = entradaMinima(r, taxa);
    return {
      desconto: lucroFech < -0.5
        ? `<p class="alerta perigo">Com esse valor a peça é vendida <b>abaixo do custo</b>: prejuízo de ${brl(-lucroFech)}.</p>`
        : desconto > 0.5
          ? `<p class="alerta">Desconto de <b>${brl(desconto)}</b>. Os custos não mudam, então ele sai do lucro: de ${brl(lucroSug)} para <b>${brl(lucroFech)}</b>.</p>`
          : '',
      entradaMin: `<p class="ajuda">Entrada mínima sugerida: <b>${brl(min)}</b>. É o que cobre materiais e extras depois das taxas. <button class="link" data-acao="usarEntradaMin" data-v="${Math.ceil(min)}">Usar esse valor</button></p>`,
      previa: `<ol class="tempo-linha">${parcelas.map((p) => `<li><div><b>${esc(p.rotulo)}</b><span>${dataBR(p.venc)}</span></div><b>${brl(p.valor)}</b></li>`).join('')}</ol>`,
      plano: blocoPlano(r, plano) + linhaTempo(plano),
    };
  },
};

// ---------- Tela: Orçamento para a cliente ----------

// Cria a proposta na primeira vez; se o cálculo mudou depois, atualiza o valor.
function propostaDe(o) {
  const r = calcOrc(o);
  if (!o.proposta) { o.proposta = novaProposta(o.snap, r); store.salvar(); }
  const pr = o.proposta;
  if (Math.abs(pr.base - r.preco) > 0.01) { pr.base = r.preco; pr.valor = Math.ceil(r.preco); store.salvar(); }
  return pr;
}

function cartaoAtelie(a) {
  return cartao(`
    <h2>Seu ateliê</h2>
    <p class="ajuda">Aparece no topo e no rodapé do orçamento. Você preenche uma vez só.</p>
    ${linha('Nome do ateliê', campo('atelie.nome', a.nome, 'text', 'placeholder="Ex.: Ateliê da Ana"'))}
    ${linha('WhatsApp', campo('atelie.whatsapp', a.whatsapp, 'text', 'placeholder="(11) 99999-9999" inputmode="tel"'))}
    ${linha('Instagram', campo('atelie.instagram', a.instagram, 'text', 'placeholder="@seuateliê"'))}
    <div class="logo-linha">
      ${a.logo ? `<img src="${a.logo}" alt="Sua logo">` : '<span class="logo-vazia">Sem logo</span>'}
      <div class="acoes">
        <label class="btn sec">${a.logo ? 'Trocar logo' : 'Escolher logo'}<input type="file" accept="image/*" data-acao="logo" hidden></label>
        ${a.logo ? '<button class="link" data-acao="removerLogo">Remover</button>' : ''}
      </div>
    </div>
  `);
}

telas.cliente = {
  aba: 'orcamentos',
  render(id) {
    const o = acharOrc(id);
    if (!o) return `${cab('Orçamento para a cliente', '', '#/orcamentos')}<p class="vazio">Esse orçamento não existe mais.</p>`;
    const pr = propostaDe(o);
    const a = S().atelie;
    const b = (k) => `orcamentos#${o.id}.proposta.${k}`;
    const marca = (k, t) => `<label class="check"><input type="checkbox" data-bind="${b(`formas.${k}`)}" ${pr.formas[k] ? 'checked' : ''}> ${t}</label>`;
    return `
      ${cab('Orçamento para a cliente', `${esc(o.cliente || 'Sem nome')} · ${esc(o.peca || 'Peça')}`, `#/orcamento/${o.id}`)}
      <p class="ajuda">A cliente vê só o valor, as formas de pagamento, o que está incluso e o prazo. Custos e lucro ficam só com você.</p>
      ${a.nome ? '' : cartaoAtelie(a)}
      ${cartao(`
        ${linha('Valor', campoUn(b('valor'), pr.valor, 'money', 'R$'), `Preço sugerido: ${brl(calcOrc(o).preco)}`)}
        <div data-html="desconto"></div>
      `)}
      ${cartao(`
        <h2>Formas de pagamento</h2>
        ${marca('avista', 'À vista (Pix ou dinheiro)')}
        ${marca('entrada', 'Entrada + restante na entrega')}
        ${pr.formas.entrada ? `${linha('Valor da entrada', campoUn(b('entrada'), pr.entrada, 'money', 'R$'))}<div data-html="entradaMin"></div>` : ''}
        ${marca('cartao', 'Parcelado no cartão')}
        ${pr.formas.cartao ? `
          ${linha('Em até quantas vezes', campo(b('parcelas'), pr.parcelas, 'int'))}
          ${linha('Taxa da maquininha', campoUn(b('taxaCartao'), pr.taxaCartao, 'pct', '%'), 'Veja no app da maquininha a taxa para esse número de parcelas.')}` : ''}
        <h3>Como a cliente vai ler</h3>
        <ul class="formas" data-html="formas"></ul>
      `)}
      ${cartao(`
        <h2>O que está incluso</h2>
        <p class="ajuda">Marque o que a cliente vai receber. Ela não vê o preço de cada item.</p>
        ${pr.incluso.map((i) => `<div class="incluso"><label class="check"><input type="checkbox" data-bind="${b(`incluso#${i.id}.on`)}" ${i.on ? 'checked' : ''}> ${esc(i.txt)}</label>
          <button class="x" data-acao="removerIncluso" data-id="${i.id}" aria-label="Tirar ${esc(i.txt)}">×</button></div>`).join('')}
        <div class="novo-item">${campo('ui.novoItem', ui.novoItem, 'text', 'placeholder="Outro item, ex.: 2 provas" aria-label="Outro item" enterkeyhint="done"')}
          <button class="btn sec" data-acao="addIncluso">Adicionar</button></div>
      `)}
      ${cartao(`
        ${linha('Prazo de entrega', campo(b('prazo'), pr.prazo, 'date'))}
        <div class="linha"><div class="linha-rot"><span>Válido por</span></div><div class="linha-ctl">${segmentado(b('validade'), String(pr.validade), [['7', '7 dias'], ['15', '15 dias'], ['30', '30 dias']])}</div></div>
        <h3>Observações</h3>
        <div class="chips">${['Entrada para reservar a data', 'Tecido escolhido pela cliente', 'Valor sujeito a mudança se o modelo mudar', 'Ajustes depois da entrega sem custo por 15 dias']
          .map((t) => `<button class="chip" data-acao="obs" data-t="${esc(t)}">+ ${t}</button>`).join('')}</div>
        <textarea rows="3" data-bind="${b('obs')}" data-tipo="text" placeholder="Algo mais que a cliente precisa saber">${esc(pr.obs)}</textarea>
      `)}
      ${a.nome ? `<p class="ajuda">Aparece como <b>${esc(a.nome)}</b>. <a href="#/ajustes">Mudar nome, contato ou logo</a></p>` : ''}
      <div class="acoes"><button class="btn grande" data-acao="verOrcCliente">Ver como fica</button></div>
    `;
  },
  saidas(id) {
    const o = acharOrc(id);
    if (!o?.proposta) return {};
    const pr = o.proposta;
    const r = calcOrc(o);
    const lucroSug = composicao(r, r.preco, taxaVenda(o.snap)).lucro;
    const lucro = composicao(r, pr.valor, taxaVenda(o.snap)).lucro;
    const desconto = r.preco - pr.valor;
    const min = entradaMinima(r, taxaVenda(o.snap));
    const formas = formasDePagamento(pr);
    return {
      desconto: lucro < -0.5
        ? `<p class="alerta perigo">Com esse valor a peça fica <b>abaixo do custo</b>: prejuízo de ${brl(-lucro)}.</p>`
        : desconto > 0.5
          ? `<p class="alerta">Desconto de <b>${brl(desconto)}</b>. Os custos não mudam, então ele sai do seu lucro: de ${brl(lucroSug)} para <b>${brl(lucro)}</b>.</p>`
          : '',
      entradaMin: pr.entrada + 0.5 < min
        ? `<p class="alerta">Essa entrada não cobre o material. Entrada mínima sugerida: <b>${brl(min)}</b>. <button class="link" data-acao="entradaPropMin" data-v="${Math.ceil(min)}">Usar esse valor</button></p>`
        : `<p class="ajuda">Cobre o material desta peça (${brl(min)}).</p>`,
      formas: formas.length ? formas.map((l) => `<li>${esc(l)}</li>`).join('') : '<li class="vazio-mini">Marque pelo menos uma forma de pagamento.</li>',
    };
  },
};

// Imagem pronta: mandar, baixar PDF ou copiar o texto.
let imgAtual = null;

telas.enviar = {
  aba: 'orcamentos',
  render(id) {
    const o = acharOrc(id);
    if (!o?.proposta) return `${cab('Orçamento para a cliente', '', '#/orcamentos')}<p class="vazio">Esse orçamento não existe mais.</p>`;
    o.proposta.data = hojeISO(); // a validade conta a partir de hoje
    store.salvar();
    return `
      ${cab('Pronto para enviar', `${esc(o.cliente || 'Sem nome')} · válido até ${dataBR(validoAte(o.proposta))}`, `#/cliente/${o.id}`)}
      <div class="previa-orc"><img id="previa" alt="Orçamento para ${esc(o.cliente || 'a cliente')}"></div>
      <div class="acoes coluna">
        <button class="btn grande" data-acao="mandarImagem">Mandar imagem</button>
        <button class="btn sec" data-acao="baixarPdf">Baixar PDF</button>
        <button class="btn sec" data-acao="copiarTexto">Copiar como texto</button>
        <a class="btn sec" href="#/cliente/${o.id}">Editar</a>
      </div>
    `;
  },
  async depois(id) {
    const o = acharOrc(id);
    if (!o?.proposta) return;
    imgAtual = await canvasProposta(o, o.proposta, S().atelie);
    const el = document.getElementById('previa');
    if (el) el.src = imgAtual.toDataURL('image/png');
  },
};

const nomeArquivo = (o, ext) => `orcamento-${(o.cliente || 'cliente').normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase()}.${ext}`;

async function compartilhar(blob, nome, tipo) {
  const arquivo = new File([blob], nome, { type: tipo });
  if (navigator.canShare?.({ files: [arquivo] })) {
    try { await navigator.share({ files: [arquivo] }); return true; } catch (e) { if (e.name === 'AbortError') return false; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('Arquivo baixado');
  return true;
}

function marcarEnviado(o) {
  o.proposta.enviadoEm = hojeISO();
  store.salvar();
}

// ---------- Tela: Mês ----------

telas.mes = {
  render() {
    const s = S();
    const m = resumoMes(s.orcamentos, ui.mes, hojeISO(), calcOrc);
    const metas = s.metas;
    const prog = (v, meta) => (meta > 0 ? `<div class="prog"><span style="width:${Math.min(100, (v / meta) * 100)}%"></span></div><p class="ajuda">${brl(v)} de ${brl(meta)} · ${v >= meta ? 'meta batida' : `faltam ${brl(meta - v)}`}</p>` : '');
    const e = m.explica;
    const motivos = [
      [e.doMesRecebido, 'das vendas deste mês já foram recebidos'],
      [e.doMesFuturo, 'das vendas deste mês vencem nos próximos meses ou dias'],
      [e.doMesAtrasado, 'das vendas deste mês estão atrasados'],
      [e.doMesOutroMes, 'das vendas deste mês foram recebidos em outro mês'],
      [e.antigasRecebidas, 'recebidos são de vendas de meses anteriores'],
    ].filter(([v]) => v > 0.5);
    const proximos = Object.entries(m.proximos).sort();
    const recebidas = m.recebidas.sort((a, b) => (a.pc.recebidoEm < b.pc.recebidoEm ? -1 : 1));

    return `
      ${cab('Recebimentos do mês', 'O que foi vendido, o que entrou e para onde vai cada real.')}
      <div class="mes-sel"><button data-acao="mes" data-d="-1" aria-label="Mês anterior">‹</button><b>${maiuscula(mesNome(ui.mes))}</b><button data-acao="mes" data-d="1" aria-label="Próximo mês">›</button></div>
      ${cartao(`
        <div class="kpis">
          <div class="kpi"><span>Vendido</span><b>${brl(m.vendido)}</b><small>${m.qtdVendas} venda(s) fechada(s)</small></div>
          <div class="kpi"><span>Recebido</span><b>${brl(m.recebido)}</b><small>previsto: ${brl(m.previsto)}</small></div>
        </div>
      `)}
      ${cartao(`
        <h2>Para onde vai o dinheiro recebido</h2>
        ${m.recebido > 0 ? `<p>${frase(m.compRecebido, m.recebido)}</p>${barra(m.compRecebido)}
          <p class="ajuda">Cada pagamento cobre primeiro o material, depois as despesas do ateliê e o seu salário. O lucro vem por último.</p>`
          : '<p class="vazio-mini">Nenhum pagamento recebido neste mês.</p>'}
      `)}
      ${m.vendido > 0 || motivos.length ? cartao(`
        <h2>Por que vendido e recebido são diferentes</h2>
        ${motivos.length ? `<ul class="motivos">${motivos.map(([v, t]) => `<li><b>${brl(v)}</b> ${t}</li>`).join('')}</ul>` : '<p class="vazio-mini">Tudo o que foi vendido entrou neste mês.</p>'}
      `) : ''}
      ${cartao(`
        <h2>Vendas do mês</h2>
        ${m.vendido > 0 ? `<p>${frase(m.compVendido, m.vendido, 'vendidos')}</p>${barra(m.compVendido)}` : '<p class="vazio-mini">Nenhuma venda fechada neste mês.</p>'}
        ${metas.faturamento ? `<h3>Meta de faturamento</h3>${prog(m.vendido, metas.faturamento)}` : ''}
        ${metas.lucro ? `<h3>Meta de lucro</h3>${prog(Math.max(0, m.lucroVendido), metas.lucro)}` : ''}
        ${!metas.faturamento && !metas.lucro ? '<p class="ajuda"><a href="#/ajustes">Defina metas de faturamento e de lucro</a> para acompanhar aqui.</p>' : ''}
      `)}
      ${m.descontos > 0.5 ? cartao(`
        <h2>Descontos do mês</h2>
        <p>Você fechou <b>${brl(m.descontos)}</b> abaixo dos preços sugeridos. O lucro esperado era ${brl(m.lucroSugerido)} e ficou em <b>${brl(m.lucroVendido)}</b>.</p>
        <ul class="motivos">${m.comDesconto.map((d) => `<li><a href="#/orcamento/${d.o.id}">${esc(d.o.cliente || 'Sem nome')}</a>: sugerido ${brl(d.sugerido)}, fechado ${brl(d.fechado)}</li>`).join('')}</ul>
      `, 'aviso') : ''}
      ${m.emprestado > 0.5 ? cartao(`
        <h2>Seu caixa emprestado para material</h2>
        <div class="kpi"><span>Hoje</span><b>${brl(m.emprestado)}</b></div>
        <p>É o dinheiro que saiu do seu caixa para comprar material de peças que ainda não pagaram o suficiente para cobri-lo.</p>
        <ul class="motivos">${m.emprestimos.map((x) => `<li><a href="#/orcamento/${x.o.id}">${esc(x.o.cliente || 'Sem nome')} · ${esc(x.o.peca || '')}</a>: ${brl(x.falta)}</li>`).join('')}</ul>
      `, 'aviso') : ''}
      ${m.atrasadas.length ? cartao(`
        <h2>Pagamentos atrasados</h2>
        <div class="parcelas">${m.atrasadas.map(({ o, pc }) => `<div class="parcela"><div><b>${esc(o.cliente || 'Sem nome')}</b><span>${esc(pc.rotulo || '')} · venceu ${dataBR(pc.venc)} · ${brl(pc.valor)}</span></div>
          <div class="parcela-dir"><button class="btn peq" data-acao="receber" data-orc="${o.id}" data-id="${pc.id}">Recebi</button></div></div>`).join('')}</div>
      `, 'perigo') : ''}
      ${recebidas.length ? cartao(`
        <h2>Recebidos neste mês</h2>
        <div class="parcelas">${recebidas.map(({ o, pc, a }) => `<a class="parcela" href="#/orcamento/${o.id}"><div><b>${esc(o.cliente || 'Sem nome')}</b><span>${esc(pc.rotulo || '')} · ${dataBR(pc.recebidoEm)}</span>
          ${a.materiais + a.extras > 0.005 ? `<span class="tag mat">Repor material ${brl(a.materiais + a.extras)}</span>` : ''}</div><b>${brl(pc.valor)}</b></a>`).join('')}</div>
      `) : ''}
      ${proximos.length ? cartao(`
        <h2>A receber nos próximos meses</h2>
        <ul class="motivos">${proximos.map(([mm, v]) => `<li><span>${mesNome(mm)}</span> <b>${brl(v)}</b></li>`).join('')}</ul>
      `) : ''}
    `;
  },
};

// ---------- Tela: Ajustes ----------

telas.ajustes = {
  render() {
    const s = S();
    return `
      ${cab('Ajustes', '', '#/inicio')}
      ${cartaoAtelie(s.atelie)}
      ${cartao(`
        <h2>Metas do mês</h2>
        ${linha('Meta de faturamento', campoUn('metas.faturamento', s.metas.faturamento, 'money', 'R$'))}
        ${linha('Meta de lucro', campoUn('metas.lucro', s.metas.lucro, 'money', 'R$'))}
      `)}
      ${cartao(`
        <h2>Valores que vêm preenchidos em cada peça nova</h2>
        ${linha('Margem de lucro', campoUn('padroes.margem', s.padroes.margem, 'pct', '%'), 'Recomendado: no mínimo 20%')}
        ${linha('Reserva para imprevistos', campoUn('padroes.reservaPct', s.padroes.reservaPct, 'pct', '%'))}
        ${linha('Perda de corte', campoUn('padroes.perda', s.padroes.perda, 'pct', '%'))}
        ${linha('Imposto', campoUn('padroes.imposto', s.padroes.imposto, 'pct', '%'))}
        ${linha('Taxa do cartão', campoUn('padroes.cartao', s.padroes.cartao, 'pct', '%'))}
        ${linha('Comissão', campoUn('padroes.comissao', s.padroes.comissao, 'pct', '%'))}
      `)}
      ${cartao(`
        <h2>Backup</h2>
        <p>Seus dados ficam guardados só neste aparelho. Faça um backup de tempos em tempos e guarde o arquivo no Drive, no iCloud ou mande para você mesma no WhatsApp.</p>
        <p class="ajuda">${s.ultimoBackup ? `Último backup: ${dataBR(hojeISO(new Date(s.ultimoBackup)))}` : 'Nenhum backup feito ainda.'}</p>
        <div class="acoes"><button class="btn" data-acao="exportar">Fazer backup</button>
          <label class="btn sec">Restaurar um backup<input type="file" accept="application/json,.json" data-acao="importar" hidden></label></div>
      `)}
      ${cartao(`
        <h2>Apagar tudo</h2>
        <p class="ajuda">Apaga o custo da hora, todos os orçamentos e pagamentos deste aparelho. Faça um backup antes.</p>
        <div class="acoes"><button class="btn perigo" data-acao="apagarTudo">Apagar todos os dados</button></div>
      `)}
    `;
  },
};

// ---------- Ações ----------

function salvarOrcamento() {
  const s = S();
  const r = rascunho();
  const ch = chDoRascunho(r);
  const c = calcPeca(r, ch);
  if (!c.valido) return toast('Ajuste a margem ou as taxas: a soma passou de 90%.');
  if (c.custo <= 0) return toast('Preencha o tempo ou os materiais da peça antes de salvar.');
  const { id, custoFixo, ...dados } = r;
  const snap = structuredClone({ ...dados, custoHora: ch.custoHora, fracaoSalario: ch.fracaoSalario });
  const agora = new Date().toISOString();
  const existente = id && s.orcamentos.find((o) => o.id === id);
  let alvo;
  if (existente) {
    Object.assign(existente, { cliente: r.cliente, peca: r.peca, snap, atualizadoEm: agora });
    alvo = existente;
  } else {
    alvo = { id: uid(), criadoEm: agora, atualizadoEm: agora, cliente: r.cliente, peca: r.peca, status: 'enviado', snap, fechamento: null };
    s.orcamentos.push(alvo);
  }
  s.rascunho = null;
  store.salvar();
  toast(existente ? 'Alterações salvas' : 'Orçamento salvo');
  ir(`#/orcamento/${alvo.id}`);
}

function carregarNoEditor(o, comoNovo) {
  const s = S();
  const snap = structuredClone(o.snap);
  const { custoHora, fracaoSalario, ...dados } = snap;
  // Etapas criadas depois do orçamento também aparecem.
  const ids = new Set(dados.etapas.map((e) => e.id));
  dados.etapas.push(...s.etapas.filter((e) => !ids.has(e.id)).map((e) => ({ id: e.id, nome: e.nome, min: e.min, qtd: 0 })));
  s.rascunho = {
    ...novoRascunho(s), ...dados,
    id: comoNovo ? null : o.id,
    cliente: comoNovo ? '' : o.cliente,
    peca: o.peca,
    custoFixo: comoNovo ? null : { custoHora, fracaoSalario },
  };
  store.salvar();
  ir('#/peca');
}

const acoes = {
  set(el) { setPath(el.dataset.bind, el.dataset.valor); render(); },
  instalar() { promptInstalar?.prompt(); promptInstalar = null; },
  fecharInstalar() { S().avisoInstalarVisto = true; store.salvar(); render(); },
  exportar() { store.exportar().then(() => { toast('Backup criado'); render(); }); },
  addDespesa(el) {
    const id = uid();
    S().custo.despesas.push({ id, grupo: el.dataset.grupo, nome: '', valor: 0 });
    store.salvar(); render();
    document.querySelector(`[data-bind="custo.despesas#${id}.nome"]`)?.focus();
  },
  removerDespesa(el) { const c = S().custo; c.despesas = c.despesas.filter((d) => d.id !== el.dataset.id); store.salvar(); render(); },
  addPessoa() { S().custo.pessoas.push({ id: uid(), nome: 'Ajudante', dias: 0, horas: 0 }); store.salvar(); render(); },
  removerPessoa(el) { const c = S().custo; c.pessoas = c.pessoas.filter((p) => p.id !== el.dataset.id); store.salvar(); render(); },
  qtd(el) {
    const e = rascunho().etapas.find((x) => x.id === el.dataset.id);
    e.qtd = Math.max(0, e.qtd + Number(el.dataset.d));
    store.salvar();
    el.parentElement.querySelector('b').textContent = e.qtd;
    el.closest('.etapa').classList.toggle('usada', e.qtd > 0);
    atualizar();
  },
  addMat(el) { rascunho().materiais.push({ id: uid(), nome: el.dataset.nome, unidade: el.dataset.nome.match(/zíper|bojo|colchete|etiqueta|linha/i) ? 'unidade' : 'metro', qtd: 0, preco: 0 }); store.salvar(); render(); },
  removerMat(el) { const r = rascunho(); r.materiais = r.materiais.filter((m) => m.id !== el.dataset.id); store.salvar(); render(); },
  addExtra(el) { rascunho().extras.push({ id: uid(), nome: el.dataset.nome, valor: 0 }); store.salvar(); render(); },
  removerExtra(el) { const r = rascunho(); r.extras = r.extras.filter((m) => m.id !== el.dataset.id); store.salvar(); render(); },
  margem(el) { rascunho().margem = Number(el.dataset.v); store.salvar(); render(); },
  usarCustoAtual() { rascunho().custoFixo = null; store.salvar(); render(); },
  salvarOrc: salvarOrcamento,
  limparPeca() {
    const r = rascunho();
    const voltar = r.id;
    if (!voltar && (r.cliente || r.horas || r.matTotal) && !confirm('Começar outra peça? O que está preenchido aqui será apagado.')) return;
    S().rascunho = null; store.salvar();
    if (voltar) ir(`#/orcamento/${voltar}`); else render();
  },
  novaPeca() { const r = S().rascunho; if (r?.id) S().rascunho = null; },
  status(el) { acharOrc(rota().id).status = el.dataset.s; store.salvar(); render(); },
  editarOrc() { carregarNoEditor(acharOrc(rota().id), false); },
  duplicar() { carregarNoEditor(acharOrc(rota().id), true); toast('Cópia criada com o seu custo da hora atual'); },
  excluir() {
    const o = acharOrc(rota().id);
    if (!confirm(`Excluir o orçamento de ${o.cliente || 'sem nome'}? Isso não pode ser desfeito.`)) return;
    S().orcamentos = S().orcamentos.filter((x) => x.id !== o.id);
    store.salvar(); ir('#/orcamentos');
  },
  desfazerFechamento() {
    const o = acharOrc(rota().id);
    if (!confirm('Desfazer o fechamento? Os pagamentos registrados desta venda serão apagados.')) return;
    o.status = 'enviado'; o.fechamento = null; store.salvar(); render();
  },
  editParcelas() { ui.editParcelas = !ui.editParcelas; render(); },
  receber(el) {
    const o = acharOrc(el.dataset.orc || rota().id);
    const pc = o.fechamento.parcelas.find((p) => p.id === el.dataset.id);
    pc.recebidoEm = pc.recebidoEm ? null : hojeISO();
    store.salvar(); render();
    if (pc.recebidoEm) toast('Pagamento marcado como recebido');
  },
  addParcela() { const o = acharOrc(rota().id); o.fechamento.parcelas.push({ id: uid(), venc: hojeISO(), valor: 0, rotulo: 'Pagamento', recebidoEm: null }); store.salvar(); render(); },
  removerParcela(el) { const f = acharOrc(rota().id).fechamento; f.parcelas = f.parcelas.filter((p) => p.id !== el.dataset.id); store.salvar(); render(); },
  usarEntradaMin(el) { ui.fechar.entrada = Number(el.dataset.v); render(); },
  confirmarFechamento() {
    const o = acharOrc(rota().id);
    const f = ui.fechar;
    if (!(f.valor > 0)) return toast('Informe o valor fechado.');
    o.status = 'fechado';
    o.fechamento = {
      data: f.data, valor: f.valor, cartaoPct: f.cartaoPct, forma: f.forma,
      parcelas: gerarParcelas(f).map((p) => ({ ...p, id: uid(), recebidoEm: null })),
    };
    // À vista ou entrada no dia: já entra como recebido.
    const hoje = hojeISO();
    o.fechamento.parcelas.forEach((p, i) => { if (i === 0 && p.venc <= hoje && (f.forma !== 'parcelado' || f.antecipa)) p.recebidoEm = p.venc; });
    ui.fechar = null;
    store.salvar(); toast('Venda fechada'); ir(`#/orcamento/${o.id}`);
  },
  addIncluso() {
    const txt = ui.novoItem.trim();
    if (!txt) return;
    acharOrc(rota().id).proposta.incluso.push({ id: uid(), txt, on: true });
    ui.novoItem = ''; store.salvar(); render();
  },
  removerIncluso(el) { const pr = acharOrc(rota().id).proposta; pr.incluso = pr.incluso.filter((i) => i.id !== el.dataset.id); store.salvar(); render(); },
  obs(el) { const pr = acharOrc(rota().id).proposta; pr.obs = pr.obs.trim() ? `${pr.obs.trim()}\n${el.dataset.t}` : el.dataset.t; store.salvar(); render(); },
  entradaPropMin(el) { acharOrc(rota().id).proposta.entrada = Number(el.dataset.v); store.salvar(); render(); },
  verOrcCliente() {
    const o = acharOrc(rota().id);
    const pr = o.proposta;
    if (!(pr.valor > 0)) return toast('Informe o valor.');
    if (!formasDePagamento(pr).length) return toast('Marque pelo menos uma forma de pagamento.');
    ir(`#/enviar/${o.id}`);
  },
  async mandarImagem() {
    const o = acharOrc(rota().id);
    if (!imgAtual) return;
    if (await compartilhar(await pngDe(imgAtual), nomeArquivo(o, 'png'), 'image/png')) marcarEnviado(o);
  },
  async baixarPdf() {
    const o = acharOrc(rota().id);
    if (!imgAtual) return;
    if (await compartilhar(await pdfDe(imgAtual), nomeArquivo(o, 'pdf'), 'application/pdf')) marcarEnviado(o);
  },
  async copiarTexto() {
    const o = acharOrc(rota().id);
    const txt = textoProposta(o, o.proposta, S().atelie);
    try { await navigator.clipboard.writeText(txt); } catch {
      const t = document.createElement('textarea');
      t.value = txt; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    }
    marcarEnviado(o);
    toast('Texto copiado. É só colar no WhatsApp.');
  },
  removerLogo() { S().atelie.logo = null; store.salvar(); render(); },
  mes(el) { ui.mes = mesDe(somaMeses(`${ui.mes}-01`, Number(el.dataset.d))); render(); },
  apagarTudo() {
    if (!confirm('Apagar TODOS os dados deste aparelho? Isso não pode ser desfeito.')) return;
    if (!confirm('Tem certeza? Sem backup, não há como recuperar.')) return;
    store.apagarTudo(); toast('Dados apagados'); ir('#/inicio');
  },
};

// ---------- Eventos ----------

$main.addEventListener('input', (ev) => {
  const el = ev.target;
  if (!el.dataset.bind || el.type === 'checkbox') return;
  setPath(el.dataset.bind, lerCampo(el.value, el.dataset.tipo));
  if (el.type === 'date' || el.tagName === 'SELECT') return render();
  atualizar();
});

$main.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.type === 'checkbox' && el.dataset.bind) { setPath(el.dataset.bind, el.checked); render(); return; }
  if (el.dataset.acao === 'logo' && el.files[0]) {
    prepararLogo(el.files[0]).then((logo) => { S().atelie.logo = logo; store.salvar(); render(); toast('Logo salva'); })
      .catch((e) => toast(e.message));
    return;
  }
  if (el.dataset.acao === 'importar' && el.files[0]) {
    if (!confirm('Restaurar este backup? Os dados atuais deste aparelho serão substituídos.')) { el.value = ''; return; }
    store.importar(el.files[0]).then(() => { toast('Backup restaurado'); ir('#/inicio'); }).catch((e) => toast(e.message || 'Não foi possível ler o arquivo.'));
  }
});

// Ao sair do campo, mostra o número formatado (1500 → 1.500).
$main.addEventListener('focusout', (ev) => {
  const el = ev.target;
  if (!el.dataset?.bind || ['text', 'date'].includes(el.dataset.tipo) || el.type === 'checkbox') return;
  const r = resolver(el.dataset.bind);
  if (r) el.value = valorCampo(r.alvo[r.chave], el.dataset.tipo);
});

$main.addEventListener('focusin', (ev) => {
  const el = ev.target;
  if (el.dataset?.tipo && !['text', 'date'].includes(el.dataset.tipo)) requestAnimationFrame(() => el.select?.());
});

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-acao]');
  if (!el || el.tagName === 'INPUT') return;
  const f = acoes[el.dataset.acao];
  if (!f) return;
  if (el.tagName === 'BUTTON') ev.preventDefault();
  f(el);
});

window.addEventListener('hashchange', () => { ui.editParcelas = false; render(); window.scrollTo(0, 0); });
window.addEventListener('pagehide', store.gravar);
document.addEventListener('visibilitychange', () => { if (document.hidden) store.gravar(); });

// ---------- Início ----------

store.carregar();
store.pedirArmazenamentoPersistente();
render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
