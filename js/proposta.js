// O orçamento que vai para a cliente: só o que ela precisa saber.
// Nunca mostra custo da hora, despesas, margem, reserva nem a divisão do dinheiro.
import { entradaMinima, taxaVenda, hojeISO } from './calc.js';
import { dinheiro } from './moeda.js';

const n = (v) => Number(v) || 0;
const brl = (v) => dinheiro(n(v));
const dataBR = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
const uid = () => Math.random().toString(36).slice(2, 10);

export function somaDias(iso, dias) {
  const [a, m, d] = iso.split('-').map(Number);
  return hojeISO(new Date(a, m - 1, d + dias));
}

// ---------- O que está incluso: sugestões a partir do cálculo ----------

const DE_ETAPA = [
  [/medidas/i, 'Tirar medidas'],
  [/modelagem/i, 'Modelagem sob medida'],
  [/bordado/i, 'Bordado à mão'],
  [/passar|acabamento/i, 'Passadoria e acabamento'],
  [/embalar/i, 'Embalagem para entrega'],
];
const DE_EXTRA = [
  [/lavanderia/i, 'Lavanderia'],
  [/bordad/i, 'Bordado'],
  [/embalagem|sacola/i, 'Embalagem'],
  [/cabide|capa/i, 'Cabide e capa protetora'],
  [/frete|entrega/i, 'Entrega'],
];
// Opções gerais, desmarcadas; somem quando já existe um item parecido.
const GERAIS = [
  ['Tecido e aviamentos', /tecido|aviamento/i], ['Modelagem sob medida', /modelagem/i], ['Provas e ajustes', /prova/i],
  ['Acabamento', /acabamento/i], ['Embalagem', /embala/i],
];

export function sugestoesIncluso(snap) {
  const marcadas = [];
  if (snap.modoMat === 'lista') {
    snap.materiais.filter((m) => n(m.qtd) && m.nome).forEach((m) => marcadas.push(m.nome));
  } else if (n(snap.matTotal)) marcadas.push('Tecido e aviamentos');
  if (snap.modoHoras === 'etapas') {
    for (const e of snap.etapas.filter((x) => x.qtd)) {
      if (/prova/i.test(e.nome)) marcadas.push(e.qtd > 1 ? `${e.qtd} provas com ajuste` : '1 prova com ajuste');
      const m = DE_ETAPA.find(([re]) => re.test(e.nome));
      if (m) marcadas.push(m[1]);
    }
  }
  for (const x of snap.extras.filter((e) => e.valor)) {
    const m = DE_EXTRA.find(([re]) => re.test(x.nome));
    if (m) marcadas.push(m[1]);
  }
  const vistos = new Set();
  const unico = (t) => { const k = t.toLowerCase(); if (vistos.has(k)) return false; vistos.add(k); return true; };
  marcadas.splice(0, marcadas.length, ...marcadas.filter(unico));
  return [
    ...marcadas.map((txt) => ({ id: uid(), txt, on: true })),
    ...GERAIS.filter(([, re]) => !marcadas.some((m) => re.test(m))).map(([txt]) => ({ id: uid(), txt, on: false })),
  ];
}

// ---------- Valores ----------

const arredonda10 = (v) => Math.ceil(n(v) / 10) * 10;

export function novaProposta(snap, r) {
  const valor = Math.ceil(r.preco);
  return {
    base: r.preco, // preço calculado quando a proposta foi criada
    valor,
    formas: { avista: true, entrada: false, cartao: false },
    entrada: Math.min(valor, arredonda10(Math.max(entradaMinima(r, taxaVenda(snap)), valor / 2))),
    parcelas: 3,
    taxaCartao: 0,
    incluso: sugestoesIncluso(snap),
    prazo: '',
    validade: '7',
    obs: '',
    data: hojeISO(),
    enviadoEm: null,
  };
}

// No cartão ela recebe o valor menos a taxa da maquininha; o valor no cartão cobre essa taxa.
export function valorNoCartao(valor, taxa) {
  const t = Math.min(n(taxa), 0.5);
  return t > 0 ? Math.ceil(n(valor) / (1 - t)) : n(valor);
}

export function formasDePagamento(pr) {
  const out = [];
  const v = n(pr.valor);
  if (pr.formas.avista) out.push(`À vista (Pix ou dinheiro): ${brl(v)}`);
  if (pr.formas.entrada) {
    const e = Math.min(n(pr.entrada), v);
    out.push(e < v ? `Entrada de ${brl(e)} para reservar e ${brl(v - e)} na entrega` : `${brl(v)} para reservar`);
  }
  if (pr.formas.cartao) {
    const c = valorNoCartao(v, pr.taxaCartao);
    const q = Math.max(1, Math.round(n(pr.parcelas)));
    out.push(q > 1 ? `No cartão: ${brl(c)} em até ${q}x de ${brl(c / q)}` : `No cartão: ${brl(c)}`);
  }
  return out;
}

