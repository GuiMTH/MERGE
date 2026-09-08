import { z } from 'zod';
import { assertWireSchema } from './wire-schema.js';
import { forca } from '../domain/enums.js';

/**
 * Contrato 6.2 — Extração e ancoragem de claims (módulo 3).
 *
 * Calibrado para PRECISÃO, não recall (§6.2): claim que o sistema deixou
 * passar é humano que pega; claim inventada que sobrevive à revisão é
 * incidente regulatório. Em dúvida, o modelo produz gap, não claim.
 *
 * Duas coisas que este schema deliberadamente NÃO faz:
 *
 *  1. Não confia na alegação do modelo de que a `quote` é literal. O tamanho
 *     mínimo é a única defesa possível no schema; a verificação real é
 *     `verifyQuote()` em @merge/locator, por correspondência de string contra
 *     o trecho indexado, antes de qualquer persistência (I1).
 *  2. Não deixa `ancoragem` ser opcional ou vazia. `.min(1)` é imposto no
 *     JSON Schema como `minItems`, então uma claim sem localizador é inválida
 *     no fio, não só no banco. Claim sem ancoragem válida vai para `gaps`.
 */

const ancoragem = z.strictObject({
  referencia_id: z.string().min(1).describe('O id da referência de onde o trecho foi tirado.'),
  pagina: z.int().min(1).describe('Página onde a citação aparece, 1-based.'),
  quote: z
    .string()
    .min(12)
    .max(2000)
    .describe(
      'Texto LITERAL presente no documento, copiado sem parafrasear, sem corrigir e sem elidir. ' +
        'Vai ser verificado por correspondência real contra o documento; paráfrase é rejeitada.',
    ),
});

const claim = z.strictObject({
  texto: z.string().min(1).max(1000).describe('A afirmação, autocontida.'),
  ancoragem: z.array(ancoragem).min(1).max(10),
  forca: forca.describe(
    'Força da evidência, 1..5, onde 1 é a MAIS forte (RCT head-to-head) e 5 a mais fraca (opinião/consenso).',
  ),
  requisito_atendido: z.string().min(1).describe('Qual requisito de evidência esta claim atende.'),
});

const gap = z.strictObject({
  requisito: z.string().min(1),
  motivo: z
    .enum(['sem_evidencia_no_acervo', 'evidencia_insuficiente'])
    .describe('Por que não foi possível produzir uma claim ancorada para este requisito.'),
});

export const claimExtractionOutputV1 = assertWireSchema(
  z.strictObject({
    claims: z.array(claim).max(60),
    gaps: z.array(gap).max(60),
  }),
  'ClaimExtractionOutputV1',
);

export type ClaimExtractionOutputV1 = z.infer<typeof claimExtractionOutputV1>;
export type ClaimPropostaV1 = z.infer<typeof claim>;
export type AncoragemPropostaV1 = z.infer<typeof ancoragem>;
export type GapV1 = z.infer<typeof gap>;
