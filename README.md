# MERGE

Plataforma de produção de material científico para agência de MedComms que
atende indústria farmacêutica.

O contrato do projeto é [`docs/prompt-master.md`](docs/prompt-master.md). Os
invariantes e o teste que prova cada um estão em
[`docs/invariants.md`](docs/invariants.md). Convenções de código e a
arquitetura em anéis estão em [`CLAUDE.md`](CLAUDE.md).

## Rodando localmente

**Requisitos:** Node 22 e pnpm 10.

```bash
corepack enable          # o pnpm certo vem do campo packageManager
pnpm install
pnpm check               # é exatamente o que o CI roda
```

`pnpm check` roda quatro coisas, e a terceira é a menos óbvia:

| comando | o que faz |
|---|---|
| `pnpm typecheck` | `tsc` sobre o workspace inteiro, sem passo de build |
| `pnpm lint` | eslint + dependency-cruiser (as regras dos anéis) |
| `pnpm test:boundaries` | **prova que a cerca de I4 reprova** — ver abaixo |
| `pnpm test` | vitest, todos os projetos |

Comandos úteis soltos:

```bash
pnpm dev                        # sobe a bancada em http://localhost:5173
pnpm test --project locator     # só um pacote
pnpm test:watch
pnpm demo                       # gera demo/ancoras.html
```

### `pnpm test:boundaries` — as cercas testando a si mesmas

A arquitetura em anéis proíbe SDK de vendor fora do anel 2 (I4), e proíbe
qualquer coisa de servidor num bundle de browser (I3). Isso é imposto em três
camadas: `hoist=false` no `.npmrc` torna o import irresolúvel, o
dependency-cruiser pega quem adiciona a dependência, e este comando prova que as
regras de fato reprovam — rodando o linter contra fixtures que as violam de
propósito e exigindo que a regra certa dispare *e* que o build saia com código
diferente de zero.

Dois diretórios existem para falhar, e **não devem ser "corrigidos"**:
`packages/contracts/test/fixtures/violation/` (I4) e
`apps/cockpit/test/fixtures/violation/` (I3). Consertar aqueles imports faz o
teste da cerca falhar, que é o comportamento pretendido.

Se quiser ver a cerca funcionando de verdade, tente importar `zod` de dentro de
`packages/locator`: não resolve, porque o `package.json` daquele pacote não
declara `zod`.

## `pnpm dev` — a bancada de âncoras

```bash
pnpm dev            # http://localhost:5173
```

Cole um trecho de estudo e a citação que um modelo proporia. A cada tecla,
`verifyQuote` diz se ela ancoraria e, quando não, **qual guarda mordeu** e por
quê. Os oito casos canônicos entram como presets.

É a forma prática de calibrar intuição sobre as guardas: mude um dígito numa
citação aceita e veja a rejeição por deriva numérica; tire um `Nao` do meio e
veja a deriva de negação.

O `textarea` do documento não envolve linha de propósito — as quebras de linha
**são** o dado, e uma linha dobrada pela largura da caixa seria indistinguível
de uma quebra real.

A bancada roda só sobre o anel 0: sem banco, sem chave, sem chamada de LLM.
Aqui a verificação acontece no browser porque é bancada; no caminho de produção
ela é server-side, antes de qualquer persistência.

## `pnpm demo` — o verificador visual de âncoras

```bash
pnpm demo && xdg-open demo/ancoras.html   # macOS: open
pnpm demo:artifact                        # mesma página, sem o envelope HTML
```

Um mesmo gerador emite os dois formatos. `--artifact` omite
`<!doctype>/<html>/<head>/<body>` porque o host do artifact injeta o próprio —
escrever um segundo HTML à mão garantiria divergência entre o que se testa
localmente e o que se publica.

Gera um HTML autocontido com oito citações contra a mesma página: quatro
legítimas, que verificam, e quatro adulteradas, que são rejeitadas — cada uma
mostrando qual guarda mordeu e por quê.

Cada destaque amarelo é o `bbox_norm` da âncora escrito **direto como
porcentagem CSS**, sem nenhuma conversão em runtime. O texto da página é
desenhado a partir dos mesmos bboxes, então texto e destaque saem da mesma
conversão: se a convenção de eixo, o offset de CropBox ou a rotação estiverem
trocados, o texto se embaralha junto com a caixa. Um bbox pode estar
numericamente "certo" e ainda cair no lugar errado, e nenhum teste unitário de
número pega isso — a única verificação honesta é olhar.

É também o mesmo mecanismo de destaque que o dossiê (módulo 7) vai usar, o que
o desrisca antes de ele existir.

**A página do demo é sintética.** Ela cumpre o contrato do parser, mas não é um
PDF. Quando um candidato vencer o bake-off da Fase 0, este mesmo verificador
roda sobre página real — é o que o gate da Fase 0 exige antes de a Fase 1
começar.

## O que existe hoje

| Pacote | Anel | Estado |
|---|---|---|
| `packages/contracts` | 0 | ✅ ids brandeados, taxonomia de erro, os 3 wire schemas do §6, `assertWireSchema` |
| `packages/locator` | 0 | ✅ geometria, normalização preservando offsets, `verifyQuote` com 5 tiers e 3 guardas |
| `tools/demo` | 3 | ✅ verificador visual de âncoras (HTML estático) |
| `apps/cockpit` | 3 | ✅ bancada interativa, `pnpm dev` |
| `packages/db` | 2 | ⏳ migrations, RLS, triggers de append-only e supersessão |
| `packages/ports` · `prompts` · `llm` | 1 · 0 · 2 | ⏳ |
| `packages/pdf` | 2 | ⏳ depende do bake-off da Fase 0 |
| `packages/dossier` | 2 | ⏳ o produto (módulo 7) |
| `apps/*` | 3 | ⏳ |

Não há API nem persistência ainda. A bancada (`pnpm dev`) e o verificador
estático (`pnpm demo`) são os artefatos que se olham, e ambos vivem sobre o
anel 0.

## Estrutura

Quatro anéis, e as setas apontam só para dentro. A tabela completa, os imports
banidos e o mapa de quem é dono de quê estão em [`CLAUDE.md`](CLAUDE.md).
Pacotes internos exportam `./src/index.ts` direto — **não há passo de build**.
