# M.pt — importar carros e motos para Portugal

Calcula o custo final de importar uma viatura usada (ISV, IVA, IUC, despesas) e compara com o mercado português. Cole o link de um anúncio europeu e a app lê os dados, procura online o que falta (cilindrada, CO₂, norma) e faz as contas.

## O que corre onde

| Parte | Onde | Notas |
|---|---|---|
| Cálculo ISV / IVA / IUC | No browser (`web/public/engine.js`) | Gerado de `packages/fiscal` |
| Importar anúncio por link | Cloud Function `importAd` → Claude API com `web_fetch` e `web_search` | Um anúncio de cada vez |
| Comparar com Portugal | Cloud Function `ptPrices` | O utilizador cola a página do Standvirtual |
| Pesquisar viaturas | Modo demonstração | Precisa de fonte licenciada (API mobile.de, Autovista) |

## Desenvolvimento

Precisa de Node 22.

```bash
npm run install:all
npm test            # motor fiscal + servidor
npm run build       # gera web/public/engine.js e compila functions/
```

Para correr localmente com o emulador (precisa do `firebase-tools`):

```bash
npm i -g firebase-tools
echo "ANTHROPIC_API_KEY=sk-ant-..." > functions/.secret.local   # não vai para o git
npm run serve       # http://localhost:5000
```

## Pôr online no Firebase

1. Criar o projeto em https://console.firebase.google.com e mudar para o plano **Blaze** (as Cloud Functions e o acesso à internet exigem-no; o uso baixo fica dentro do nível gratuito).
2. Pôr o ID do projeto em `.firebaserc` (em vez de `m-pt`).
3. `firebase login`
4. Guardar a chave da Claude API: `firebase functions:secrets:set ANTHROPIC_API_KEY` (criar a chave em https://console.anthropic.com).
5. `npm run deploy`

A app fica em `https://<projeto>.web.app`.

### Custos a ter em conta
- Cada importação por link é uma chamada à Claude API com até 2 leituras de página e 4 pesquisas web. Há um limite de 20 pedidos por hora por IP e no máximo 5 instâncias.
- Definir um alerta de orçamento no Google Cloud e um limite de gastos na consola da Anthropic.

### Opções
- `CLAUDE_MODEL` — modelo usado nas funções (por omissão o mais capaz).
- `ALLOW_PT_FETCH=true` — deixa o servidor abrir ele próprio a pesquisa do Standvirtual. Ligar só com autorização do site.

## Aviso legal

Os valores são uma estimativa com base nas tabelas em vigor (Código do ISV, OE 2026). O valor que conta é o da liquidação da AT na DAV. Confirme sempre a cilindrada, o CO₂ e a norma no COC.
