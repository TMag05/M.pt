import { describe, it, expect } from "vitest";
import { calcular, precoMaximo, addBusinessDays, type Vehicle, type Context } from "../src";

const ctx: Context = {
  davDate: "2026-11-20", origem: "UE", vendedor: "margem", comprador: "particular", transport: 900,
  arrival: "2026-11-10", custos: { inspecao: 90, registo: 65, chapas: 30, despachante: 0 }, ptPrice: 26500,
};
const golf: Vehicle = { tipo: "carro", fuel: "gasoleo", prop: "ICE", cc: 1968, co2: 120, norma: "WLTP", particulas: true, firstReg: "2020-06-15", km: 85000, price: 18900, coc: true };
const part = (r: ReturnType<typeof calcular>, code: string) => r.isvParts.find(p => p.code === code)!.amount;

describe("ISV ligeiros (Tabela A + D)", () => {
  it("Golf 2.0 TDI WLTP 120 g/km, 6,4 anos, UE", () => {
    const r = calcular(golf, ctx);
    expect(part(r, "ISV_CIL")).toBe(484560);
    expect(part(r, "ISV_AMB")).toBe(36901);
    expect(part(r, "ISV_IDADE")).toBe(-312877); // 60%
    expect(r.isv).toBe(208584);
    expect(r.iva).toBe(0);
    expect(r.total).toBe(2211584);
  });
  it("gasóleo sem prova de partículas soma 500 €", () => {
    const r = calcular({ ...golf, particulas: false }, ctx);
    expect(r.isv).toBe(Math.round((484560 + 36901 + 50000) * 0.4));
  });
  it("elétrico paga sempre 0 € de ISV", () => {
    for (const firstReg of ["2026-10-01", "2019-01-01"]) expect(calcular({ ...golf, prop: "BEV", firstReg }, ctx).isv).toBe(0);
  });
  it("mais anos de uso nunca aumentam o ISV", () => {
    let prev = Infinity;
    for (let y = 2026; y >= 2012; y--) {
      const isv = calcular({ ...golf, firstReg: `${y}-01-10` }, ctx).isv;
      expect(isv).toBeLessThanOrEqual(prev); prev = isv;
    }
  });
  it("PHEV com autonomia ≥ 50 km e < 50 g/km paga 25%", () => {
    const r = calcular({ ...golf, fuel: "gasolina", prop: "PHEV", cc: 1998, co2: 30, autonomia: 60, firstReg: "2023-03-01" }, ctx);
    expect(r.isvParts.find(p => p.code === "ISV_TINT")!.label).toContain("25%");
  });
  it("PHEV Euro 6e-bis mantém 25% até 80 g/km", () => {
    const base = { ...golf, fuel: "gasolina" as const, prop: "PHEV" as const, cc: 1998, co2: 70, autonomia: 60 };
    expect(calcular(base, ctx).isvParts.find(p => p.code === "ISV_TINT")!.label).toContain("100%");
    expect(calcular({ ...base, euro6ebis: true }, ctx).isvParts.find(p => p.code === "ISV_TINT")!.label).toContain("25%");
  });
  it("imposto mínimo de 100 €", () => {
    const r = calcular({ ...golf, fuel: "gasolina", cc: 999, co2: 100, firstReg: "2010-01-01" }, ctx);
    expect(r.isv).toBe(10000);
  });
});

describe("IVA", () => {
  it("≤ 6 meses ou ≤ 6 000 km conta como novo: 23% sobre preço + transporte + ISV", () => {
    const r = calcular({ ...golf, firstReg: "2026-08-01", km: 3000 }, ctx);
    expect(r.novoIVA).toBe(true);
    expect(r.iva).toBe(Math.round((1890000 + 90000 + r.isv) * 0.23));
  });
  it("usado de particular na UE: sem IVA", () => {
    expect(calcular(golf, { ...ctx, vendedor: "particular" }).iva).toBe(0);
  });
  it("país terceiro: direitos 10%, IVA sobre valor + direitos + ISV, sem Tabela D", () => {
    const r = calcular(golf, { ...ctx, origem: "terceiro" });
    expect(r.duty).toBe(Math.round((1890000 + 90000) * 0.1));
    expect(r.isv).toBe(484560 + 36901);
    expect(r.iva).toBe(Math.round((1980000 + r.duty + r.isv) * 0.23));
  });
});

describe("Motos (Tabela C)", () => {
  it("1254 cm³ usada: 245,14 € com redução por idade", () => {
    const r = calcular({ tipo: "moto", fuel: "gasolina", prop: "ICE", cc: 1254, co2: 0, norma: "WLTP", firstReg: "2022-05-01", km: 20000, price: 15000, coc: true }, ctx);
    expect(r.isvParts[0].amount).toBe(24514);
    expect(r.isv).toBe(24514 - Math.round(24514 * 0.43));
  });
});

describe("Prazos e cálculo inverso", () => {
  it("DAV: 20 dias úteis sem fins de semana nem feriados (1 e 8 de dezembro)", () => {
    expect(addBusinessDays("2026-11-10", 20)).toBe("2026-12-10");
  });
  it("preço máximo devolve um preço cujo total bate com o orçamento", () => {
    const { max } = precoMaximo(golf, ctx, 24000);
    expect(calcular({ ...golf, price: max / 100 }, ctx).total).toBeLessThanOrEqual(2400000);
    expect(calcular({ ...golf, price: max / 100 + 1 }, ctx).total).toBeGreaterThan(2400000);
  });
});
