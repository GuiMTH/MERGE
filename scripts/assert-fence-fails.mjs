#!/usr/bin/env node
/**
 * Prova que a cerca de I4 reprova de verdade.
 *
 * Roda o dependency-cruiser com a config de violação contra um fixture que
 * importa um SDK de vendor de dentro do anel 0, e exige que a violação
 * relatada seja exatamente `ring0-no-vendor-sdk`.
 *
 * Exigir só exit != 0 seria fraco: o fixture importa um pacote que não está
 * instalado, então um exit != 0 poderia vir de "módulo irresolúvel" e a cerca
 * estaria quebrada sem ninguém notar.
 */
import { spawnSync } from 'node:child_process';

const FIXTURE = 'packages/contracts/test/fixtures/violation';
const EXPECTED_RULE = 'ring0-no-vendor-sdk';

const depcruise = (tipoDeSaida) =>
  spawnSync(
    'node_modules/.bin/depcruise',
    [FIXTURE, '--config', '.dependency-cruiser.violation.cjs', '--output-type', tipoDeSaida],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );

// Duas verificações, porque nenhuma sozinha basta:
//  - o relatório json diz QUAL regra disparou (exit != 0 poderia vir de
//    "módulo irresolúvel" e a cerca estaria quebrada sem ninguém notar);
//  - o reporter `err` é o que propaga exit code, e é o que de fato reprova um
//    build. O reporter json sai com 0 mesmo relatando violação.
const run = depcruise('json');

if (run.error) {
  console.error('não foi possível executar o depcruise:', run.error.message);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(run.stdout);
} catch {
  console.error('depcruise não devolveu JSON. stdout:\n', run.stdout, '\nstderr:\n', run.stderr);
  process.exit(1);
}

const violations = report.summary?.violations ?? [];
const hit = violations.find((v) => v.rule?.name === EXPECTED_RULE);

if (!hit) {
  console.error(
    `A CERCA DE I4 NÃO ESTÁ FUNCIONANDO.\n` +
      `Esperava a regra "${EXPECTED_RULE}" disparar em ${FIXTURE}, mas ela não apareceu.\n` +
      `Violações relatadas: ${JSON.stringify(violations.map((v) => v.rule?.name))}\n` +
      `Se o fixture foi removido ou renomeado, restaure-o — ele é o teste da cerca, não código morto.`,
  );
  process.exit(1);
}

const paraBuild = depcruise('err');
if (paraBuild.status === 0) {
  console.error(
    `A regra "${EXPECTED_RULE}" foi relatada, mas o depcruise saiu com 0 e portanto NÃO reprova um build.\n` +
      `Verifique se a severidade da regra é "error" e não "warn".`,
  );
  process.exit(1);
}

console.log(
  `cerca de I4 verificada: "${EXPECTED_RULE}" reprova ${hit.from} -> ${hit.to}, e o build sai com ${paraBuild.status}`,
);
