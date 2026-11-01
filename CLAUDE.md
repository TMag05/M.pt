# M.pt — regras para quem mexe no código

Calculadora de importação de carros e motos para Portugal (ISV, IUC, IVA) com guia legal. Interface e textos em português de Portugal.

## Estrutura
- `packages/fiscal` — motor fiscal puro em TypeScript. Todas as taxas vivem em `RULESET` (`src/engine.ts`). Valores em cêntimos inteiros.
- `web/public` — app estática (Firebase Hosting). `engine.js` é gerado a partir do pacote fiscal (`npm run build`); não editar à mão.
- `functions` — Cloud Functions (europe-west1): `/api/import` lê um anúncio por link ou texto com a Claude API e completa dados técnicos com pesquisa web; `/api/pt-prices` tira preços de uma página do Standvirtual colada pelo utilizador.

## Regras
1. Nenhuma taxa, escalão ou prazo fora do `RULESET`. Cada alteração de taxa leva a fonte (Código do ISV, Lei do OE, informador.pt/AT) no commit e um teste.
2. `npm test` e `npm run typecheck` têm de passar. Casos de referência em `packages/fiscal/test/engine.test.ts` (Golf, PHEV, moto, IVA novo, país terceiro).
3. Sem scraping em massa de sites de anúncios. A importação é um anúncio de cada vez, pedido pelo utilizador. A leitura direta do Standvirtual fica desligada (`ALLOW_PT_FETCH`) até haver acordo com o site.
4. A chave da Anthropic só existe como segredo do Firebase (`ANTHROPIC_API_KEY`). Nunca no cliente nem no repositório.
5. Mobile primeiro: tudo tem de funcionar a 360 px de largura sem scroll horizontal.
6. Dados estimados (IA ou pesquisa) aparecem sempre marcados e com aviso para confirmar no COC.
