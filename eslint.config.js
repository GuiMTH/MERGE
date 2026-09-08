import tseslint from 'typescript-eslint';

const REGRAS_DE_DOMINIO = {
  '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
  '@typescript-eslint/no-unused-vars': [
    'error',
    // `ignoreRestSiblings` habilita o idioma `const { descartado, ...resto }`,
    // que é como se remove uma chave de um objeto sem mutá-lo.
    { ignoreRestSiblings: true, argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
  ],
  '@typescript-eslint/no-non-null-assertion': 'error',
  'no-restricted-syntax': [
    'error',
    {
      selector: 'TSNonNullExpression',
      message: 'Sem `!`. Num domínio regulado, estreite o tipo ou trate o caso ausente explicitamente.',
    },
  ],
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      // O fixture viola a cerca de propósito; lintá-lo produziria ruído e
      // convidaria alguém a "corrigi-lo", que é o que o teste da cerca proíbe.
      '**/test/fixtures/**',
    ],
  },

  // Código de domínio: lint com informação de tipo.
  {
    files: ['packages/*/src/**/*.ts', 'packages/*/test/**/*.ts', 'apps/*/src/**/*.ts', 'tools/*/src/**/*.ts'],
    extends: [...tseslint.configs.strict],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: REGRAS_DE_DOMINIO,
  },

  // Configuração e scripts de build: fora do programa TypeScript, então lint
  // sem serviço de projeto. Ligar `projectService` aqui só produziria
  // "not found by the project service" para todo arquivo de config.
  {
    files: ['*.config.ts', 'packages/*/*.config.ts', '*.js', '*.cjs', 'scripts/**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { parserOptions: { project: false, projectService: false } },
  },

  {
    files: ['**/*.test.ts', 'scripts/**/*.mjs'],
    rules: { 'no-restricted-syntax': 'off', '@typescript-eslint/no-non-null-assertion': 'off' },
  },
);
