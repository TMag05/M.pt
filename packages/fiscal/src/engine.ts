// Motor fiscal (puro, sem I/O). Valores em cêntimos inteiros.
// Nenhuma taxa, escalão ou prazo vive fora do RULESET. Ver CLAUDE.md.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Vehicle, Context, Result, Line, Alert } from "./types";
export const RULESET = {
  id: "PT-2026.1",
  validFrom: "2026-01-01",
  validTo: "2026-12-31",
  label: "Tabelas ISV/IUC em vigor em 2026 (iguais a 2024–2025; OE2026, Lei 73-A/2025, só alterou PHEV Euro 6e-bis)",
  isv: {
    cil: [ // [até cm3, taxa €/cm3, parcela €]
      [1000, 1.09, 849.03], [1250, 1.18, 850.69], [Infinity, 5.61, 6194.88]
    ],
    amb: {
      WLTP: {
        gasolina: [[110,0.44,43.02],[115,1.10,115.80],[120,1.38,147.79],[130,5.27,619.17],[145,6.38,762.73],[175,41.54,5819.56],[195,51.38,7247.39],[235,193.01,34190.52],[Infinity,233.81,41910.96]],
        gasoleo:  [[110,1.72,11.50],[120,18.96,1906.19],[140,65.04,7360.85],[150,127.40,16080.57],[160,160.81,21176.06],[170,221.69,29227.38],[190,274.08,36987.98],[Infinity,282.35,38271.32]]
      },
      NEDC: {
        gasolina: [[99,4.62,427.00],[115,8.09,750.99],[145,52.56,5903.94],[175,61.24,7140.17],[195,155.97,23627.27],[Infinity,205.65,33390.12]],
        gasoleo:  [[79,5.78,439.04],[95,23.45,1848.58],[120,79.22,7195.63],[140,175.73,18924.92],[160,195.43,21720.92],[Infinity,268.42,33447.90]]
      }
    },
    agravGasoleo: 500,
    minimo: 100,
    tabelaC: [[119,0],[250,73.78],[350,91.63],[500,122.57],[750,184.45],[Infinity,245.14]],
    tabelaD: [[1,10],[2,20],[3,28],[4,35],[5,43],[6,52],[7,60],[8,65],[9,70],[10,75],[Infinity,80]]
  },
  iva: 0.23,
  direitosAduaneiros: { carro: 0.10, moto: 0.06 },
  iuc: {
    cil: [[1250,31.77],[1750,63.74],[2500,127.35],[Infinity,435.84]],
    co2: { NEDC: [[120,65.15],[180,97.63],[250,212.04],[Infinity,363.25]], WLTP: [[140,65.15],[205,97.63],[260,212.04],[Infinity,363.25]] },
    adicCO2: { NEDC: [[180,0],[250,31.77],[Infinity,63.74]], WLTP: [[205,0],[260,31.77],[Infinity,63.74]] },
    coef: [[2007,1.00],[2008,1.05],[2009,1.10],[Infinity,1.15]],
    adicGasoleo: [[1250,5.02],[1750,10.07],[2500,20.12],[Infinity,68.85]]
  }
};

const LEX = {
  cil: "CISV, art. 7.º, Tabela A",
  amb: "CISV, art. 7.º, Tabela A (componente ambiental)",
  gas: "CISV, art. 7.º, n.º 3",
  tint: "CISV, art. 8.º",
  idade: "CISV, art. 11.º, Tabela D",
  tabC: "CISV, art. 10.º, Tabela C",
  min: "CISV, art. 7.º e 11.º (imposto mínimo de 100 €)",
  ivaNovo: "RITI, art. 6.º, n.º 2 e art. 1.º, al. e); CIVA, art. 16.º",
  ivaMargem: "DL 199/96 (regime especial de bens em segunda mão), art. 14.º",
  ivaGeral: "RITI, art. 14.º e art. 23.º (autoliquidação)",
  importacao: "CIVA, art. 17.º; Código Aduaneiro da União (TARIC 8703 / 8711)",
  imt: "Tabela de taxas do IMT (Modelo 9)",
  dav: "CISV, art. 20.º (DAV em 20 dias úteis)",
  iuc: "CIUC, art. 10.º e Lei 82-B/2014, art. 216.º (adicional gasóleo)"
};

