/**
 * I4 — imposição mecânica dos anéis.
 *
 * Anel 0 (core) e anel 1 (ports) não podem importar SDK de vendor nem anel 2.
 * A resolução do pnpm (hoist=false) já torna o import irresolúvel; esta camada
 * pega quem *adiciona* a dependência ao package.json.
 *
 * Esta configuração é ela mesma testada: `pnpm test:boundaries` roda
 * .dependency-cruiser.violation.cjs contra um fixture que viola a regra e
 * exige que a regra `ring0-no-vendor-sdk` apareça nas violações.
 * Mecanismo de imposição não verificado não é invariante.
 */

/** Todo SDK que só pode existir no anel 2. */
const VENDOR_SDKS = [
  '^@anthropic-ai/',
  '^openai$',
  '^@google/gen',
  '^@google/generative-ai',
  '^@azure/openai',
  '^@aws-sdk/',
  '^@supabase/',
  '^pg$',
  '^postgres$',
  '^@electric-sql/pglite',
  '^pdfjs-dist',
  '^mupdf',
  '^unpdf',
  '^playwright',
];

const RING0 = '^packages/(contracts|locator|prompts|domain-[^/]+)/';
const RING1 = '^packages/ports/';
const RING2 = '^packages/(llm|db|pdf|storage|dossier|observability)/';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'ring0-no-vendor-sdk',
      severity: 'error',
      comment:
        'I4: pacote de core/domínio não pode importar SDK de vendor. Passe por um port (anel 1) e implemente no anel 2.',
      from: { path: [RING0, RING1] },
      to: { path: VENDOR_SDKS },
    },
    {
      name: 'ring0-no-ring2',
      severity: 'error',
      comment: 'I4: core/ports não podem depender de adapters. As setas apontam para dentro.',
      from: { path: [RING0, RING1] },
      to: { path: RING2 },
    },
    {
      name: 'ports-interfaces-only',
      severity: 'error',
      comment: 'packages/ports só pode importar @merge/contracts. Port com implementação deixa de ser port.',
      from: { path: RING1 },
      to: {
        pathNot: ['^packages/ports/', '^packages/contracts/', 'node_modules/(zod|typescript)/'],
        dependencyTypesNot: ['core', 'type-only'],
      },
    },
    {
      name: 'frontend-no-server-secrets',
      severity: 'error',
      comment:
        'I3: nenhuma chave de LLM no cliente. Bundle de browser não importa SDK de modelo, nem packages/llm, db ou prompts.',
      from: { path: '^apps/(cockpit|portal)/' },
      to: { path: [...VENDOR_SDKS, '^packages/(llm|db|prompts)/'] },
    },
    {
      name: 'no-cross-package-relative',
      severity: 'error',
      comment:
        'Atravessar fronteira de pacote por caminho relativo contorna a cerca: o import resolve sem estar ' +
        'declarado no package.json, e a resolução do pnpm deixa de proteger nada. Use o nome do pacote.',
      // `$1` é o grupo capturado em `from.path`: o alvo pode estar em
      // packages/, mas não no MESMO pacote de origem. `dependencyTypes: local`
      // restringe a imports relativos, que são a única forma de furar a cerca.
      from: { path: '^packages/([^/]+)/' },
      to: { path: '^packages/', pathNot: '^packages/$1/', dependencyTypes: ['local'] },
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Dependência circular.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment: 'Módulo que ninguém importa.',
      from: { orphan: true, pathNot: ['\\.d\\.ts$', '(^|/)index\\.ts$', '\\.test\\.ts$', '(^|/)vitest\\.config\\.ts$'] },
      to: {},
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)test/fixtures/' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'types', 'default'] },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
