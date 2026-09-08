# MERGE — contexto do repositório

Plataforma de produção de material científico para agência de MedComms que atende
indústria farmacêutica. O documento raiz do projeto é
`docs/prompt-master.md` — leia-o antes de qualquer tarefa de domínio.

Duas coisas definem como se trabalha aqui:

**O domínio é regulado.** Afirmação sem lastro que sobrevive até a peça aprovada
não é bug, é incidente. Em conflito entre entregar funcionalidade e preservar
rastreabilidade, rastreabilidade ganha, sempre.

**A IA propõe, o humano decide.** Nenhuma decisão científica é automatizada.
Todo output de modelo é sugestão que aguarda sign-off registrado de uma pessoa.
Isso é o requisito central do produto, não limitação a contornar.

## Invariantes

`docs/invariants.md` mapeia I1..I9 ao teste que prova cada um. **Invariante sem
teste que o prove é bloqueador.** Se uma tarefa parecer exigir a violação de
uma, pare e sinalize em vez de contornar.

## Arquitetura em anéis — as setas apontam só para dentro

| Anel | Pacotes | Pode importar | SDK de vendor |
|---|---|---|---|
| 0 core | `contracts`, `locator`, `prompts`, `domain-*` | anel 0 | **proibido** |
| 1 ports | `ports` (só interfaces) | 0 | **proibido** |
| 2 adapters | `llm`, `db`, `pdf`, `storage`, `dossier`, `observability` | 0, 1 | **só aqui** |
| 3 composition | `apps/*`, `tools/*` | 0, 1, 2 | permitido, só para wiring |

Isto é imposto por máquina em três camadas, não por convenção:

1. **Resolução.** `.npmrc` tem `hoist=false`, então um pacote só resolve o que o
   próprio `package.json` declara. Um SDK de vendor num pacote de anel 0 não
   resolve — nem em runtime, nem no tsc.
2. **Declaração.** `.dependency-cruiser.cjs` pega quem *adiciona* a dependência.
3. **A cerca é ela mesma testada.** `pnpm test:boundaries` roda o
   dependency-cruiser contra `packages/contracts/test/fixtures/violation/` e
   exige que a regra `ring0-no-vendor-sdk` dispare *e* que o build saia com
   código != 0. **Não "corrija" aquele fixture** — ele viola a regra de
   propósito; consertá-lo faz o teste da cerca falhar.

## Imports banidos fora do anel 2

`@anthropic-ai/*`, `openai`, `@google/gen*`, `@azure/openai`, `@aws-sdk/*`,
`@supabase/*`, `pg`, `postgres`, `@electric-sql/pglite`, `pdfjs-dist`, `mupdf`,
`unpdf`, `playwright`.

Em `apps/cockpit` e `apps/portal` também são banidos `packages/llm`,
`packages/db` e `packages/prompts` — I3, nenhuma chave de LLM no cliente. Nunca
prefixe uma variável de servidor com `VITE_`: o Vite expõe qualquer `VITE_*` no
bundle do browser.

## Quem é dono de quê

| Pacote | Dono de | Regra não-óbvia |
|---|---|---|
| `contracts` | ids brandeados, taxonomia de erro, os 3 wire schemas do §6 | Todo schema de fio passa por `assertWireSchema`. `.refine()` **desaparece em silêncio** do JSON Schema — regra de negócio se computa em código e se impõe no banco, nunca se pede ao modelo. |
| `locator` | geometria de bbox, normalização, `verifyQuote()` | É o ponto de imposição de I1. `POLICY` é const **congelado**: threshold ajustável por env é flag de bypass com outro nome. |
| `ports` | interfaces | `LlmAdapter` **não tem** método de texto livre. I5 não é regra que se lembra de seguir; é um método que não existe. |
| `prompts` | prompts versionados | Arquivos `vN.md` são **imutáveis**. Para mudar um prompt você adiciona `v4.md`; editar in-place reprova o CI. |
| `llm` | o único importador de SDK de modelo | Retry em três eixos que nunca se confundem: transporte retenta; violação de schema repara **uma vez**; violação semântica **não é retry**, é gap. |
| `db` | migrations, RLS, triggers | Append-only é trigger, não disciplina de ORM. RLS é role + policy, não condicional de UI. |
| `dossier` | render do dossiê | I9 é imposto por **tipo** (`toClientDossier`), não por condicional de template. |

## Comandos

```
pnpm check              # typecheck + lint + cerca + testes. É o que o CI roda.
pnpm typecheck
pnpm lint               # eslint + dependency-cruiser
pnpm test               # vitest, todos os projetos
pnpm test:boundaries    # prova que a cerca de I4 reprova
```

## Convenções

- **Domínio em português.** Entidades, colunas, campos de schema e mensagens de
  erro seguem a linguagem do domínio (`referencia`, `trecho`, `ancoragem`,
  `cobertura_label`). Termos de infraestrutura ficam em inglês onde é o idioma
  natural da ferramenta.
- **Nada de `!` (non-null assertion).** Num domínio regulado, estreite o tipo ou
  trate o caso ausente. O lint reprova.
- **`exactOptionalPropertyTypes` e `noUncheckedIndexedAccess` estão ligados.**
  Acesso a índice devolve `T | undefined`, e isso é intencional.
- Pacotes internos exportam `./src/index.ts` direto, sem passo de build.
