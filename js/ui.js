// Formatação, leitura de números em português e pequenos componentes de tela.
import { PARTES } from './calc.js';
import { dinheiro } from './moeda.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fmtNum = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

// Valor em dinheiro, na moeda escolhida em Ajustes (o nome brl ficou do tempo em que era só real).
export const brl = (v) => dinheiro(Number.isFinite(v) ? v : 0);
export const num = (v) => fmtNum.format(Number.isFinite(v) ? v : 0);
export const pct = (v) => `${fmtNum.format((Number(v) || 0) * 100)}%`;

// "1.234,56" → 1234.56 ; "1500" → 1500 ; "1,5" → 1.5
export function parseNum(s) {
  s = String(s ?? '').trim().replace(/[^\d,.-]/g, ''); // tira símbolo da moeda, %, espaços
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
}

// Tempo: "1:30" → 90 min ; "2" → 120 ; "1,5" → 90
export function parseTempo(s) {
  s = String(s ?? '').trim();
  if (!s) return 0;
  const m = s.match(/^(\d+)\s*[:h]\s*(\d{0,2})/i);
  if (m) return Number(m[1]) * 60 + Number(m[2] || 0);
  return Math.round(parseNum(s) * 60);
}

export const minTxt = (min) => {
  const h = Math.floor((min || 0) / 60);
  const m = Math.round((min || 0) % 60);
  return `${h}:${String(m).padStart(2, '0')}`;
};

export function horasTxt(h) {
  const total = Math.round((h || 0) * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  if (!mm) return `${hh}h`;
  return hh ? `${hh}h${String(mm).padStart(2, '0')}` : `${mm} min`;
}

export const dataBR = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const mesNome = (m) => `${MESES[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}`;
export const maiuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const mesCurto = (m) => `${MESES[Number(m.slice(5, 7)) - 1]}`;

// Valor exibido no campo conforme o tipo.
export function valorCampo(v, tipo) {
  if (tipo === 'text' || tipo === 'date') return v ?? '';
  if (tipo === 'pct') return v ? fmtNum.format(v * 100) : '0';
  if (tipo === 'tempo') return v ? minTxt(v) : '';
  if (tipo === 'int') return v ?? '';
  return v ? fmtNum.format(v) : '';
}

export function lerCampo(s, tipo) {
  if (tipo === 'text' || tipo === 'date') return s;
  if (tipo === 'pct') return parseNum(s) / 100;
  if (tipo === 'tempo') return parseTempo(s);
  if (tipo === 'int') return Math.max(0, Math.round(parseNum(s)));
  return parseNum(s);
}

// Campo ligado a um caminho do estado (data-bind).
export function campo(bind, valor, tipo = 'money', attrs = '') {
  const modo = tipo === 'text' ? 'text' : 'decimal';
  const ph = { money: '0,00', pct: '0', tempo: '0:00', num: '0', int: '0' }[tipo] || '';
  const type = tipo === 'date' ? 'date' : 'text';
  return `<input type="${type}" inputmode="${tipo === 'date' ? '' : modo}" data-bind="${esc(bind)}" data-tipo="${tipo}" value="${esc(valorCampo(valor, tipo))}"${attrs.includes('placeholder=') ? '' : ` placeholder="${ph}"`} ${attrs}>`;
}

// Campo com prefixo/sufixo (R$, %, h).
export function campoUn(bind, valor, tipo, un, attrs = '') {
  const antes = tipo === 'money';
  return `<label class="campo-un ${antes ? 'pre' : 'suf'}">${antes ? `<span>${un}</span>` : ''}${campo(bind, valor, tipo, attrs)}${antes ? '' : `<span>${un}</span>`}</label>`;
}

export function linha(rotulo, controle, ajuda = '') {
  return `<div class="linha"><div class="linha-rot"><span>${rotulo}</span>${ajuda ? `<small>${ajuda}</small>` : ''}</div><div class="linha-ctl">${controle}</div></div>`;
}

export function segmentado(bind, valor, opcoes) {
  return `<div class="seg" role="radiogroup">${opcoes.map(([v, t]) => `<button type="button" role="radio" aria-checked="${v === valor}" data-acao="set" data-bind="${esc(bind)}" data-valor="${esc(v)}">${t}</button>`).join('')}</div>`;
}

// Barra empilhada + legenda com a divisão do dinheiro.
export function barra(comp, opts = {}) {
  const partes = PARTES.map((p) => ({ ...p, v: comp[p.k] || 0 })).filter((p) => p.v > 0.004);
  const total = partes.reduce((t, p) => t + p.v, 0);
  if (total <= 0) return '<p class="vazio-mini">Nada para mostrar ainda.</p>';
  const segs = partes.map((p) => `<span class="seg-${p.k}" style="flex-grow:${p.v}" title="${p.nome}"></span>`).join('');
  const leg = partes.map((p) => `<li><i class="cor-${p.k}"></i><span>${p.nome}</span><b>${brl(p.v)}</b><em>${Math.round((p.v / total) * 100)}%</em></li>`).join('');
  const prejuizo = (comp.lucro || 0) < -0.5
    ? `<p class="alerta perigo">Prejuízo de <b>${brl(-comp.lucro)}</b>: o valor não cobre os custos desta venda.</p>` : '';
  return `<div class="barra" aria-hidden="true">${segs}</div>${opts.legenda === false ? '' : `<ul class="legenda">${leg}</ul>`}${prejuizo}`;
}

// Frase "Dos R$ 1.000: R$ 200 de materiais, ..."
export function frase(comp, total, verbo = 'recebidos') {
  const partes = PARTES.map((p) => ({ ...p, v: comp[p.k] || 0 })).filter((p) => p.v > 0.5);
  if (!partes.length) return '';
  const itens = partes.map((p) => `<b>${brl(p.v)}</b> ${p.k === 'lucro' ? 'de lucro' : p.k === 'salario' ? 'do seu salário' : `de ${p.nome.toLowerCase()}`}`);
  const ultimo = itens.pop();
  return `Dos ${brl(total)} ${verbo}: ${itens.length ? `${itens.join(', ')} e ${ultimo}` : ultimo}.`;
}

let toastTimer;
export function toast(msg) {
  let el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 2600);
}