const c = (eur: number): number => Math.round(eur * 100);
const pick = (tbl: number[][], v: number): number[] => tbl.find(r => v <= r[0])!;

function monthsBetween(d1: string, d2: string): number {
  const a = new Date(d1), b = new Date(d2);
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) m -= 1;
  return m;
}
function ageYearsExact(d1: string, d2: string): number { return Math.max(0, (new Date(d2).getTime() - new Date(d1).getTime()) / (365.2425 * 864e5)); }

function tabelaDRow(firstReg: string, refDate: string) {
  const y = ageYearsExact(firstReg, refDate);
  const row = RULESET.isv.tabelaD.find(r => y <= r[0])!;
  return { years: y, pct: row[1], upper: row[0] };
}

// v: viatura, ctx: contexto
export function calcular(v: Vehicle, ctx: Context): Result {
  const alerts: Alert[] = [], est = new Set(v.estimated || []);
  const R = RULESET.isv;
  const refDate = ctx.davDate;
  const isEU = ctx.origem === "UE";
  const ageMonths = v.firstReg ? monthsBetween(v.firstReg, refDate) : 0;
  const novoIVA = !v.firstReg || ageMonths <= 6 || (v.km || 0) <= 6000;

  // ---------- ISV ----------
  let isvCents = 0;
  const isvParts: Line[] = [];
  if (v.tipo === "moto") {
    if (v.prop === "BEV") {
      isvParts.push({ code: "ISV_BEV", label: "Moto elétrica", amount: 0, explanation: "Veículos sem motor de combustão não pagam ISV.", legal: "CISV, art. 2.º e 7.º" });
    } else {
      const row = pick(R.tabelaC, v.cc || 0);
      const base = c(row[1]);
      isvParts.push({ code: "ISV_C", label: `Tabela C · ${v.cc} cm³`, amount: base,
        explanation: v.cc < 120 ? "Abaixo de 120 cm³ não há escalão na Tabela C." : "Motociclos pagam um valor fixo por escalão de cilindrada.", legal: LEX.tabC, estimated: est.has("cc") });
      isvCents = base;
      if (isEU && v.firstReg && base > 0) {
        const d = tabelaDRow(v.firstReg, refDate);
        const red = -Math.round(base * d.pct / 100);
        isvParts.push({ code: "ISV_IDADE", label: `Redução por idade · ${d.pct}%`, amount: red,
          explanation: `${d.years.toFixed(1).replace(".", ",")} anos de uso desde a 1.ª matrícula na UE. A aplicação da Tabela D a motociclos deve ser confirmada no simulador da AT.`, legal: LEX.idade, estimated: true });
        isvCents += red;
      }
    }
  } else if (v.prop === "BEV") {
    isvParts.push({ code: "ISV_BEV", label: "Elétrico (BEV)", amount: 0, explanation: "Automóveis 100% elétricos estão isentos de ISV.", legal: "CISV, art. 2.º, n.º 2" });
  } else {
    const fuel = v.fuel === "gasoleo" ? "gasoleo" : "gasolina";
    const cRow = pick(R.cil, v.cc);
    const cil = Math.max(0, c(v.cc * cRow[1] - cRow[2]));
    isvParts.push({ code: "ISV_CIL", label: `Cilindrada · ${v.cc} cm³`, amount: cil,
      explanation: `${v.cc} cm³ × ${cRow[1].toFixed(2).replace(".", ",")} € − ${fmtPlain(cRow[2])} € de parcela a abater.`, legal: LEX.cil, estimated: est.has("cc") });
    const norm = v.norma === "NEDC" ? "NEDC" : "WLTP";
    const aRow = pick(R.amb[norm][fuel], v.co2);
    const amb = c(v.co2 * aRow[1] - aRow[2]);
    isvParts.push({ code: "ISV_AMB", label: `Ambiental · ${v.co2} g/km ${norm}`, amount: amb,
      explanation: `${v.co2} g/km × ${aRow[1].toFixed(2).replace(".", ",")} € − ${fmtPlain(aRow[2])} €, na tabela ${norm} de ${fuel === "gasoleo" ? "gasóleo" : "gasolina"}.${amb < 0 ? " Resultado negativo, abate à componente cilindrada." : ""}`,
      legal: LEX.amb, estimated: est.has("co2") || est.has("norma") });
    let sub = Math.max(0, cil + amb);
    if (fuel === "gasoleo") {
      if (v.particulas) {
        isvParts.push({ code: "ISV_GAS", label: "Agravamento gasóleo", amount: 0, explanation: "Partículas < 0,001 g/km comprovadas no COC: sem agravamento.", legal: LEX.gas });
      } else {
        isvParts.push({ code: "ISV_GAS", label: "Agravamento gasóleo", amount: c(R.agravGasoleo), explanation: "Gasóleo sem prova de partículas < 0,001 g/km no COC paga mais 500 €.", legal: LEX.gas, estimated: est.has("particulas") });
        sub += c(R.agravGasoleo);
      }
    }
    // taxa intermédia
    let pct = 100, why = "";
    if (v.prop === "PHEV") {
      const lim = v.euro6ebis ? 80 : 50;
      if ((v.autonomia || 0) >= 50 && v.co2 < lim) { pct = 25; why = `Híbrido plug-in com autonomia ≥ 50 km e < ${lim} g/km${v.euro6ebis ? " (Euro 6e-bis, OE2026)" : ""}.`; }
      else { why = `PHEV sem autonomia ≥ 50 km ou com ≥ ${lim} g/km: paga a taxa normal.`; alerts.push(alert("phev", "warn", "PHEV paga 100% do ISV", `Para pagar só 25% precisa de autonomia elétrica ≥ 50 km e CO₂ abaixo de ${lim} g/km, comprovados no COC.`)); }
    } else if (v.prop === "HEV") {
      if ((v.autonomia || 0) > 50 && v.co2 < 50) { pct = 60; why = "Híbrido com autonomia elétrica > 50 km e < 50 g/km."; }
      else { why = "Híbridos sem autonomia elétrica > 50 km e < 50 g/km pagam a taxa normal (a maioria dos híbridos convencionais)."; }
    } else if (v.prop === "GNV") { pct = 40; why = "Automóvel exclusivamente a gás natural."; }
    if (v.prop !== "ICE") {
      const after = Math.round(sub * pct / 100);
      isvParts.push({ code: "ISV_TINT", label: `Taxa intermédia · paga ${pct}%`, amount: after - sub, explanation: why, legal: LEX.tint, estimated: est.has("autonomia") });
      sub = after;
    }
    if (isEU && v.firstReg && ageMonths > 0) {
      const d = tabelaDRow(v.firstReg, refDate);
      const red = -Math.round(sub * d.pct / 100);
      isvParts.push({ code: "ISV_IDADE", label: `Redução por idade · ${d.pct}%`, amount: red,
        explanation: `${d.years.toFixed(1).replace(".", ",")} anos de uso entre a 1.ª matrícula (UE) e a data da DAV. Desde o OE2025 a Tabela D aplica-se a todo o imposto.`, legal: LEX.idade });
      sub += red;
      // proximidade de escalão
      if (d.upper !== Infinity) {
        const next = RULESET.isv.tabelaD.find(r => r[0] > d.upper);
        const daysToNext = Math.ceil((d.upper - d.years) * 365.2425);
        if (daysToNext <= 45 && next) {
          const saving = Math.round(sub / (1 - d.pct / 100) * (next[1] - d.pct) / 100);
          alerts.push(alert("escalao", "info", "Escalão de idade à vista", `Daqui a ${daysToNext} dias a viatura passa para a redução de ${next[1]}%. Fazer a DAV depois disso poupa cerca de ${fmt(saving)}.`));
        }
      }
    } else if (!isEU && v.firstReg) {
      isvParts.push({ code: "ISV_IDADE", label: "Redução por idade · 0%", amount: 0, explanation: "A Tabela D só se aplica a usados com matrícula definitiva noutro Estado-Membro da UE.", legal: LEX.idade });
    }
    if (sub < c(R.minimo)) {
      isvParts.push({ code: "ISV_MIN", label: "Imposto mínimo", amount: c(R.minimo) - sub, explanation: "O ISV nunca é inferior a 100 €.", legal: LEX.min });
      sub = c(R.minimo);
    }
    isvCents = sub;
  }

  // ---------- Preço, transporte, IVA, direitos ----------
  const price = c(v.price || 0), transport = c(ctx.transport || 0);
  let priceNet = price;
  const empresa = ctx.comprador === "empresa";
  if (ctx.vendedor === "geral" && isEU) {
    // revendedor regime geral: vende sem IVA a empresas (autoliquida em PT); a particulares cobra IVA da origem incluído
    if (empresa) priceNet = Math.round(price / (1 + (ctx.ivaOrigem || 19) / 100));
  }
  let ivaCents = 0, ivaLine!: Line, dutyCents = 0;
  if (!isEU) {
    const customsValue = priceNet + transport;
    const rate = ctx.dutyZero ? 0 : RULESET.direitosAduaneiros[v.tipo === "moto" ? "moto" : "carro"];
    dutyCents = Math.round(customsValue * rate);
    ivaCents = Math.round((customsValue + dutyCents + isvCents) * RULESET.iva);
    ivaLine = { code: "IVA", label: "IVA 23% na importação", amount: ivaCents, explanation: "Viatura de país terceiro: IVA sobre valor aduaneiro + direitos + ISV, cobrado pela alfândega.", legal: LEX.importacao };
  } else if (novoIVA) {
    ivaCents = Math.round((priceNet + transport + isvCents) * RULESET.iva);
    ivaLine = { code: "IVA", label: "IVA 23% (meio de transporte novo)", amount: ivaCents,
      explanation: `Até 6 meses ou até 6 000 km conta como "novo" para IVA: paga 23% em Portugal sobre preço + transporte + ISV${empresa ? ", em autoliquidação e dedutível nos termos do CIVA" : ""}.`, legal: LEX.ivaNovo };
    alerts.push(alert("novo", "warn", "Conta como \"novo\" para IVA", "Com ≤ 6 meses ou ≤ 6 000 km paga 23% de IVA em Portugal, mesmo que o vendedor já tenha cobrado IVA lá fora (pede-o de volta no país de origem)."));
  } else if (ctx.vendedor === "particular") {
    ivaLine = { code: "IVA", label: "IVA · fora do campo", amount: 0, explanation: "Usado comprado a particular noutro país da UE: não há IVA em Portugal.", legal: "RITI, art. 1.º" };
  } else if (ctx.vendedor === "margem") {
    ivaLine = { code: "IVA", label: "IVA · regime da margem", amount: 0, explanation: "O IVA da origem já está incluído no preço e não é dedutível. Nada a pagar em Portugal.", legal: LEX.ivaMargem };
  } else if (empresa) {
    ivaCents = Math.round(priceNet * RULESET.iva);
    ivaLine = { code: "IVA", label: "IVA 23% · autoliquidação", amount: ivaCents, explanation: "Revendedor em regime geral vende isento a empresa portuguesa; a empresa autoliquida 23% (dedutível nos termos do CIVA). Preço considerado sem o IVA da origem.", legal: LEX.ivaGeral };
    alerts.push(alert("dedutivel", "info", "Use o preço sem IVA", "Comprador empresa e vendedor profissional em regime geral: o anúncio costuma indicar \"MwSt. ausweisbar\" / \"TVA récupérable\". A fatura deve vir sem IVA com o seu NIF intracomunitário."));
  } else {
    ivaLine = { code: "IVA", label: "IVA · pago na origem", amount: 0, explanation: `Revendedor em regime geral vendendo a particular: paga o IVA do país de origem, já incluído no preço. Nada a pagar em Portugal.`, legal: "RITI, art. 1.º e 8.º" };
  }

  // ---------- Legalização ----------
  const k = ctx.custos;
  const legal: Line[] = [];
  legal.push({ code: "IMT", label: v.coc ? "IMT · pedido de matrícula (com COC)" : "IMT · homologação individual (sem COC)", amount: c(v.coc ? 45 : 165), explanation: v.coc ? "Taxa do Modelo 9 com COC ou número de homologação nacional." : "Sem COC o IMT faz homologação individual: taxa de 165 € e mais tempo.", legal: LEX.imt });
  legal.push({ code: "INSP", label: "Inspeção para matrícula (Modelo 112)", amount: c(k.inspecao), explanation: "Centro de inspeção categoria B. Valor indicativo, editável.", legal: "Portaria das tarifas de inspeção", editable: true });
  legal.push({ code: "REG", label: "Registo de propriedade", amount: c(k.registo), explanation: "Conservatória / Automóvel Online. Valor indicativo, editável.", legal: "Regulamento Emolumentar dos Registos e Notariado", editable: true });
  legal.push({ code: "CHAPAS", label: "Chapas de matrícula", amount: c(k.chapas), explanation: "Valor de mercado indicativo.", editable: true });
  if (k.despachante > 0) legal.push({ code: "DESP", label: "Despachante", amount: c(k.despachante), explanation: "Opcional. Trata da DAV e do IMT por si.", editable: true });

  // ---------- Alertas determinísticos ----------
  if (!v.coc) alerts.push(alert("coc", "crit", "Sem COC confirmado", "Peça o Certificado de Conformidade ao vendedor ou ao fabricante antes de pagar. Sem ele: homologação individual, taxa de 165 € e semanas a mais."));
  if (v.tipo !== "moto" && v.prop !== "BEV" && (est.has("co2") || est.has("norma"))) alerts.push(alert("co2", "warn", "CO₂ por confirmar", "O valor ou a norma (WLTP/NEDC) vêm do anúncio ou são estimados. O ISV pode variar milhares de euros: confirme no COC."));
  if (v.tipo !== "moto" && v.fuel === "gasoleo" && v.prop !== "BEV" && !v.particulas) alerts.push(alert("part", "warn", "Gasóleo sem dado de partículas", "Conta-se +500 € até haver prova no COC de partículas < 0,001 g/km (a maioria dos Euro 6 com filtro cumpre)."));
  if (!isEU) alerts.push(alert("terceiro", "crit", "Origem fora da UE", `${ctx.dutyZero ? "Direitos a 0% só com prova de origem preferencial (acordos UE–Reino Unido, Suíça, Noruega, Japão)" : `Direitos aduaneiros de ${Math.round(RULESET.direitosAduaneiros[v.tipo === "moto" ? "moto" : "carro"] * 100)}% (taxa geral; com prova de origem preferencial pode ser 0%)`}, IVA de 23% e nenhuma redução por idade no ISV. Desalfandegamento obrigatório, idealmente com despachante.`));
  if (ctx.arrival) {
    const due = addBusinessDays(ctx.arrival, 20);
    alerts.push(alert("dav", "info", `DAV até ${fmtDate(due)}`, `Tem 20 dias úteis desde a chegada (${fmtDate(ctx.arrival)}) para submeter a DAV. Marque a inspeção na primeira semana.`));
  }

  // ---------- Totais ----------
  const sum = (a: Line[]) => a.reduce((s, l) => s + l.amount, 0);
  const legalCents = sum(legal);
  const total = priceNet + transport + dutyCents + isvCents + ivaCents + legalCents;
  const out: Result = {
    ruleset: RULESET.id, refDate,
    price: priceNet, transport, duty: dutyCents, isv: isvCents, isvParts, ivaLine, iva: ivaCents, legal, legalTotal: legalCents,
    total, alerts, novoIVA, ageMonths,
    iuc: v.tipo === "moto" ? null : calcIUC(v),
  };
  if (ctx.ptPrice) out.diff = c(ctx.ptPrice) - total;
  return out;
}

