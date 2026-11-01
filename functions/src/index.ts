import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import Anthropic from "@anthropic-ai/sdk";
import { askWithWeb, importPrompt, InputError, isStandvirtual, makeRateLimiter, parseJsonAnswer, ptPricesPrompt, validateText, validateUrl } from "./logic";

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const opts = { region: "europe-west1", secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 300, memory: "512MiB" as const, maxInstances: 5 };
const limit = makeRateLimiter(20, 60 * 60 * 1000);

function clientIp(req: any): string { return String(req.headers["x-forwarded-for"] || req.ip || "anon").split(",")[0].trim(); }

function guard(req: any, res: any): boolean {
  if (req.method !== "POST") { res.status(405).json({ erro: "Use POST." }); return false; }
  if (!limit(clientIp(req))) { res.status(429).json({ erro: "Muitos pedidos seguidos. Tente daqui a uma hora." }); return false; }
  return true;
}

function fail(res: any, e: unknown) {
  if (e instanceof InputError) return res.status(400).json({ erro: e.message });
  if (e instanceof Anthropic.RateLimitError) return res.status(429).json({ erro: "O serviço de IA está ocupado. Tente daqui a um minuto." });
  if (e instanceof Anthropic.APIError) { logger.error("anthropic", { status: e.status, message: e.message }); return res.status(502).json({ erro: "O serviço de IA falhou. Tente de novo." }); }
  logger.error("import", e);
  return res.status(500).json({ erro: "Não foi possível ler o anúncio. Cole o texto ou preencha o formulário." });
}

/** POST /api/import  { url?, text? } -> { dados, completados, avisos } */
export const importAd = onRequest(opts, async (req, res) => {
  if (!guard(req, res)) return;
  try {
    const url = validateUrl(req.body?.url), text = validateText(req.body?.text);
    if (!url && !text) throw new InputError("Indique um link ou cole o texto do anúncio.");
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
    const answer = await askWithWeb(client, importPrompt(url, text), { fetch: !!url, search: true });
    const out = parseJsonAnswer(answer);
    res.json({ dados: out.dados || {}, completados: out.completados || {}, avisos: out.avisos || [] });
  } catch (e) { fail(res, e); }
});

/**
 * POST /api/pt-prices  { vehicle, text?, url? } -> { anuncios }
 * Por omissão só lê texto colado pelo utilizador. A leitura direta do Standvirtual
 * fica desligada até haver acordo com o site (ALLOW_PT_FETCH=true para ligar).
 */
export const ptPrices = onRequest(opts, async (req, res) => {
  if (!guard(req, res)) return;
  try {
    const text = validateText(req.body?.text), url = validateUrl(req.body?.url);
    const allowFetch = process.env.ALLOW_PT_FETCH === "true" && !!url && isStandvirtual(url);
    if (!text && !allowFetch) throw new InputError("Cole o texto da página de resultados do Standvirtual.");
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
    const answer = await askWithWeb(client, ptPricesPrompt(req.body?.vehicle ?? {}, text, text ? null : url), { fetch: !text && allowFetch, search: false });
    const out = parseJsonAnswer(answer);
    const anuncios = (out.anuncios || []).filter((a: any) => typeof a?.preco_eur === "number" && a.preco_eur > 500 && a.preco_eur < 1_000_000);
    res.json({ anuncios });
  } catch (e) { fail(res, e); }
});
