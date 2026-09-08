/**
 * A fábrica de páginas mora em `src/sintetico.ts`, não aqui: o verificador
 * visual de geometria e, depois, o harness do bake-off precisam dela também.
 * Este arquivo só reexporta, com o nome curto que os testes usam.
 */
export { acervoDe, paginaSintetica as paginaDe, TEXTO_ESTUDO } from '../src/sintetico.js';