export const validoAte = (pr) => somaDias(pr.data || hojeISO(), n(pr.validade) || 7);

const contatos = (a) => [a.whatsapp && `WhatsApp ${a.whatsapp}`, a.instagram && `@${a.instagram.replace(/^@/, '')}`].filter(Boolean);

export function textoProposta(o, pr, a) {
  const inc = pr.incluso.filter((i) => i.on && i.txt.trim());
  return [
    a.nome ? `*${a.nome}*` : null,
    `Orçamento para ${o.cliente || 'você'}`,
    '',
    `*${o.peca || 'Peça sob medida'}*`,
    `Valor: *${brl(pr.valor)}*`,
    '',
    'Formas de pagamento:',
    ...formasDePagamento(pr).map((l) => `• ${l}`),
    ...(inc.length ? ['', 'O que está incluso:', ...inc.map((i) => `✓ ${i.txt.trim()}`)] : []),
    ...(pr.prazo ? ['', `Prazo de entrega: ${dataBR(pr.prazo)}`] : []),
    ...(pr.obs.trim() ? ['', pr.obs.trim()] : []),
    '',
    `Orçamento válido até ${dataBR(validoAte(pr))}`,
    ...(contatos(a).length ? [contatos(a).join(' · ')] : []),
  ].filter((l) => l !== null).join('\n');
}

// ---------- Imagem ----------

const COR = { acento: '#A8452F', tinta: '#2A2320', tinta2: '#6B5F58', linha: '#ECE3DB', fundo: '#FFFFFF', suave: '#FBF7F3' };

function quebrar(ctx, texto, largura) {
  const out = [];
  for (const par of String(texto).split('\n')) {
    let atual = '';
    for (const p of par.split(/\s+/).filter(Boolean)) {
      const teste = atual ? `${atual} ${p}` : p;
      if (ctx.measureText(teste).width > largura && atual) { out.push(atual); atual = p; } else atual = teste;
    }
    out.push(atual);
  }
  return out;
}

const carregarImg = (src) => new Promise((ok) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = () => ok(null);
  img.src = src;
});

