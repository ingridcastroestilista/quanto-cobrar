// Dados guardados no próprio aparelho (localStorage) + backup em arquivo.

const CHAVE = 'quanto-cobrar:v1';
export const VERSAO = 1;

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export const GRUPOS = [
  { k: 'espaco', nome: 'Espaço físico', itens: ['Aluguel', 'Luz', 'Água', 'Internet e celular', 'Produtos de limpeza', 'IPTU / condomínio', 'Seguro', 'Café e copa'] },
  { k: 'pessoas', nome: 'Pessoas', itens: ['Faxina', 'Colaborador(a)', 'Terceirizado fixo'] },
  { k: 'marketing', nome: 'Marketing', itens: ['Anúncios / tráfego pago', 'Canva e apps', 'Nuvem (iCloud, Drive)'] },
  { k: 'transporte', nome: 'Transporte e maquinário', itens: ['Combustível', 'Manutenção das máquinas', 'Amolar tesouras', 'Estacionamento', 'Agulhas e peças'] },
  { k: 'escritorio', nome: 'Escritório', itens: ['Contador', 'Taxas do banco', 'Papel e tinta', 'Jurídico', 'Empréstimo'] },
  { k: 'provisoes', nome: 'Reservas do mês', itens: ['Imprevistos', 'Reserva / investimento', 'Reforma e manutenção'] },
];

// Tempo de referência (média de ateliê), em minutos — da Planilha Alunas.
const ETAPAS = [
  ['Atendimento online / orçamento', 30], ['Atendimento presencial', 60], ['Tirar medidas', 45],
  ['Comprar tecidos e aviamentos', 120], ['Modelagem simples', 180], ['Modelagem complexa', 360],
  ['Corte', 120], ['Entretelar', 60], ['Costura — peça simples', 360], ['Costura — peça complexa', 840],
  ['Colocar zíper', 40], ['Barra simples', 40], ['Barra com crinol', 120], ['Barra lenço', 90],
  ['Barra envelopada', 60], ['Prova e ajuste', 90], ['Bordado manual (por hora)', 60],
  ['Passar e acabamento', 60], ['Embalar e entregar', 20],
];

export const SUGESTOES_MATERIAL = ['Tecido principal', 'Forro', 'Entretela', 'Zíper', 'Linha', 'Bojo', 'Barbatana', 'Renda', 'Tule', 'Crinol', 'Colchete', 'Etiqueta'];
export const SUGESTOES_EXTRA = ['Lavanderia', 'Bordadeira / terceirizado', 'Embalagem e sacola', 'Cabide e capa', 'Tag e etiqueta', 'Mimo / brinde', 'Frete ou entrega'];

export const PADROES = { margem: 0.2, produtividade: 0.7, reservaPct: 0.1, perda: 0.1, imposto: 0, cartao: 0, comissao: 0 };

function estadoInicial() {
  return {
    versao: VERSAO,
    criadoEm: new Date().toISOString(),
    custo: {
      proLabore: 0,
      provisoes: true,
      produtividade: PADROES.produtividade,
      pessoas: [{ id: uid(), nome: 'Eu', dias: 22, horas: 8 }],
      despesas: GRUPOS.flatMap((g) => g.itens.map((nome) => ({ id: uid(), grupo: g.k, nome, valor: 0 }))),
      atualizadoEm: null,
    },
    etapas: ETAPAS.map(([nome, min]) => ({ id: uid(), nome, min, ref: min })),
    padroes: { ...PADROES },
    metas: { faturamento: 0, lucro: 0 },
    atelie: { nome: '', whatsapp: '', instagram: '', logo: null }, // aparece no orçamento da cliente
    rascunho: null,
    orcamentos: [],
    ultimoBackup: null,
    avisoInstalarVisto: false,
  };
}

export function novoRascunho(state) {
  const p = state.padroes;
  return {
    id: null, cliente: '', peca: '',
    modoHoras: 'direto', horas: 0,
    etapas: state.etapas.map((e) => ({ id: e.id, nome: e.nome, min: e.min, qtd: 0 })),
    modoMat: 'total', matTotal: 0,
    materiais: [{ id: uid(), nome: 'Tecido principal', unidade: 'metro', qtd: 0, preco: 0 }],
    perda: p.perda,
    extras: [],
    reservaPct: p.reservaPct,
    imposto: p.imposto, cartao: p.cartao, comissao: p.comissao, margem: p.margem,
    custoFixo: null, // { custoHora, fracaoSalario } quando edita um orçamento antigo
    notas: '',
  };
}

let state = null;
const ouvintes = new Set();

export function carregar() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    state = bruto ? migrar(JSON.parse(bruto)) : estadoInicial();
  } catch {
    state = estadoInicial();
  }
  return state;
}

function migrar(s) {
  const base = estadoInicial();
  return { ...base, ...s, custo: { ...base.custo, ...s.custo }, padroes: { ...base.padroes, ...s.padroes }, metas: { ...base.metas, ...s.metas }, atelie: { ...base.atelie, ...s.atelie } };
}

export const get = () => state;

let timer = null;
export function salvar() {
  clearTimeout(timer);
  timer = setTimeout(gravar, 250);
  ouvintes.forEach((f) => f());
}

export function gravar() {
  clearTimeout(timer);
  try {
    localStorage.setItem(CHAVE, JSON.stringify(state));
  } catch (e) {
    console.error('Não foi possível salvar', e);
  }
}

export const aoMudar = (f) => ouvintes.add(f);

export function pedirArmazenamentoPersistente() {
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

// ---------- Backup ----------

export function exportar() {
  state.ultimoBackup = new Date().toISOString();
  gravar();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const d = new Date(state.ultimoBackup);
  const data = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const nome = `quanto-cobrar-backup-${data}.json`;
  const arquivo = new File([blob], nome, { type: 'application/json' });
  // No celular, abre o "Compartilhar" (salvar em Arquivos, WhatsApp, e-mail...).
  if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
    return navigator.share({ files: [arquivo], title: 'Backup Quanto Cobrar' }).catch(() => baixar(blob, nome));
  }
  baixar(blob, nome);
  return Promise.resolve();
}

function baixar(blob, nome) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export async function importar(arquivo) {
  const dados = JSON.parse(await arquivo.text());
  if (!dados || typeof dados !== 'object' || !dados.custo || !Array.isArray(dados.orcamentos)) {
    throw new Error('Esse arquivo não é um backup do Quanto Cobrar.');
  }
  state = migrar(dados);
  gravar();
  ouvintes.forEach((f) => f());
}

export function apagarTudo() {
  state = estadoInicial();
  gravar();
  ouvintes.forEach((f) => f());
}
