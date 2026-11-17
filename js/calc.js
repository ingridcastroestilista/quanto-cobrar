// Motor de cálculo: funções puras, sem tela e sem armazenamento.
// Valores percentuais são frações (0.2 = 20%). Datas são 'AAAA-MM-DD'.

const soma = (lista, f = (x) => x) => lista.reduce((t, x) => t + (Number(f(x)) || 0), 0);
const n = (v) => Number(v) || 0;

// ---------- Passo 1: custo da hora ----------

export function custoDaHora(cfg) {
  const proLabore = n(cfg.proLabore);
  const provisoes = cfg.provisoes ? proLabore / 12 + proLabore / 36 : 0;
  const salario = proLabore + provisoes; // salário com 13º e 1/3 de férias
  const outras = soma(cfg.despesas, (d) => d.valor);
  const total = salario + outras;
  const horasCheias = soma(cfg.pessoas, (p) => n(p.dias) * n(p.horas));
  const horasProdutivas = horasCheias * n(cfg.produtividade);
  const valor = horasProdutivas > 0 ? total / horasProdutivas : 0;
  return {
    proLabore, provisoes, salario, outras, total,
    horasCheias, horasProdutivas,
    custoHora: valor,
    fracaoSalario: total > 0 ? salario / total : 0,
  };
}

// ---------- Passo 2: preço da peça ----------

export function horasDaPeca(p) {
  if (p.modoHoras === 'etapas') return soma(p.etapas, (e) => n(e.min) * n(e.qtd)) / 60;
  return n(p.horas);
}

export function materiaisSubtotal(p) {
  if (p.modoMat === 'lista') return soma(p.materiais, (m) => n(m.qtd) * n(m.preco));
  return n(p.matTotal);
}

// p: dados da peça; ch: { custoHora, fracaoSalario } usado nesta peça
export function calcPeca(p, ch) {
  const horas = horasDaPeca(p);
  const trabalho = horas * n(ch.custoHora);
  const salario = trabalho * n(ch.fracaoSalario);
  const atelie = trabalho - salario;
  const matSub = materiaisSubtotal(p);
  const materiais = matSub * (1 + n(p.perda));
  const extras = soma(p.extras, (e) => e.valor);
  const reserva = (trabalho + materiais) * n(p.reservaPct);
  const custo = trabalho + materiais + extras + reserva;
  const pctTaxas = n(p.imposto) + n(p.cartao) + n(p.comissao);
  const somaPct = pctTaxas + n(p.margem);
  const valido = somaPct < 0.9;
  const preco = valido ? custo / (1 - somaPct) : 0;
  return {
    horas, trabalho, salario, atelie, matSub, materiais, extras, reserva, custo,
    pctTaxas, somaPct, valido, preco,
  };
}

// Meta de lucro do mês: sai sozinha da meta de faturamento e da margem de lucro que ela usa
// (o preço é calculado para a margem ser essa parte do valor de venda).
export const metaLucro = (s) => n(s.metas?.faturamento) * n(s.padroes?.margem);

// Taxas (imposto + cartão + comissão) de uma venda; o cartão pode ser outro no fechamento.
export function taxaVenda(p, cartaoPct) {
  const cartao = cartaoPct == null ? n(p.cartao) : n(cartaoPct);
  return n(p.imposto) + cartao + n(p.comissao);
}

// Para onde vai um valor de venda. O que sobra (ou falta) depois dos custos é o lucro.
export function composicao(r, valor, taxa) {
  const impostos = valor * taxa;
  const lucro = valor - impostos - r.custo;
  return {
    materiais: r.materiais, extras: r.extras, atelie: r.atelie, salario: r.salario,
    reserva: r.reserva, impostos, lucro,
  };
}

export const PARTES = [
  { k: 'materiais', nome: 'Materiais' },
  { k: 'extras', nome: 'Custos extras' },
  { k: 'atelie', nome: 'Despesas do ateliê' },
  { k: 'salario', nome: 'Seu salário' },
  { k: 'reserva', nome: 'Reserva de refação' },
  { k: 'impostos', nome: 'Impostos, cartão e comissão' },
  { k: 'lucro', nome: 'Lucro' },
];