export function calcIUC(v: Vehicle): { amount: number | null; note: string } | null {
  if (v.prop === "BEV") return { amount: 0, note: "Elétricos estão isentos de IUC." };
  if (!v.firstReg) return null;
  const fr = new Date(v.firstReg);
  if (fr < new Date("2007-07-01")) return { amount: null, note: "1.ª matrícula antes de julho de 2007: categoria A (cilindrada, combustível e ano). Use o simulador da AT." };
  const I = RULESET.iuc, norm = v.norma === "NEDC" ? "NEDC" : "WLTP";
  const year = fr.getFullYear();
  let e = pick(I.cil, v.cc)[1] + pick(I.co2[norm], v.co2)[1];
  if (year >= 2017) e += pick(I.adicCO2[norm], v.co2)[1];
  e *= pick(I.coef, year)[1];
  if (v.fuel === "gasoleo") e += pick(I.adicGasoleo, v.cc)[1];
  return { amount: c(e), note: "Categoria B. Conta a data da 1.ª matrícula na UE, não a portuguesa." };
}

// Preço máximo de compra para um custo final alvo (cálculo inverso)
export function precoMaximo(v: Vehicle, ctx: Context, budgetEur: number): { max: number; isv: number } {
  const probe = calcular({ ...v, price: 0 }, ctx);
  const fixed = probe.total; // tudo exceto o preço (com IVA sobre transporte/ISV se aplicável)
  const budget = c(budgetEur);
  let factor = 1;
  if (ctx.origem !== "UE") factor = (1 + (ctx.dutyZero ? 0 : RULESET.direitosAduaneiros[v.tipo === "moto" ? "moto" : "carro"])) * (1 + RULESET.iva);
  else if (probe.novoIVA) factor = 1 + RULESET.iva;
  else if (ctx.vendedor === "geral" && ctx.comprador === "empresa") factor = 1 + RULESET.iva; // sobre o preço líquido
  let p = Math.floor((budget - fixed) / factor);
  if (ctx.vendedor === "geral" && ctx.comprador === "empresa" && ctx.origem === "UE" && !probe.novoIVA) p = Math.floor(p * (1 + (ctx.ivaOrigem || 19) / 100));
  return { max: p, isv: probe.isv };
}

