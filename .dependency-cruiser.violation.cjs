/**
 * Config usada SÓ por `pnpm test:boundaries`.
 *
 * É a config de produção com a exclusão de `test/fixtures/` removida, para que
 * o fixture que viola a regra seja de fato analisado. O script de teste exige
 * que a violação relatada seja `ring0-no-vendor-sdk` — não basta exit != 0,
 * porque um exit != 0 por outro motivo (módulo irresolúvel, por exemplo)
 * daria a falsa impressão de que a cerca funciona.
 */
const base = require('./.dependency-cruiser.cjs');

module.exports = {
  ...base,
  options: {
    ...base.options,
    exclude: { path: '(?!)' },
  },
};
