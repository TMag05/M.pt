// Entrada para o site: expõe o motor como variáveis globais (o index.html usa-as diretamente).
import * as F from "./index";
Object.assign(globalThis as any, F);
