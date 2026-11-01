// Lógica pura do servidor (sem Firebase), testável sem rede.
import type Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
export const MAX_TEXT = 100_000;

/** Campos que a app precisa de um anúncio. */
export const AD_SCHEMA = `{
  "marca": string|null, "modelo": string|null, "versao": string|null, "tipo": "carro"|"moto"|null,
  "preco": number|null, "moeda": "EUR"|"GBP"|"CHF"|"PLN"|"DKK"|"SEK"|"NOK"|"CZK"|"USD"|null,
  "km": number|null, "primeira_matricula": "YYYY-MM"|null,
  "combustivel": "gasolina"|"gasoleo"|null, "motorizacao": "ICE"|"HEV"|"PHEV"|"BEV"|"GNV"|null,
  "cilindrada_cm3": number|null, "co2_g_km": number|null, "norma_co2": "WLTP"|"NEDC"|null,
  "euro": string|null, "autonomia_eletrica_km": number|null, "particulas_menor_0001": boolean|null,
  "pais": string|null, "vendedor": "particular"|"margem"|"geral"|null, "cor": string|null, "potencia_kw": number|null
}`;

export class InputError extends Error {}

export function validateUrl(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string" || raw.length > 2048) throw new InputError("Link inválido.");
  let u: URL;
  try { u = new URL(raw); } catch { throw new InputError("Link inválido."); }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new InputError("Só são aceites links http(s).");
  return u.toString();
}

export function validateText(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") throw new InputError("Texto inválido.");
  if (raw.length > MAX_TEXT) throw new InputError("O texto colado é demasiado longo (máx. 100 000 caracteres).");
  return raw;
}

export function importPrompt(url: string | null, text: string | null): string {
  const source = url
    ? `O anúncio está neste link (abre-o com a ferramenta web_fetch): ${url}${text ? "\nO utilizador também colou este texto da página:\n<texto>\n" + text + "\n</texto>" : ""}`
    : `Texto do anúncio colado pelo utilizador:\n<texto>\n${text}\n</texto>`;
  return `És o assistente de importação de viaturas da app Matrícula PT. Extrai os dados deste anúncio de viatura usada para calcular o ISV e o IVA em Portugal.

${source}

1. Extrai os campos do anúncio. Usa null quando o dado não está no anúncio; não inventes nesta fase.
   - "vendedor": "margem" se indicar regime da margem (Differenzbesteuert, §25a, TVA non récupérable, margeregeling); "geral" se o IVA for dedutível (MwSt. ausweisbar, TVA récupérable, BTW verrekenbaar); "particular" se for vendedor privado.
   - "motorizacao": HEV híbrido normal, PHEV plug-in, BEV elétrico, ICE combustão.
   - "preco": preço pedido, na moeda do anúncio.
2. Para os campos técnicos que ficaram a null (cilindrada_cm3, co2_g_km, norma_co2, combustivel, motorizacao, particulas_menor_0001, autonomia_eletrica_km), procura a versão exata na web (web_search, fichas técnicas do fabricante ou sites de especificações) e indica o valor que constaria do COC. A norma é WLTP para 1.ª matrícula desde 09/2018. Se não encontrares com razoável certeza, deixa null.

Responde no fim só com um objeto JSON, sem texto à volta:
{"dados": ${AD_SCHEMA},
 "completados": {"<campo>": {"valor": ..., "fonte": "<url ou 'conhecimento'>", "confianca": "alta"|"media"|"baixa"}},
 "avisos": [string em português de Portugal]}
Em "dados" põe só o que vem do anúncio; o que encontrares na pesquisa vai apenas em "completados".`;
}

export function ptPricesPrompt(vehicle: unknown, text: string | null, url: string | null): string {
  const source = text ? `<pagina>\n${text}\n</pagina>` : `Abre esta página de resultados com web_fetch: ${url}`;
  return `Desta página de resultados de anúncios de viaturas à venda em Portugal, lista os anúncios comparáveis com esta viatura: ${JSON.stringify(vehicle)} (mesma marca e modelo, motorização equivalente, ano ±1, km até cerca de +30%). Ignora anúncios patrocinados de outros modelos e valores de prestação mensal.

${source}

Responde só com JSON: {"anuncios":[{"titulo":string,"preco_eur":number,"ano":number|null,"km":number|null}]}. Lista vazia se não houver.`;
}

/** Tira o último objeto JSON do texto final do modelo. */
export function parseJsonAnswer(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/g);
  const candidate = fenced ? fenced[fenced.length - 1].replace(/```(?:json)?/g, "") : text;
  const start = candidate.indexOf("{"), end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Resposta sem JSON");
  return JSON.parse(candidate.slice(start, end + 1));
}

type Client = Pick<Anthropic, "beta">;

/** Uma pergunta ao Claude com web_fetch/web_search no servidor da Anthropic; trata pause_turn e recusas. */
export async function askWithWeb(client: Client, prompt: string, opts: { fetch: boolean; search: boolean }): Promise<string> {
  const tools: Anthropic.Beta.BetaToolUnion[] = [];
  if (opts.fetch) tools.push({ type: "web_fetch_20260209", name: "web_fetch", max_uses: 2 });
  if (opts.search) tools.push({ type: "web_search_20260209", name: "web_search", max_uses: 4 });
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: prompt }];
  for (let round = 0; round < 5; round++) {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      tools: tools.length ? tools : undefined,
      messages,
    });
    if (res.stop_reason === "refusal") throw new Error("O pedido foi recusado pelo modelo.");
    if (res.stop_reason === "pause_turn") { messages.push({ role: "assistant", content: res.content as any }); continue; }
    const text = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map(b => b.text).join("\n");
    if (!text.trim()) throw new Error("Resposta vazia do modelo.");
    return text;
  }
  throw new Error("O modelo não terminou a tempo.");
}

/** Limite simples por IP, por instância (melhor esforço). */
export function makeRateLimiter(max: number, windowMs: number, now = () => Date.now()) {
  const hits = new Map<string, number[]>();
  return (key: string): boolean => {
    const t = now(), arr = (hits.get(key) || []).filter(x => t - x < windowMs);
    if (arr.length >= max) { hits.set(key, arr); return false; }
    arr.push(t); hits.set(key, arr); return true;
  };
}

export function isStandvirtual(url: string): boolean {
  try { const h = new URL(url).hostname; return h === "standvirtual.com" || h.endsWith(".standvirtual.com"); } catch { return false; }
}