export async function canvasProposta(o, pr, a) {
  if (document.fonts?.ready) await document.fonts.ready;
  const W = 1080;
  const M = 84;
  const serif = '"Fraunces", Georgia, serif';
  const sans = '"Inter", system-ui, sans-serif';
  const logo = a.logo ? await carregarImg(a.logo) : null;

  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');

  // Cada bloco: texto já quebrado em linhas, com fonte, cor, espaço antes e recuo.
  const blocos = [];
  const add = (texto, fonte, cor, antes, extra = {}) => {
    ctx.font = fonte;
    const recuo = extra.recuo || 0;
    const ls = quebrar(ctx, texto, W - 2 * M - recuo);
    const tam = parseInt(fonte.match(/(\d+)px/)[1], 10);
    blocos.push({ ls, fonte, cor, antes, alt: tam * 1.32, recuo, ...extra });
  };
  const titulo = (t) => add(t.toUpperCase(), `600 26px ${sans}`, COR.acento, 56, { espaco: 0.12 });

  add(`Orçamento para ${o.cliente || 'você'}`, `500 36px ${sans}`, COR.tinta2, 64);
  add(o.peca || 'Peça sob medida', `600 62px ${serif}`, COR.tinta, 10);
  add(brl(pr.valor), `600 112px ${serif}`, COR.acento, 26, { linhaDepois: true });

  titulo('Formas de pagamento');
  formasDePagamento(pr).forEach((l, i) => add(l, `400 34px ${sans}`, COR.tinta, i ? 10 : 18, { marca: '•', recuo: 40 }));

  const inc = pr.incluso.filter((i) => i.on && i.txt.trim());
  if (inc.length) {
    titulo('O que está incluso');
    inc.forEach((i, k) => add(i.txt.trim(), `400 34px ${sans}`, COR.tinta, k ? 10 : 18, { marca: '✓', recuo: 48 }));
  }
  if (pr.prazo) {
    titulo('Prazo de entrega');
    add(dataBR(pr.prazo), `600 40px ${sans}`, COR.tinta, 16);
  }
  if (pr.obs.trim()) {
    titulo('Observações');
    add(pr.obs.trim(), `400 32px ${sans}`, COR.tinta, 16);
  }
  add(`Orçamento válido até ${dataBR(validoAte(pr))}`, `500 30px ${sans}`, COR.tinta2, 56);

  const topo = logo ? 280 : 210;
  const corpo = blocos.reduce((t, b) => t + b.antes + b.ls.length * b.alt + (b.linhaDepois ? 30 : 0), 0);
  const cont = contatos(a);
  const rodape = cont.length ? 150 : 64;
  c.width = W;
  c.height = topo + corpo + rodape;

  ctx.fillStyle = COR.fundo;
  ctx.fillRect(0, 0, W, c.height);
  ctx.fillStyle = COR.acento;
  ctx.fillRect(0, 0, W, 14);

  // Topo: logo e nome do ateliê
  let xNome = M;
  if (logo) {
    const lado = 170;
    const k = Math.min(lado / logo.width, lado / logo.height);
    const lw = logo.width * k;
    const lh = logo.height * k;
    ctx.drawImage(logo, M, 60 + (lado - lh) / 2, lw, lh);
    xNome = M + lw + 36;
  }
  const yNome = logo ? 150 : 120;
  ctx.fillStyle = COR.tinta;
  ctx.font = `600 52px ${serif}`;
  ctx.textBaseline = 'alphabetic';
  const nome = quebrar(ctx, a.nome || 'Orçamento', W - xNome - M)[0];
  ctx.fillText(nome, xNome, yNome);
  ctx.fillStyle = COR.tinta2;
  ctx.font = `500 26px ${sans}`;
  ctx.fillText(`ORÇAMENTO · ${dataBR(pr.data || hojeISO())}`, xNome, yNome + 48);
  ctx.fillStyle = COR.linha;
  ctx.fillRect(M, topo - 24, W - 2 * M, 3);

  let y = topo - 40;
  for (const b of blocos) {
    y += b.antes;
    ctx.font = b.fonte;
    ctx.fillStyle = b.cor;
    if ('letterSpacing' in ctx) ctx.letterSpacing = b.espaco ? '3px' : '0px';
    b.ls.forEach((l, i) => {
      y += b.alt;
      const base = y - b.alt * 0.24;
      if (b.marca && i === 0) {
        ctx.fillStyle = COR.acento;
        ctx.fillText(b.marca, M, base);
        ctx.fillStyle = b.cor;
      }
      ctx.fillText(l, M + b.recuo, base);
    });
    if (b.linhaDepois) {
      y += 30;
      ctx.fillStyle = COR.linha;
      ctx.fillRect(M, y, W - 2 * M, 3);
    }
  }
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

  if (cont.length) {
    ctx.fillStyle = COR.suave;
    ctx.fillRect(0, c.height - 120, W, 120);
    ctx.fillStyle = COR.acento;
    ctx.font = `600 34px ${sans}`;
    ctx.fillText(quebrar(ctx, cont.join('   ·   '), W - 2 * M)[0], M, c.height - 48);
  }
  return c;
}

export const pngDe = (c) => new Promise((ok) => c.toBlob(ok, 'image/png'));

// ---------- PDF: uma página com a imagem do orçamento, sem bibliotecas ----------

export async function pdfDe(c) {
  const jpeg = new Uint8Array(await (await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.92))).arrayBuffer());
  return montarPdf(jpeg, c.width, c.height);
}

export function montarPdf(jpeg, w, h) {
  const PW = 595.28; // largura A4 em pontos
  const PH = Math.round((PW * h / w) * 100) / 100;
  const enc = new TextEncoder();
  const partes = [];
  const offsets = [];
  let tam = 0;
  const put = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; partes.push(b); tam += b.length; };
  const obj = (i, corpo) => { offsets[i] = tam; put(`${i} 0 obj\n`); corpo(); put('\nendobj\n'); };
  const cont = `q ${PW} 0 0 ${PH} 0 0 cm /Im0 Do Q`;

  put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, () => put('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => put('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
  obj(3, () => put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`));
  obj(4, () => {
    put(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    put(jpeg);
    put('\nendstream');
  });
  obj(5, () => put(`<< /Length ${cont.length} >>\nstream\n${cont}\nendstream`));
  const xref = tam;
  put(`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`);
  put(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(partes, { type: 'application/pdf' });
}

// ---------- Logo: diminui para não pesar no celular ----------

export async function prepararLogo(arquivo) {
  const url = URL.createObjectURL(arquivo);
  const img = await carregarImg(url);
  URL.revokeObjectURL(url);
  if (!img) throw new Error('Não foi possível abrir essa imagem.');
  const max = 360;
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const png = c.toDataURL('image/png');
  if (png.length < 250000) return png;
  // Muito pesada em PNG: usa JPEG com fundo branco.
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}