// Ordem em que cada pagamento preenche as partes: material primeiro.
const ORDEM = ['materiais', 'extras', 'atelie', 'salario', 'reserva', 'lucro'];

export function ordenarParcelas(parcelas) {
  return [...parcelas].sort((a, b) => (a.venc < b.venc ? -1 : a.venc > b.venc ? 1 : 0));
}

// Divide cada parcela nas partes. Impostos saem proporcionalmente de cada pagamento;
// o restante preenche as partes na ORDEM, uma de cada vez.
export function alocarPagamentos(r, valor, taxa, parcelas) {
  const comp = composicao(r, valor, taxa);
  const restante = {
    materiais: comp.materiais, extras: comp.extras, atelie: comp.atelie,
    salario: comp.salario, reserva: comp.reserva, lucro: Math.max(0, comp.lucro),
  };
  return ordenarParcelas(parcelas).map((pc) => {
    const a = { id: pc.id, impostos: n(pc.valor) * taxa };
    let liquido = n(pc.valor) - a.impostos;
    for (const k of ORDEM) {
      const parte = Math.min(Math.max(liquido, 0), restante[k]);
      a[k] = parte;
      restante[k] -= parte;
      liquido -= parte;
    }
    // Pagou mais do que o previsto (arredondamento): vai para o lucro.
    if (liquido > 0.005) a.lucro += liquido;
    return a;
  });
}

// Entrada mínima para o material não sair do caixa dela.
export function entradaMinima(r, taxa) {
  const necessario = r.materiais + r.extras;
  return taxa < 1 ? necessario / (1 - taxa) : necessario;
}

// Quanto do material cada parcela repõe e em quantas parcelas o caixa volta.
export function planoMaterial(r, alocacoes, parcelasOrdenadas) {
  const necessario = r.materiais + r.extras;
  const linhas = alocacoes.map((a, i) => {
    const material = a.materiais + a.extras;
    const total = n(parcelasOrdenadas[i].valor);
    return { ...parcelasOrdenadas[i], material, livre: total - a.impostos - material, impostos: a.impostos };
  });
  const primeira = linhas[0] ? linhas[0].material : 0;
  const doCaixa = Math.max(0, necessario - primeira);
  const repoem = linhas.slice(1).filter((l) => l.material > 0.005);
  return { necessario, primeira, doCaixa, repoem, linhas };
}

// ---------- Datas ----------

export function hojeISO(d = new Date()) {
  const z = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function somaMeses(iso, meses) {
  const [a, m, d] = iso.split('-').map(Number);
  const alvo = new Date(a, m - 1 + meses, 1);
  const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(d, ultimo));
  return hojeISO(alvo);
}

export const mesDe = (iso) => (iso || '').slice(0, 7);

// ---------- Geração das parcelas no fechamento ----------

const centavos = (v) => Math.round(v * 100) / 100;

// f: { forma: 'avista'|'entrada'|'parcelado', data, valor, entrada, dataRestante,
//      nParcelas, primeiraData, antecipa }
export function gerarParcelas(f) {
  const valor = n(f.valor);
  if (f.forma === 'entrada') {
    const entrada = Math.min(n(f.entrada), valor);
    const lista = [{ venc: f.data, valor: centavos(entrada), rotulo: 'Entrada' }];
    if (valor - entrada > 0.005) {
      lista.push({ venc: f.dataRestante || f.data, valor: centavos(valor - entrada), rotulo: 'Restante' });
    }
    return lista;
  }
  if (f.forma === 'parcelado' && !f.antecipa) {
    const qtd = Math.max(1, Math.round(n(f.nParcelas)));
    const base = Math.floor((valor / qtd) * 100) / 100;
    const ajuste = centavos(valor - base * qtd);
    return Array.from({ length: qtd }, (_, i) => ({
      venc: somaMeses(f.primeiraData || f.data, i),
      valor: centavos(base + (i === 0 ? ajuste : 0)),
      rotulo: `Parcela ${i + 1} de ${qtd}`,
    }));
  }
  return [{ venc: f.data, valor: centavos(valor), rotulo: f.forma === 'parcelado' ? 'Cartão antecipado' : 'À vista' }];
}

