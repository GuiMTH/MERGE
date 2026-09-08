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
pnpm test --project locator     # só um pacote
pnpm test:watch
pnpm demo                       # gera demo/ancoras.html
```

### `pnpm test:boundaries` — a cerca testando a si mesma

A arquitetura em anéis proíbe SDK de vendor fora do anel 2 (I4). Isso é imposto
em três camadas: `hoist=false` no `.npmrc` torna o import irresolúvel, o
dependency-cruiser pega quem adiciona a dependência, e este comando prova que a
regra de fato reprova — rodando o linter contra um fixture que a viola de
propósito e exigindo que a regra certa dispare *e* que o build saia com código
diferente de zero.

`packages/contracts/test/fixtures/violation/` existe para falhar. **Não
"corrija" aquele import** — consertá-lo faz o teste da cerca falhar, que é o
comportamento pretendido.

Se quiser ver a cerca funcionando de verdade, tente importar `zod` de dentro de
`packages/locator`: não resolve, porque o `package.json` daquele pacote não
declara `zod`.

## `pnpm demo` — o verificador visual de âncoras

```bash
pnpm demo && open demo/ancoras.html      # Linux: xdg-open
```

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
| `tools/demo` | 3 | ✅ verificador visual de âncoras |
| `packages/db` | 2 | ⏳ migrations, RLS, triggers de append-only e supersessão |
| `packages/ports` · `prompts` · `llm` | 1 · 0 · 2 | ⏳ |
| `packages/pdf` | 2 | ⏳ depende do bake-off da Fase 0 |
| `packages/dossier` | 2 | ⏳ o produto (módulo 7) |
| `apps/*` | 3 | ⏳ |

Não há API nem UI ainda: hoje o repo é biblioteca. O `pnpm demo` é o único
artefato que se olha.

## Estrutura

Quatro anéis, e as setas apontam só para dentro. A tabela completa, os imports
banidos e o mapa de quem é dono de quê estão em [`CLAUDE.md`](CLAUDE.md).
Pacotes internos exportam `./src/index.ts` direto — **não há passo de build**.
