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

/**
 * Cada par é (fixture que viola de propósito, regra que tem de reprová-lo).
 *
 * A segunda entrada só passou a valer algo quando `apps/` nasceu: antes disso
 * `frontend-no-server-secrets` passava por vacuidade, porque não havia
 * arquivo de frontend algum para reprovar — e uma regra nunca exercitada não é
 * distinguível de uma regra quebrada.
 */
const CERCAS = [
  { fixture: 'packages/contracts/test/fixtures/violation', regra: 'ring0-no-vendor-sdk', invariante: 'I4' },
  { fixture: 'apps/cockpit/test/fixtures/violation', regra: 'frontend-no-server-secrets', invariante: 'I3' },
];

const depcruise = (fixture, tipoDeSaida) =>
  spawnSync(
    'node_modules/.bin/depcruise',
    [fixture, '--config', '.dependency-cruiser.violation.cjs', '--output-type', tipoDeSaida],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );

// Duas verificações por cerca, porque nenhuma sozinha basta:
//  - o relatório json diz QUAL regra disparou (exit != 0 poderia vir de
//    "módulo irresolúvel" e a cerca estaria quebrada sem ninguém notar);
//  - o reporter `err` é o que propaga exit code, e é o que de fato reprova um
//    build. O reporter json sai com 0 mesmo relatando violação.
let falhou = false;

for (const { fixture, regra, invariante } of CERCAS) {
  const run = depcruise(fixture, 'json');

  if (run.error) {
    console.error(`não foi possível executar o depcruise: ${run.error.message}`);
    process.exit(1);
  }

  let report;
  try {
    report = JSON.parse(run.stdout);
  } catch {
    console.error(`depcruise não devolveu JSON para ${fixture}.\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`);
    process.exit(1);
  }

  const violations = report.summary?.violations ?? [];
  const hit = violations.find((v) => v.rule?.name === regra);

  if (!hit) {
    console.error(
      `A CERCA DE ${invariante} NÃO ESTÁ FUNCIONANDO.\n` +
        `Esperava a regra "${regra}" disparar em ${fixture}, mas ela não apareceu.\n` +
        `Violações relatadas: ${JSON.stringify(violations.map((v) => v.rule?.name))}\n` +
        `Se o fixture foi removido ou renomeado, restaure-o — ele é o teste da cerca, não código morto.`,
    );
    falhou = true;
    continue;
  }

  const paraBuild = depcruise(fixture, 'err');
  if (paraBuild.status === 0) {
    console.error(
      `A regra "${regra}" foi relatada, mas o depcruise saiu com 0 e portanto NÃO reprova um build.\n` +
        `Verifique se a severidade da regra é "error" e não "warn".`,
    );
    falhou = true;
    continue;
  }

  console.log(
    `cerca de ${invariante} verificada: "${regra}" reprova ${hit.from} -> ${hit.to}, ` +
      `e o build sai com ${paraBuild.status}`,
  );
}

process.exit(falhou ? 1 : 0);
