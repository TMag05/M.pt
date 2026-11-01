"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/index.ts
  var index_exports = {};
  __export(index_exports, {
    RULESET: () => RULESET,
    addBusinessDays: () => addBusinessDays,
    calcIUC: () => calcIUC,
    calcular: () => calcular,
    fmt: () => fmt,
    fmt0: () => fmt0,
    fmtDate: () => fmtDate,
    fmtPlain: () => fmtPlain,
    precoMaximo: () => precoMaximo
  });

  // src/engine.ts
  var RULESET = {
    id: "PT-2026.1",
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    label: "Tabelas ISV/IUC em vigor em 2026 (iguais a 2024\u20132025; OE2026, Lei 73-A/2025, s\xF3 alterou PHEV Euro 6e-bis)",
    isv: {
      cil: [
        // [até cm3, taxa €/cm3, parcela €]
        [1e3, 1.09, 849.03],
        [1250, 1.18, 850.69],
        [Infinity, 5.61, 6194.88]
      ],
      amb: {
        WLTP: {
          gasolina: [[110, 0.44, 43.02], [115, 1.1, 115.8], [120, 1.38, 147.79], [130, 5.27, 619.17], [145, 6.38, 762.73], [175, 41.54, 5819.56], [195, 51.38, 7247.39], [235, 193.01, 34190.52], [Infinity, 233.81, 41910.96]],
          gasoleo: [[110, 1.72, 11.5], [120, 18.96, 1906.19], [140, 65.04, 7360.85], [150, 127.4, 16080.57], [160, 160.81, 21176.06], [170, 221.69, 29227.38], [190, 274.08, 36987.98], [Infinity, 282.35, 38271.32]]
        },
        NEDC: {
          gasolina: [[99, 4.62, 427], [115, 8.09, 750.99], [145, 52.56, 5903.94], [175, 61.24, 7140.17], [195, 155.97, 23627.27], [Infinity, 205.65, 33390.12]],
          gasoleo: [[79, 5.78, 439.04], [95, 23.45, 1848.58], [120, 79.22, 7195.63], [140, 175.73, 18924.92], [160, 195.43, 21720.92], [Infinity, 268.42, 33447.9]]
        }
      },
      agravGasoleo: 500,
      minimo: 100,
      tabelaC: [[119, 0], [250, 73.78], [350, 91.63], [500, 122.57], [750, 184.45], [Infinity, 245.14]],
      tabelaD: [[1, 10], [2, 20], [3, 28], [4, 35], [5, 43], [6, 52], [7, 60], [8, 65], [9, 70], [10, 75], [Infinity, 80]]
    },
    iva: 0.23,
    direitosAduaneiros: { carro: 0.1, moto: 0.06 },
    iuc: {
      cil: [[1250, 31.77], [1750, 63.74], [2500, 127.35], [Infinity, 435.84]],
      co2: { NEDC: [[120, 65.15], [180, 97.63], [250, 212.04], [Infinity, 363.25]], WLTP: [[140, 65.15], [205, 97.63], [260, 212.04], [Infinity, 363.25]] },
      adicCO2: { NEDC: [[180, 0], [250, 31.77], [Infinity, 63.74]], WLTP: [[205, 0], [260, 31.77], [Infinity, 63.74]] },
      coef: [[2007, 1], [2008, 1.05], [2009, 1.1], [Infinity, 1.15]],
      adicGasoleo: [[1250, 5.02], [1750, 10.07], [2500, 20.12], [Infinity, 68.85]]
    }
  };
  var LEX = {
    cil: "CISV, art. 7.\xBA, Tabela A",
    amb: "CISV, art. 7.\xBA, Tabela A (componente ambiental)",
    gas: "CISV, art. 7.\xBA, n.\xBA 3",
    tint: "CISV, art. 8.\xBA",
    idade: "CISV, art. 11.\xBA, Tabela D",
    tabC: "CISV, art. 10.\xBA, Tabela C",
    min: "CISV, art. 7.\xBA e 11.\xBA (imposto m\xEDnimo de 100 \u20AC)",
    ivaNovo: "RITI, art. 6.\xBA, n.\xBA 2 e art. 1.\xBA, al. e); CIVA, art. 16.\xBA",
    ivaMargem: "DL 199/96 (regime especial de bens em segunda m\xE3o), art. 14.\xBA",
    ivaGeral: "RITI, art. 14.\xBA e art. 23.\xBA (autoliquida\xE7\xE3o)",
    importacao: "CIVA, art. 17.\xBA; C\xF3digo Aduaneiro da Uni\xE3o (TARIC 8703 / 8711)",
    imt: "Tabela de taxas do IMT (Modelo 9)",
    dav: "CISV, art. 20.\xBA (DAV em 20 dias \xFAteis)",
    iuc: "CIUC, art. 10.\xBA e Lei 82-B/2014, art. 216.\xBA (adicional gas\xF3leo)"
  };
  var c = (eur) => Math.round(eur * 100);
  var pick = (tbl, v) => tbl.find((r) => v <= r[0]);
  function monthsBetween(d1, d2) {
    const a = new Date(d1), b = new Date(d2);
    let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
    if (b.getDate() < a.getDate()) m -= 1;
    return m;
  }
  function ageYearsExact(d1, d2) {
    return Math.max(0, (new Date(d2).getTime() - new Date(d1).getTime()) / (365.2425 * 864e5));
  }
  function tabelaDRow(firstReg, refDate) {
    const y = ageYearsExact(firstReg, refDate);
    const row = RULESET.isv.tabelaD.find((r) => y <= r[0]);
    return { years: y, pct: row[1], upper: row[0] };
  }
  function calcular(v, ctx) {
    const alerts = [], est = new Set(v.estimated || []);
    const R = RULESET.isv;
    const refDate = ctx.davDate;
    const isEU = ctx.origem === "UE";
    const ageMonths = v.firstReg ? monthsBetween(v.firstReg, refDate) : 0;
    const novoIVA = !v.firstReg || ageMonths <= 6 || (v.km || 0) <= 6e3;
    let isvCents = 0;
    const isvParts = [];
    if (v.tipo === "moto") {
      if (v.prop === "BEV") {
        isvParts.push({ code: "ISV_BEV", label: "Moto el\xE9trica", amount: 0, explanation: "Ve\xEDculos sem motor de combust\xE3o n\xE3o pagam ISV.", legal: "CISV, art. 2.\xBA e 7.\xBA" });
      } else {
        const row = pick(R.tabelaC, v.cc || 0);
        const base = c(row[1]);
        isvParts.push({
          code: "ISV_C",
          label: `Tabela C \xB7 ${v.cc} cm\xB3`,
          amount: base,
          explanation: v.cc < 120 ? "Abaixo de 120 cm\xB3 n\xE3o h\xE1 escal\xE3o na Tabela C." : "Motociclos pagam um valor fixo por escal\xE3o de cilindrada.",
          legal: LEX.tabC,
          estimated: est.has("cc")
        });
        isvCents = base;
        if (isEU && v.firstReg && base > 0) {
          const d = tabelaDRow(v.firstReg, refDate);
          const red = -Math.round(base * d.pct / 100);
          isvParts.push({
            code: "ISV_IDADE",
            label: `Redu\xE7\xE3o por idade \xB7 ${d.pct}%`,
            amount: red,
            explanation: `${d.years.toFixed(1).replace(".", ",")} anos de uso desde a 1.\xAA matr\xEDcula na UE. A aplica\xE7\xE3o da Tabela D a motociclos deve ser confirmada no simulador da AT.`,
            legal: LEX.idade,
            estimated: true
          });
          isvCents += red;
        }
      }
    } else if (v.prop === "BEV") {
      isvParts.push({ code: "ISV_BEV", label: "El\xE9trico (BEV)", amount: 0, explanation: "Autom\xF3veis 100% el\xE9tricos est\xE3o isentos de ISV.", legal: "CISV, art. 2.\xBA, n.\xBA 2" });
    } else {
      const fuel = v.fuel === "gasoleo" ? "gasoleo" : "gasolina";
      const cRow = pick(R.cil, v.cc);
      const cil = Math.max(0, c(v.cc * cRow[1] - cRow[2]));
      isvParts.push({
        code: "ISV_CIL",
        label: `Cilindrada \xB7 ${v.cc} cm\xB3`,
        amount: cil,
        explanation: `${v.cc} cm\xB3 \xD7 ${cRow[1].toFixed(2).replace(".", ",")} \u20AC \u2212 ${fmtPlain(cRow[2])} \u20AC de parcela a abater.`,
        legal: LEX.cil,
        estimated: est.has("cc")
      });
      const norm = v.norma === "NEDC" ? "NEDC" : "WLTP";
      const aRow = pick(R.amb[norm][fuel], v.co2);
      const amb = c(v.co2 * aRow[1] - aRow[2]);
      isvParts.push({
        code: "ISV_AMB",
        label: `Ambiental \xB7 ${v.co2} g/km ${norm}`,
        amount: amb,
        explanation: `${v.co2} g/km \xD7 ${aRow[1].toFixed(2).replace(".", ",")} \u20AC \u2212 ${fmtPlain(aRow[2])} \u20AC, na tabela ${norm} de ${fuel === "gasoleo" ? "gas\xF3leo" : "gasolina"}.${amb < 0 ? " Resultado negativo, abate \xE0 componente cilindrada." : ""}`,
        legal: LEX.amb,
        estimated: est.has("co2") || est.has("norma")
      });
      let sub = Math.max(0, cil + amb);
      if (fuel === "gasoleo") {
        if (v.particulas) {
          isvParts.push({ code: "ISV_GAS", label: "Agravamento gas\xF3leo", amount: 0, explanation: "Part\xEDculas < 0,001 g/km comprovadas no COC: sem agravamento.", legal: LEX.gas });
        } else {
          isvParts.push({ code: "ISV_GAS", label: "Agravamento gas\xF3leo", amount: c(R.agravGasoleo), explanation: "Gas\xF3leo sem prova de part\xEDculas < 0,001 g/km no COC paga mais 500 \u20AC.", legal: LEX.gas, estimated: est.has("particulas") });
          sub += c(R.agravGasoleo);
        }
      }
      let pct = 100, why = "";
      if (v.prop === "PHEV") {
        const lim = v.euro6ebis ? 80 : 50;
        if ((v.autonomia || 0) >= 50 && v.co2 < lim) {
          pct = 25;
          why = `H\xEDbrido plug-in com autonomia \u2265 50 km e < ${lim} g/km${v.euro6ebis ? " (Euro 6e-bis, OE2026)" : ""}.`;
        } else {
          why = `PHEV sem autonomia \u2265 50 km ou com \u2265 ${lim} g/km: paga a taxa normal.`;
          alerts.push(alert("phev", "warn", "PHEV paga 100% do ISV", `Para pagar s\xF3 25% precisa de autonomia el\xE9trica \u2265 50 km e CO\u2082 abaixo de ${lim} g/km, comprovados no COC.`));
        }
      } else if (v.prop === "HEV") {
        if ((v.autonomia || 0) > 50 && v.co2 < 50) {
          pct = 60;
          why = "H\xEDbrido com autonomia el\xE9trica > 50 km e < 50 g/km.";
        } else {
          why = "H\xEDbridos sem autonomia el\xE9trica > 50 km e < 50 g/km pagam a taxa normal (a maioria dos h\xEDbridos convencionais).";
        }
      } else if (v.prop === "GNV") {
        pct = 40;
        why = "Autom\xF3vel exclusivamente a g\xE1s natural.";
      }
      if (v.prop !== "ICE") {
        const after = Math.round(sub * pct / 100);
        isvParts.push({ code: "ISV_TINT", label: `Taxa interm\xE9dia \xB7 paga ${pct}%`, amount: after - sub, explanation: why, legal: LEX.tint, estimated: est.has("autonomia") });
        sub = after;
      }
      if (isEU && v.firstReg && ageMonths > 0) {
        const d = tabelaDRow(v.firstReg, refDate);
        const red = -Math.round(sub * d.pct / 100);
        isvParts.push({
          code: "ISV_IDADE",
          label: `Redu\xE7\xE3o por idade \xB7 ${d.pct}%`,
          amount: red,
          explanation: `${d.years.toFixed(1).replace(".", ",")} anos de uso entre a 1.\xAA matr\xEDcula (UE) e a data da DAV. Desde o OE2025 a Tabela D aplica-se a todo o imposto.`,
          legal: LEX.idade
        });
        sub += red;
        if (d.upper !== Infinity) {
          const next = RULESET.isv.tabelaD.find((r) => r[0] > d.upper);
          const daysToNext = Math.ceil((d.upper - d.years) * 365.2425);
          if (daysToNext <= 45 && next) {
            const saving = Math.round(sub / (1 - d.pct / 100) * (next[1] - d.pct) / 100);
            alerts.push(alert("escalao", "info", "Escal\xE3o de idade \xE0 vista", `Daqui a ${daysToNext} dias a viatura passa para a redu\xE7\xE3o de ${next[1]}%. Fazer a DAV depois disso poupa cerca de ${fmt(saving)}.`));
          }
        }
      } else if (!isEU && v.firstReg) {
        isvParts.push({ code: "ISV_IDADE", label: "Redu\xE7\xE3o por idade \xB7 0%", amount: 0, explanation: "A Tabela D s\xF3 se aplica a usados com matr\xEDcula definitiva noutro Estado-Membro da UE.", legal: LEX.idade });
      }
      if (sub < c(R.minimo)) {
        isvParts.push({ code: "ISV_MIN", label: "Imposto m\xEDnimo", amount: c(R.minimo) - sub, explanation: "O ISV nunca \xE9 inferior a 100 \u20AC.", legal: LEX.min });
        sub = c(R.minimo);
      }
      isvCents = sub;
    }
    const price = c(v.price || 0), transport = c(ctx.transport || 0);
    let priceNet = price;
    const empresa = ctx.comprador === "empresa";
    if (ctx.vendedor === "geral" && isEU) {
      if (empresa) priceNet = Math.round(price / (1 + (ctx.ivaOrigem || 19) / 100));
    }
    let ivaCents = 0, ivaLine, dutyCents = 0;
    if (!isEU) {
      const customsValue = priceNet + transport;
      const rate = ctx.dutyZero ? 0 : RULESET.direitosAduaneiros[v.tipo === "moto" ? "moto" : "carro"];
      dutyCents = Math.round(customsValue * rate);
      ivaCents = Math.round((customsValue + dutyCents + isvCents) * RULESET.iva);
      ivaLine = { code: "IVA", label: "IVA 23% na importa\xE7\xE3o", amount: ivaCents, explanation: "Viatura de pa\xEDs terceiro: IVA sobre valor aduaneiro + direitos + ISV, cobrado pela alf\xE2ndega.", legal: LEX.importacao };
    } else if (novoIVA) {
      ivaCents = Math.round((priceNet + transport + isvCents) * RULESET.iva);
      ivaLine = {
        code: "IVA",
        label: "IVA 23% (meio de transporte novo)",
        amount: ivaCents,
        explanation: `At\xE9 6 meses ou at\xE9 6 000 km conta como "novo" para IVA: paga 23% em Portugal sobre pre\xE7o + transporte + ISV${empresa ? ", em autoliquida\xE7\xE3o e dedut\xEDvel nos termos do CIVA" : ""}.`,
        legal: LEX.ivaNovo
      };
      alerts.push(alert("novo", "warn", 'Conta como "novo" para IVA', "Com \u2264 6 meses ou \u2264 6 000 km paga 23% de IVA em Portugal, mesmo que o vendedor j\xE1 tenha cobrado IVA l\xE1 fora (pede-o de volta no pa\xEDs de origem)."));
    } else if (ctx.vendedor === "particular") {
      ivaLine = { code: "IVA", label: "IVA \xB7 fora do campo", amount: 0, explanation: "Usado comprado a particular noutro pa\xEDs da UE: n\xE3o h\xE1 IVA em Portugal.", legal: "RITI, art. 1.\xBA" };
    } else if (ctx.vendedor === "margem") {
      ivaLine = { code: "IVA", label: "IVA \xB7 regime da margem", amount: 0, explanation: "O IVA da origem j\xE1 est\xE1 inclu\xEDdo no pre\xE7o e n\xE3o \xE9 dedut\xEDvel. Nada a pagar em Portugal.", legal: LEX.ivaMargem };
    } else if (empresa) {
      ivaCents = Math.round(priceNet * RULESET.iva);
      ivaLine = { code: "IVA", label: "IVA 23% \xB7 autoliquida\xE7\xE3o", amount: ivaCents, explanation: "Revendedor em regime geral vende isento a empresa portuguesa; a empresa autoliquida 23% (dedut\xEDvel nos termos do CIVA). Pre\xE7o considerado sem o IVA da origem.", legal: LEX.ivaGeral };
      alerts.push(alert("dedutivel", "info", "Use o pre\xE7o sem IVA", 'Comprador empresa e vendedor profissional em regime geral: o an\xFAncio costuma indicar "MwSt. ausweisbar" / "TVA r\xE9cup\xE9rable". A fatura deve vir sem IVA com o seu NIF intracomunit\xE1rio.'));
    } else {
      ivaLine = { code: "IVA", label: "IVA \xB7 pago na origem", amount: 0, explanation: `Revendedor em regime geral vendendo a particular: paga o IVA do pa\xEDs de origem, j\xE1 inclu\xEDdo no pre\xE7o. Nada a pagar em Portugal.`, legal: "RITI, art. 1.\xBA e 8.\xBA" };
    }
    const k = ctx.custos;
    const legal = [];
    legal.push({ code: "IMT", label: v.coc ? "IMT \xB7 pedido de matr\xEDcula (com COC)" : "IMT \xB7 homologa\xE7\xE3o individual (sem COC)", amount: c(v.coc ? 45 : 165), explanation: v.coc ? "Taxa do Modelo 9 com COC ou n\xFAmero de homologa\xE7\xE3o nacional." : "Sem COC o IMT faz homologa\xE7\xE3o individual: taxa de 165 \u20AC e mais tempo.", legal: LEX.imt });
    legal.push({ code: "INSP", label: "Inspe\xE7\xE3o para matr\xEDcula (Modelo 112)", amount: c(k.inspecao), explanation: "Centro de inspe\xE7\xE3o categoria B. Valor indicativo, edit\xE1vel.", legal: "Portaria das tarifas de inspe\xE7\xE3o", editable: true });
    legal.push({ code: "REG", label: "Registo de propriedade", amount: c(k.registo), explanation: "Conservat\xF3ria / Autom\xF3vel Online. Valor indicativo, edit\xE1vel.", legal: "Regulamento Emolumentar dos Registos e Notariado", editable: true });
    legal.push({ code: "CHAPAS", label: "Chapas de matr\xEDcula", amount: c(k.chapas), explanation: "Valor de mercado indicativo.", editable: true });
    if (k.despachante > 0) legal.push({ code: "DESP", label: "Despachante", amount: c(k.despachante), explanation: "Opcional. Trata da DAV e do IMT por si.", editable: true });
    if (!v.coc) alerts.push(alert("coc", "crit", "Sem COC confirmado", "Pe\xE7a o Certificado de Conformidade ao vendedor ou ao fabricante antes de pagar. Sem ele: homologa\xE7\xE3o individual, taxa de 165 \u20AC e semanas a mais."));
    if (v.tipo !== "moto" && v.prop !== "BEV" && (est.has("co2") || est.has("norma"))) alerts.push(alert("co2", "warn", "CO\u2082 por confirmar", "O valor ou a norma (WLTP/NEDC) v\xEAm do an\xFAncio ou s\xE3o estimados. O ISV pode variar milhares de euros: confirme no COC."));
    if (v.tipo !== "moto" && v.fuel === "gasoleo" && v.prop !== "BEV" && !v.particulas) alerts.push(alert("part", "warn", "Gas\xF3leo sem dado de part\xEDculas", "Conta-se +500 \u20AC at\xE9 haver prova no COC de part\xEDculas < 0,001 g/km (a maioria dos Euro 6 com filtro cumpre)."));
    if (!isEU) alerts.push(alert("terceiro", "crit", "Origem fora da UE", `${ctx.dutyZero ? "Direitos a 0% s\xF3 com prova de origem preferencial (acordos UE\u2013Reino Unido, Su\xED\xE7a, Noruega, Jap\xE3o)" : `Direitos aduaneiros de ${Math.round(RULESET.direitosAduaneiros[v.tipo === "moto" ? "moto" : "carro"] * 100)}% (taxa geral; com prova de origem preferencial pode ser 0%)`}, IVA de 23% e nenhuma redu\xE7\xE3o por idade no ISV. Desalfandegamento obrigat\xF3rio, idealmente com despachante.`));
    if (ctx.arrival) {
      const due = addBusinessDays(ctx.arrival, 20);
      alerts.push(alert("dav", "info", `DAV at\xE9 ${fmtDate(due)}`, `Tem 20 dias \xFAteis desde a chegada (${fmtDate(ctx.arrival)}) para submeter a DAV. Marque a inspe\xE7\xE3o na primeira semana.`));
    }
    const sum = (a) => a.reduce((s, l) => s + l.amount, 0);
    const legalCents = sum(legal);
    const total = priceNet + transport + dutyCents + isvCents + ivaCents + legalCents;
    const out = {
      ruleset: RULESET.id,
      refDate,
      price: priceNet,
      transport,
      duty: dutyCents,
      isv: isvCents,
      isvParts,
      ivaLine,
      iva: ivaCents,
      legal,
      legalTotal: legalCents,
      total,
      alerts,
      novoIVA,
      ageMonths,
      iuc: v.tipo === "moto" ? null : calcIUC(v)
    };
    if (ctx.ptPrice) out.diff = c(ctx.ptPrice) - total;
    return out;
  }
  function calcIUC(v) {
    if (v.prop === "BEV") return { amount: 0, note: "El\xE9tricos est\xE3o isentos de IUC." };
    if (!v.firstReg) return null;
    const fr = new Date(v.firstReg);
    if (fr < /* @__PURE__ */ new Date("2007-07-01")) return { amount: null, note: "1.\xAA matr\xEDcula antes de julho de 2007: categoria A (cilindrada, combust\xEDvel e ano). Use o simulador da AT." };
    const I = RULESET.iuc, norm = v.norma === "NEDC" ? "NEDC" : "WLTP";
    const year = fr.getFullYear();
    let e = pick(I.cil, v.cc)[1] + pick(I.co2[norm], v.co2)[1];
    if (year >= 2017) e += pick(I.adicCO2[norm], v.co2)[1];
    e *= pick(I.coef, year)[1];
    if (v.fuel === "gasoleo") e += pick(I.adicGasoleo, v.cc)[1];
    return { amount: c(e), note: "Categoria B. Conta a data da 1.\xAA matr\xEDcula na UE, n\xE3o a portuguesa." };
  }
  function precoMaximo(v, ctx, budgetEur) {
    const probe = calcular({ ...v, price: 0 }, ctx);
    const fixed = probe.total;
    const budget = c(budgetEur);
    let factor = 1;
    if (ctx.origem !== "UE") factor = (1 + (ctx.dutyZero ? 0 : RULESET.direitosAduaneiros[v.tipo === "moto" ? "moto" : "carro"])) * (1 + RULESET.iva);
    else if (probe.novoIVA) factor = 1 + RULESET.iva;
    else if (ctx.vendedor === "geral" && ctx.comprador === "empresa") factor = 1 + RULESET.iva;
    let p = Math.floor((budget - fixed) / factor);
    if (ctx.vendedor === "geral" && ctx.comprador === "empresa" && ctx.origem === "UE" && !probe.novoIVA) p = Math.floor(p * (1 + (ctx.ivaOrigem || 19) / 100));
    return { max: p, isv: probe.isv };
  }
  function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), cc = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(cc / 4), k = cc % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = (h + l - 7 * m + 114) % 31 + 1;
    return new Date(Date.UTC(y, mo - 1, da));
  }
  function iso(d) {
    return d.toISOString().slice(0, 10);
  }
  function feriados(y) {
    const e = easter(y), add = (n) => iso(new Date(e.getTime() + n * 864e5));
    return /* @__PURE__ */ new Set([`${y}-01-01`, add(-2), add(0), `${y}-04-25`, `${y}-05-01`, add(60), `${y}-06-10`, `${y}-08-15`, `${y}-10-05`, `${y}-11-01`, `${y}-12-01`, `${y}-12-08`, `${y}-12-25`]);
  }
  function addBusinessDays(start, n) {
    let d = /* @__PURE__ */ new Date(start + "T00:00:00Z"), count = 0;
    while (count < n) {
      d = new Date(d.getTime() + 864e5);
      const wd = d.getUTCDay();
      if (wd === 0 || wd === 6) continue;
      if (feriados(d.getUTCFullYear()).has(iso(d))) continue;
      count++;
    }
    return iso(d);
  }
  function fmt(cents) {
    const neg = cents < 0, v = Math.abs(cents) / 100;
    const [i, dd] = v.toFixed(2).split(".");
    return (neg ? "\u2212" : "") + i.replace(/\B(?=(\d{3})+(?!\d))/g, "\u202F") + "," + dd + " \u20AC";
  }
  function fmt0(cents) {
    const neg = cents < 0, v = Math.round(Math.abs(cents) / 100);
    return (neg ? "\u2212" : "") + String(v).replace(/\B(?=(\d{3})+(?!\d))/g, "\u202F") + " \u20AC";
  }
  function fmtPlain(eur) {
    const [i, dd] = eur.toFixed(2).split(".");
    return i.replace(/\B(?=(\d{3})+(?!\d))/g, "\u202F") + "," + dd;
  }
  function fmtDate(isoStr) {
    const [y, m, d] = isoStr.split("-");
    return `${d}/${m}/${y}`;
  }
  function alert(code, level, title, text) {
    return { code, level, title, text };
  }

  // src/browser.ts
  Object.assign(globalThis, index_exports);
})();