// ---------- Datas ----------
function easter(y: number): Date { const a=y%19,b=Math.floor(y/100),cc=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(cc/4),k=cc%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1; return new Date(Date.UTC(y,mo-1,da)); }
function iso(d: Date): string { return d.toISOString().slice(0, 10); }
function feriados(y: number): Set<string> {
  const e = easter(y), add = (n) => iso(new Date(e.getTime() + n * 864e5));
  return new Set([`${y}-01-01`, add(-2), add(0), `${y}-04-25`, `${y}-05-01`, add(60), `${y}-06-10`, `${y}-08-15`, `${y}-10-05`, `${y}-11-01`, `${y}-12-01`, `${y}-12-08`, `${y}-12-25`]);
}
export function addBusinessDays(start: string, n: number): string {
  let d = new Date(start + "T00:00:00Z"), count = 0;
  while (count < n) {
    d = new Date(d.getTime() + 864e5);
    const wd = d.getUTCDay();
    if (wd === 0 || wd === 6) continue;
    if (feriados(d.getUTCFullYear()).has(iso(d))) continue;
    count++;
  }
  return iso(d);
}

// ---------- Formatação ----------
export function fmt(cents: number): string {
  const neg = cents < 0, v = Math.abs(cents) / 100;
  const [i, dd] = v.toFixed(2).split(".");
  return (neg ? "−" : "") + i.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + "," + dd + " €";
}
export function fmt0(cents: number): string { const neg = cents < 0, v = Math.round(Math.abs(cents) / 100); return (neg ? "−" : "") + String(v).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " €"; }
export function fmtPlain(eur: number): string { const [i, dd] = eur.toFixed(2).split("."); return i.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + "," + dd; }
export function fmtDate(isoStr: string): string { const [y, m, d] = isoStr.split("-"); return `${d}/${m}/${y}`; }
function alert(code: string, level: Alert["level"], title: string, text: string): Alert { return { code, level, title, text }; }


