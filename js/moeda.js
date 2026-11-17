// Moeda dos valores: para alunas que trabalham fora do Brasil.
// Só muda o símbolo e as casas decimais; os números continuam no jeito brasileiro (1.234,56).
// Não converte valores: quem troca a moeda passa a digitar os preços na moeda nova.
//
// ATENÇÃO: este arquivo é igual no Quanto Cobrar e no Preço Fácil. Se mudar aqui, copie para o outro.

// [código, nome, símbolo, casas decimais]
export const MOEDAS = [
  ['BRL', 'Real (Brasil)', 'R$', 2],
  ['EUR', 'Euro', '€', 2],
  ['USD', 'Dólar americano', 'US$', 2],
  ['GBP', 'Libra (Reino Unido)', '£', 2],
  ['CHF', 'Franco suíço', 'CHF', 2],
  ['CAD', 'Dólar canadense', 'CA$', 2],
  ['AUD', 'Dólar australiano', 'AU$', 2],
  ['JPY', 'Iene (Japão)', '¥', 0],
  ['AOA', 'Kwanza (Angola)', 'Kz', 2],
  ['MZN', 'Metical (Moçambique)', 'MT', 2],
  ['CVE', 'Escudo (Cabo Verde)', 'CVE', 2],
  ['ARS', 'Peso argentino', 'AR$', 2],
  ['CLP', 'Peso chileno', 'CLP$', 0],
  ['UYU', 'Peso uruguaio', '$U', 2],
  ['PYG', 'Guarani (Paraguai)', '₲', 0],
  ['MXN', 'Peso mexicano', 'MX$', 2],
];

let atual = MOEDAS[0];
const formatos = new Map();

export function usarMoeda(codigo) {
  atual = MOEDAS.find((m) => m[0] === codigo) || MOEDAS[0];
}
export const moedaAtual = () => atual[0];
export const simbolo = () => atual[2];
export const nomeMoeda = (codigo = atual[0]) => (MOEDAS.find((m) => m[0] === codigo) || MOEDAS[0])[1];

function formato(casas, minimo) {
  const k = `${casas}-${minimo}`;
  if (!formatos.has(k)) formatos.set(k, new Intl.NumberFormat('pt-BR', { minimumFractionDigits: minimo, maximumFractionDigits: casas }));
  return formatos.get(k);
}

// 1234.5 → "R$ 1.234,50" (ou "€ 1.234,50", "¥ 1.235"…)
export function dinheiro(v) {
  const n = Number.isFinite(Number(v)) ? Number(v) : 0;
  const txt = formato(atual[3], atual[3]).format(Math.abs(n));
  return `${n < 0 ? '−' : ''}${atual[2]} ${txt}`;
}

// Igual, mas sem centavos quando o valor é redondo: "R$ 150" em vez de "R$ 150,00".
export function dinheiroRedondo(v) {
  const n = Number(v) || 0;
  if (!Number.isInteger(n)) return dinheiro(n);
  return `${n < 0 ? '−' : ''}${atual[2]} ${formato(0, 0).format(Math.abs(n))}`;
}

// As opções para um <select>, com a moeda atual marcada.
export const opcoesMoeda = (codigo = atual[0]) => MOEDAS
  .map(([c, nome, s]) => `<option value="${c}"${c === codigo ? ' selected' : ''}>${nome} · ${s}</option>`).join('');
