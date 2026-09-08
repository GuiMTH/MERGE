import { z } from 'zod';
import { assertWireSchema } from './wire-schema.js';
import { criticidade } from '../domain/enums.js';

/**
 * Contrato 6.1 — Enriquecimento de briefing (módulo 1b).
 *
 * Roda no cockpit hoje; na Fase 2 o resultado é lido pelo cliente. É o prompt
 * mais sensível do sistema por isso: as perguntas em `lacunas` vão ser lidas
 * por quem paga a conta.
 *
 * `score_completude` é informação, nunca gate (I8). O tipo não tem como
 * expressar "bloqueia o envio", e o portal não consulta este contrato para
 * decidir se aceita um briefing.
 */

const lacuna = z.strictObject({
  campo: z.string().min(1).max(120).describe('O campo do briefing que está vago ou ausente.'),
  pergunta: z
    .string()
    .min(1)
    .max(400)
    .describe(
      'A pergunta a fazer, como um planner sênior perguntaria: direta, sem jargão, ' +
        'sem soar como auditoria. Vai ser lida pelo cliente.',
    ),
  criticidade: criticidade.describe('Quanto a ausência deste campo compromete o trabalho.'),
});

const requisitoEvidencia = z.strictObject({
  mensagem_pretendida: z
    .string()
    .min(1)
    .max(600)
    .describe('A afirmação que a peça pretende fazer, nas palavras do briefing.'),
  tipo_evidencia_necessaria: z
    .string()
    .min(1)
    .max(400)
    .describe('Que tipo de evidência sustentaria essa afirmação (desenho de estudo, desfecho, população).'),
  obrigatorio: z.boolean().describe('Se a peça não funciona sem esta afirmação.'),
});

export const briefingEnrichmentOutputV1 = assertWireSchema(
  z.strictObject({
    score_completude: z
      .number()
      .min(0)
      .max(1)
      .describe('0..1. Informação para o time, nunca critério de bloqueio de envio.'),
    lacunas: z.array(lacuna).max(30),
    /** O insumo do gap report. É o que liga o CORE ao flow (§6.1). */
    requisitos_evidencia: z.array(requisitoEvidencia).max(50),
  }),
  'BriefingEnrichmentOutputV1',
);

export type BriefingEnrichmentOutputV1 = z.infer<typeof briefingEnrichmentOutputV1>;
export type LacunaV1 = z.infer<typeof lacuna>;
export type RequisitoEvidenciaV1 = z.infer<typeof requisitoEvidencia>;