// ---------- Mês: vendido × recebido ----------

const zeraPartes = () => Object.fromEntries(PARTES.map((p) => [p.k, 0]));
const somaPartes = (alvo, x) => { for (const p of PARTES) alvo[p.k] += x[p.k] || 0; };

// Dados calculados de um orçamento fechado. calcular(o) devolve calcPeca do snapshot.
export function dadosVenda(o, calcular) {
  const r = calcular(o);
  const f = o.fechamento;
  const taxa = taxaVenda(o.snap, f.cartaoPct);
  const ordenadas = ordenarParcelas(f.parcelas);
  const aloc = alocarPagamentos(r, n(f.valor), taxa, ordenadas);
  const porId = Object.fromEntries(aloc.map((a) => [a.id, a]));
  return { r, f, taxa, ordenadas, aloc, porId, comp: composicao(r, n(f.valor), taxa) };
}

export function resumoMes(orcs, mes, hoje, calcular) {
  const vendas = orcs.filter((o) => o.status === 'fechado' && o.fechamento).map((o) => ({ o, ...dadosVenda(o, calcular) }));
  const doMes = vendas.filter((v) => mesDe(v.f.data) === mes);

  const vendido = soma(doMes, (v) => v.f.valor);
  const compVendido = zeraPartes();
  doMes.forEach((v) => somaPartes(compVendido, v.comp));

  // Descontos: fechou abaixo do preço sugerido.
  let descontos = 0;
  const comDesconto = [];
  for (const v of doMes) {
    const d = v.r.preco - n(v.f.valor);
    if (d > 0.5) { descontos += d; comDesconto.push({ o: v.o, sugerido: v.r.preco, fechado: n(v.f.valor), desconto: d }); }
  }
  const lucroSugerido = soma(doMes, (v) => composicao(v.r, v.r.preco, v.taxa).lucro);

  const recebidas = [];
  const compRecebido = zeraPartes();
  let previsto = 0;
  const explica = { doMesRecebido: 0, doMesFuturo: 0, doMesAtrasado: 0, doMesOutroMes: 0, antigasRecebidas: 0 };
  const atrasadas = [];
  const proximos = {};
  let emprestado = 0;
  const emprestimos = [];

  for (const v of vendas) {
    const daVendaDoMes = mesDe(v.f.data) === mes;
    let materialRecebido = 0;
    for (const pc of v.ordenadas) {
      const a = v.porId[pc.id];
      if (mesDe(pc.venc) === mes) previsto += n(pc.valor);
      if (pc.recebidoEm) materialRecebido += a.materiais + a.extras;
      if (pc.recebidoEm && mesDe(pc.recebidoEm) === mes) {
        recebidas.push({ o: v.o, pc, a });
        somaPartes(compRecebido, a);
        if (daVendaDoMes) explica.doMesRecebido += n(pc.valor);
        else explica.antigasRecebidas += n(pc.valor);
      } else if (daVendaDoMes) {
        if (pc.recebidoEm) explica.doMesOutroMes += n(pc.valor);
        else if (pc.venc < hoje) explica.doMesAtrasado += n(pc.valor);
        else explica.doMesFuturo += n(pc.valor);
      }
      if (!pc.recebidoEm && pc.venc < hoje) atrasadas.push({ o: v.o, pc });
      if (!pc.recebidoEm && mesDe(pc.venc) > mes) {
        const m = mesDe(pc.venc);
        proximos[m] = (proximos[m] || 0) + n(pc.valor);
      }
    }
    const falta = v.r.materiais + v.r.extras - materialRecebido;
    if (falta > 0.5) { emprestado += falta; emprestimos.push({ o: v.o, falta }); }
  }

  return {
    vendido, compVendido, qtdVendas: doMes.length,
    descontos, comDesconto, lucroSugerido, lucroVendido: compVendido.lucro,
    previsto, recebido: soma(recebidas, (x) => x.pc.valor), recebidas, compRecebido,
    explica, atrasadas, proximos, emprestado, emprestimos,
  };
}
