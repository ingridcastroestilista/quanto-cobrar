// Código do mês: o mesmo para o Ateliê em Dia e o Quanto Cobrar, muda todo mês.
// A Ingrid põe o código na descrição da aula; a aluna digita uma vez por mês.
// O app calcula sozinho o código de cada mês (não precisa de internet nem de servidor).
// Na virada do mês há 7 dias de tolerância: o app avisa, mas não bloqueia.
// Os dados nunca são apagados: a tela de código só cobre o app até ela digitar.
//
// ATENÇÃO: este arquivo é igual nos dois apps. Se mudar aqui, copie para o outro.

const SEGREDO = 'ica·costura·2026·fio-de-ouro';
const PALAVRAS = ['BOTAO', 'LINHA', 'AGULHA', 'TESOURA', 'RENDA', 'CETIM', 'SEDA', 'BORDADO', 'PREGA', 'BAINHA',
  'MOLDE', 'VELUDO', 'TULE', 'FITA', 'ZIPER', 'FRANZIDO', 'ALINHAVO', 'DEDAL', 'GOLA', 'BABADO'];
export const TOLERANCIA = 7;
const CHAVE = 'ica-acesso';

// Embaralhador simples (cyrb53): o mesmo texto sempre dá o mesmo número.
function embaralhar(txt, semente = 0) {
  let h1 = 0xdeadbeef ^ semente;
  let h2 = 0x41c6ce57 ^ semente;
  for (let i = 0; i < txt.length; i++) {
    const c = txt.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

// "2026-11" → "RENDA-4821"
export function codigoDoMes(ym) {
  const n = embaralhar(`${SEGREDO}|${ym}`);
  return `${PALAVRAS[n % PALAVRAS.length]}-${1000 + (Math.floor(n / PALAVRAS.length) % 9000)}`;
}

const limpar = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
// Enquanto ela digita: maiúsculas e o traço aparece sozinho entre a palavra e os números ("bainha5" → "BAINHA-5").
export function formatarCodigo(txt) {
  const t = limpar(txt);
  const letras = t.match(/^[A-Z]*/)[0];
  const resto = t.slice(letras.length);
  return resto ? `${letras}-${resto}`.slice(0, letras.length + 5) : letras;
}
const mesDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const mesAnterior = (ym) => { const [a, m] = ym.split('-').map(Number); return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`; };
const NOMES_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const nomeMes = (ym) => NOMES_MES[Number(ym.slice(5, 7)) - 1];

// Qual mês o código digitado libera (o atual ou, na tolerância, o anterior). null se não confere.
export function conferir(texto, hoje = new Date()) {
  const t = limpar(texto);
  if (!t) return null;
  const atual = mesDe(hoje);
  if (t === limpar(codigoDoMes(atual))) return atual;
  if (hoje.getDate() <= TOLERANCIA && t === limpar(codigoDoMes(mesAnterior(atual)))) return mesAnterior(atual);
  return null;
}

// 'ok' (código do mês já digitado), 'aviso' (virou o mês, ainda na tolerância) ou 'bloqueado'.
export function situacao(mesLiberado, hoje = new Date()) {
  const atual = mesDe(hoje);
  if (mesLiberado === atual) return 'ok';
  if (mesLiberado === mesAnterior(atual) && hoje.getDate() <= TOLERANCIA) return 'aviso';
  return 'bloqueado';
}

// ---------- Tela do código ----------

function ler() { try { return JSON.parse(localStorage.getItem(CHAVE))?.mes || ''; } catch { return ''; } }
function gravar(mes) { try { localStorage.setItem(CHAVE, JSON.stringify({ mes, em: new Date().toISOString() })); } catch { /* sem espaço */ } }

function estilo(cor) {
  const s = document.createElement('style');
  s.textContent = `
  .acesso{position:fixed;inset:0;z-index:9999;background:#FBF8F6;display:flex;align-items:center;justify-content:center;padding:24px;overflow:auto;font-family:'Inter',system-ui,sans-serif;color:#2B2522}
  .acesso-caixa{width:100%;max-width:400px;text-align:center}
  .acesso img{width:84px;height:84px;border-radius:20px;margin-bottom:14px}
  .acesso h1{font:600 28px/1.2 'Fraunces',Georgia,serif;margin:0 0 8px}
  .acesso p{margin:0 0 14px;font-size:17px;line-height:1.45;color:#5B524D}
  .acesso input{width:100%;box-sizing:border-box;font:600 22px 'Inter',system-ui,sans-serif;text-align:center;letter-spacing:.08em;text-transform:uppercase;padding:14px;border:2px solid #E2D8D3;border-radius:14px;background:#fff;margin:6px 0 10px}
  .acesso input:focus{outline:none;border-color:${cor}}
  .acesso button{width:100%;font:600 19px 'Inter',system-ui,sans-serif;padding:15px;border-radius:14px;border:0;background:${cor};color:#fff;cursor:pointer}
  .acesso .acesso-sec{background:none;color:${cor};font-size:16px;padding:12px;margin-top:4px}
  .acesso .acesso-erro{color:#A3261D;font-weight:500;min-height:1.4em;margin:0 0 8px}
  .acesso small{display:block;margin-top:18px;font-size:13px;color:#8A817C}
  .acesso-aviso{position:fixed;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom) + 12px);z-index:9998;max-width:520px;margin:0 auto;background:#2B2522;color:#fff;border-radius:16px;padding:12px 14px;display:flex;gap:10px;align-items:center;font:500 15px/1.35 'Inter',system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.2)}
  .acesso-aviso span{flex:1}
  .acesso-aviso button{flex:none;border:0;border-radius:10px;padding:9px 12px;font:600 15px 'Inter',system-ui,sans-serif;background:#fff;color:${cor};cursor:pointer}
  .acesso-aviso .x{background:none;color:#fff;padding:9px 6px}`;
  document.head.appendChild(s);
}

function telaCodigo({ nome, icone }, podeFechar, aoLiberar) {
  const hoje = new Date();
  const mes = nomeMes(mesDe(hoje));
  const el = document.createElement('div');
  el.className = 'acesso';
  el.setAttribute('role', 'dialog');
  el.innerHTML = `<form class="acesso-caixa" novalidate>
      ${icone ? `<img src="${icone}" alt="">` : ''}
      <h1>Código de ${mes}</h1>
      <p>Para usar o ${nome}, digite o código do mês. Ele está na descrição da aula do curso.</p>
      <input name="codigo" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Ex.: LINHA1234" aria-label="Código do mês">
      <p class="acesso-erro" aria-live="polite"></p>
      <button type="submit">Entrar</button>
      ${podeFechar ? '<button type="button" class="acesso-sec" data-fechar>Depois</button>' : ''}
      <small>Seus dados continuam guardados neste celular.<br>O código muda todo mês.</small>
    </form>`;
  const form = el.querySelector('form');
  const campo = el.querySelector('input');
  campo.addEventListener('input', () => {
    if (campo.selectionStart !== campo.value.length) return; // editando no meio: não mexe no cursor
    const f = formatarCodigo(campo.value);
    if (f !== campo.value) campo.value = f;
    el.querySelector('.acesso-erro').textContent = '';
  });
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const liberado = conferir(campo.value);
    if (!liberado) { el.querySelector('.acesso-erro').textContent = `Código não confere. Confira o código de ${mes} na aula.`; campo.select(); return; }
    gravar(liberado);
    el.remove();
    aoLiberar?.();
  });
  el.querySelector('[data-fechar]')?.addEventListener('click', () => el.remove());
  document.body.appendChild(el);
  setTimeout(() => campo.focus(), 50);
}

function avisoVirada(cfg) {
  const mes = nomeMes(mesDe(new Date()));
  const el = document.createElement('div');
  el.className = 'acesso-aviso';
  el.innerHTML = `<span>Já tem código novo de ${mes} na aula. Digite até o dia ${TOLERANCIA}.</span><button type="button">Digitar</button><button type="button" class="x" aria-label="Fechar">✕</button>`;
  el.querySelector('button').addEventListener('click', () => { el.remove(); telaCodigo(cfg, true); });
  el.querySelector('.x').addEventListener('click', () => el.remove());
  document.body.appendChild(el);
}

// Chamado ao abrir o app. cfg: { nome, icone, cor }
export function protegerApp(cfg) {
  estilo(cfg.cor || '#6E2A3C');
  const verificar = () => {
    if (document.querySelector('.acesso')) return;
    const s = situacao(ler());
    if (s === 'bloqueado') telaCodigo(cfg, false);
    else if (s === 'aviso' && !document.querySelector('.acesso-aviso')) avisoVirada(cfg);
  };
  verificar();
  // O app pode ficar aberto dias no celular: confere de novo quando ela volta para ele.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) verificar(); });
}
