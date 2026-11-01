export type Propulsion = "ICE" | "HEV" | "PHEV" | "BEV" | "GNV";
export type Fuel = "gasolina" | "gasoleo";
export type DataSource = "coc" | "anuncio" | "estimado" | "utilizador";

/** Dados da viatura (campos do COC + anúncio). */
export interface Vehicle {
  tipo: "carro" | "moto";
  marca?: string;
  modelo?: string;
  prop: Propulsion;
  fuel: Fuel;
  /** Cilindrada em cm³ */
  cc: number;
  /** CO₂ combinado em g/km */
  co2: number;
  norma: "WLTP" | "NEDC";
  /** Partículas < 0,001 g/km comprovadas no COC (gasóleo) */
  particulas?: boolean;
  /** Autonomia elétrica em km (HEV/PHEV) */
  autonomia?: number;
  euro6ebis?: boolean;
  /** Data da 1.ª matrícula, YYYY-MM-DD */
  firstReg?: string;
  km?: number;
  /** Preço do anúncio em euros */
  price?: number;
  /** Tem COC ou n.º de homologação */
  coc?: boolean;
  /** Campos técnicos não confirmados (vindos do anúncio ou estimados) */
  estimated?: string[];
}

export interface CostProfile { inspecao: number; registo: number; chapas: number; despachante: number }

export interface Context {
  /** Data de referência (data prevista da DAV), YYYY-MM-DD */
  davDate: string;
  origem: "UE" | "terceiro";
  vendedor: "particular" | "margem" | "geral";
  comprador: "particular" | "empresa";
  /** Transporte até Portugal, em euros */
  transport: number;
  /** Data de chegada a Portugal, YYYY-MM-DD */
  arrival?: string | null;
  custos: CostProfile;
  /** Preço do mesmo modelo em Portugal, em euros */
  ptPrice?: number;
  /** Taxa de IVA do país de origem, em % */
  ivaOrigem?: number;
  /** Origem preferencial fora da UE (0% direitos) */
  dutyZero?: boolean;
}

export interface Line {
  code: string;
  label: string;
  /** cêntimos */
  amount: number;
  explanation: string;
  legal?: string;
  estimated?: boolean;
  editable?: boolean;
}

export interface Alert { code: string; level: "crit" | "warn" | "info"; title: string; text: string }

export interface Result {
  ruleset: string;
  refDate: string;
  price: number;
  transport: number;
  duty: number;
  isv: number;
  isvParts: Line[];
  ivaLine: Line;
  iva: number;
  legal: Line[];
  legalTotal: number;
  total: number;
  alerts: Alert[];
  novoIVA: boolean;
  ageMonths: number;
  iuc: { amount: number | null; note: string } | null;
  diff?: number;
}
