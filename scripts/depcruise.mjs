#!/usr/bin/env node
/**
 * Roda o dependency-cruiser sobre as raízes do workspace que existem.
 *
 * Não é conveniência: passar uma lista fixa faria o comando falhar enquanto
 * `apps/` não existe, e a correção óbvia (remover `apps` da lista) deixaria a
 * regra `frontend-no-server-secrets` silenciosamente sem cobertura no dia em
 * que alguém criasse o diretório. Aqui, criar a raiz já a coloca sob a cerca.
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const RAIZES = ['packages', 'apps', 'tools', 'experiments'];
const presentes = RAIZES.filter((r) => existsSync(r));

if (presentes.length === 0) {
  console.error(`nenhuma raiz de workspace encontrada. Esperava alguma de: ${RAIZES.join(', ')}`);
  process.exit(1);
}

const run = spawnSync(
  'node_modules/.bin/depcruise',
  [...presentes, '--config', '.dependency-cruiser.cjs', ...process.argv.slice(2)],
  { stdio: 'inherit' },
);
process.exit(run.status ?? 1);
