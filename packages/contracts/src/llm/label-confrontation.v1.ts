import { z } from 'zod';
import { assertWireSchema } from './wire-schema.js';
import { coberturaLabel } from '../domain/enums.js';

/**
 * Contrato 6.3 — Confronto com label (módulo 3b).
 *
 * `requer_revisao_humana` está no schema porque o modelo deve declará-lo, mas
 * o valor dele NÃO é aceito como veio: `off_label` e `parcial` sempre forçam
 * `true`, coagido em `exigeRevisaoHumana()` no domínio e imposto por CHECK no
 * banco. Regra que se pode computar não se pede ao modelo.
 *
 * O critério final de cobertura é decisão de quem responde por regulatório na
 * agência, não do modelo (§6.3). Por isso a saída é uma proposta com
 * justificativa, e não um veredito.
 */

const trechoLabel = z.strictObject({
  label_versao: z.string().min(1).describe('A versão do label confrontada.'),
  pagina: z.int().min(1),
  quote: z.string().min(12).max(2000).describe('Texto LITERAL do label, verificado como qualquer outra citação.'),
});

export const labelConfrontationOutputV1 = assertWireSchema(
  z.strictObject({
    cobertura: coberturaLabel,
    /**
     * Nulo quando `cobertura` é `nao_avaliada` — não há trecho a citar se o
     * label não foi confrontado. Nos outros casos a ausência de trecho é o
     * próprio sinal de que a avaliação não tem lastro.
     */
    trecho_label: trechoLabel.nullable(),
    justificativa: z.string().min(1).max(2000),
    requer_revisao_humana: z.boolean(),
  }),
  'LabelConfrontationOutputV1',
);

export type LabelConfrontationOutputV1 = z.infer<typeof labelConfrontationOutputV1>;
export type TrechoLabelPropostoV1 = z.infer<typeof trechoLabel>;
