import { describe, it, expect, vi } from "vitest";
import { askWithWeb, importPrompt, InputError, isStandvirtual, makeRateLimiter, parseJsonAnswer, validateText, validateUrl } from "../src/logic";

describe("validação", () => {
  it("aceita só links http(s)", () => {
    expect(validateUrl("https://suchen.mobile.de/x?id=1")).toContain("mobile.de");
    expect(() => validateUrl("javascript:alert(1)")).toThrow(InputError);
    expect(() => validateUrl("file:///etc/passwd")).toThrow(InputError);
    expect(validateUrl("")).toBeNull();
  });
  it("limita o texto colado", () => {
    expect(() => validateText("x".repeat(100_001))).toThrow(InputError);
    expect(validateText("abc")).toBe("abc");
  });
  it("reconhece o Standvirtual", () => {
    expect(isStandvirtual("https://www.standvirtual.com/carros/bmw")).toBe(true);
    expect(isStandvirtual("https://standvirtual.com.evil.io/")).toBe(false);
  });
});

describe("prompt e resposta", () => {
  it("o prompt com link pede web_fetch e inclui o link", () => {
    const p = importPrompt("https://example.com/ad", null);
    expect(p).toContain("web_fetch"); expect(p).toContain("https://example.com/ad");
  });
  it("tira o JSON da resposta, com ou sem bloco de código", () => {
    expect(parseJsonAnswer('Aqui está:\n```json\n{"dados":{"km":1}}\n```').dados.km).toBe(1);
    expect(parseJsonAnswer('{"a":2}').a).toBe(2);
    expect(() => parseJsonAnswer("sem json")).toThrow();
  });
});

describe("askWithWeb", () => {
  it("continua depois de pause_turn e devolve o texto final", async () => {
    const create = vi.fn()
      .mockResolvedValueOnce({ stop_reason: "pause_turn", content: [{ type: "server_tool_use" }] })
      .mockResolvedValueOnce({ stop_reason: "end_turn", content: [{ type: "text", text: '{"ok":true}' }] });
    const out = await askWithWeb({ beta: { messages: { create } } } as any, "p", { fetch: true, search: true });
    expect(out).toBe('{"ok":true}');
    expect(create).toHaveBeenCalledTimes(2);
    const body = create.mock.calls[0][0];
    expect(body.fallbacks).toBe("default");
    expect(body.tools.map((t: any) => t.type)).toEqual(["web_fetch_20260209", "web_search_20260209"]);
    expect(create.mock.calls[1][0].messages).toHaveLength(2);
  });
  it("falha numa recusa", async () => {
    const create = vi.fn().mockResolvedValue({ stop_reason: "refusal", content: [] });
    await expect(askWithWeb({ beta: { messages: { create } } } as any, "p", { fetch: false, search: false })).rejects.toThrow();
  });
});

describe("limite por IP", () => {
  it("bloqueia depois do máximo e liberta depois da janela", () => {
    let t = 0; const ok = makeRateLimiter(2, 1000, () => t);
    expect(ok("a")).toBe(true); expect(ok("a")).toBe(true); expect(ok("a")).toBe(false);
    t = 1500; expect(ok("a")).toBe(true);
  });
});
