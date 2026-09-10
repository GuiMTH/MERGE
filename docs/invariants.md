# Invariantes I1..I9 — e o teste que prova cada um

**Invariante sem teste que o prove é bloqueador de Fase 0.** Esta tabela é o
DoD, não documentação de acompanhamento. Uma linha sem teste é trabalho
pendente, e está marcada como tal.

| # | Invariante | Provado por | Status |
|---|---|---|---|
| **I1** | Nenhuma claim sem localizador resolvível | `packages/locator/test/property.test.ts` — mutações legais verificam com offsets certos, ilegais rejeitam, **zero falso-aceite**. `packages/contracts/test/json-schema.snapshot.test.ts` — `ancoragem` tem `minItems: 1`, então claim sem localizador é inválida no fio. | ✅ algoritmo e fio · ⏳ falta o nível de banco (S2) |
| **I2** | Escopo de visibilidade aplicado na camada de dados | `packages/db/test/rls.test.ts` — role de cliente contra toda tabela do schema `agencia`, com guard anti-superuser | ⏳ S2 |
| **I3** | Nenhuma chave de LLM no cliente | **`pnpm test:boundaries`** — a regra `frontend-no-server-secrets` reprova `apps/cockpit/test/fixtures/violation/`, que importa SDK de modelo e `@merge/db` de dentro de um bundle de browser | ✅ cerca provada · ⏳ scan automático do bundle no CI (S10) |
| **I4** | Toda chamada de LLM passa pela camada de abstração | **`pnpm test:boundaries`** — `scripts/assert-fence-fails.mjs` exige que `ring0-no-vendor-sdk` dispare no fixture *e* que o build saia != 0. Mais `hoist=false` no `.npmrc`, que torna o import irresolúvel. | ✅ |
| **I5** | Output de modelo sempre estruturado e validado | `packages/contracts/test/wire-schema.test.ts` — rejeita `refine`/`transform`/`default`/`catch`/objeto solto, com teste que primeiro DEMONSTRA a omissão silenciosa. `LlmAdapter` sem método de texto livre. | ✅ contratos · ⏳ adaptador (S3) |
| **I6** | Tudo versionado, nada sobrescrito | trigger `BEFORE UPDATE` que `RAISE`; teste de UPDATE reprovado. Prompts: `pnpm prompts:verify` reprova edição in-place de versão liberada. | ⏳ S2/S3 |
| **I7** | Supersessão propaga | trigger `AFTER INSERT` em `referencia_versao`/`label_versao`; teste que insere versão nova e confere linhas de impacto | ⏳ S2 |
| **I8** | O portal nunca bloqueia o envio do briefing | teste de briefing incompleto persistido com sucesso; `score_completude` é campo, não gate | ⏳ S6 |
| **I9** | Gap report não exposto na superfície do cliente | `toClientDossier()` — imposto por TIPO, não por condicional de template; zod `.strict()`; teste de CI que faz grep do HTML emitido | ⏳ S9 |

## Invariantes com prova adicional além do exigido

**I1 tem um limite conhecido, com teste que o documenta.** `verifyQuote`
responde "este texto está no documento?", não "esta claim é fiel ao contexto?".
Soltar uma negação da borda de uma citação produz trecho literal e verifica,
corretamente. Ver `packages/locator/CLAUDE.md`.

**As cercas são elas mesmas testadas.** Um mecanismo de imposição que ninguém
verifica não é invariante — é intenção. Dois fixtures violam de propósito e
**não devem ser "corrigidos"**: `packages/contracts/test/fixtures/violation/`
para I4 e `apps/cockpit/test/fixtures/violation/` para I3.

O segundo é o caso instrutivo. A regra `frontend-no-server-secrets` existia
desde o S0 e passava verde — mas passava **por vacuidade**, porque não havia
`apps/` algum para ela reprovar. Uma regra que nunca é exercitada não é
distinguível de uma regra quebrada, e o verde dela não era evidência de nada.
Nascer `apps/cockpit` foi o que tornou a regra verificável, e é o que a torna
agora um invariante de fato.
