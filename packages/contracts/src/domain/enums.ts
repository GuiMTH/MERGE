import { z } from 'zod';

/** Campo obrigatório em toda entidade (§5 do prompt master). */
export const escopo = z.enum(['agencia', 'cliente', 'publico']);
export type Escopo = z.infer<typeof escopo>;

export const claimStatus = z.enum(['proposta', 'validada', 'aprovada', 'reprovada', 'superada']);
export type ClaimStatus = z.infer<typeof claimStatus>;

/**
 * `forca` 1..5, e a escala é INVERTIDA em relação à intuição:
 * o §5 do prompt master fixa `1 (RCT head-to-head) … 5 (opinião/consenso)`,
 * logo **1 é a evidência mais forte**.
 *
 * Os degraus 2, 3 e 4 são critério científico e ainda não foram definidos pelo
 * time científico. A rubrica vive como dado versionado (`forca_rubric_version`,
 * propriedade do diretor médico), nunca como constante no código — senão
 * mudá-la exigiria deploy e a mudança não ficaria registrada.
 */
export const forca = z.int().min(1).max(5);
export type Forca = z.infer<typeof forca>;

export const coberturaLabel = z.enum(['coberta', 'parcial', 'off_label', 'nao_avaliada']);
export type CoberturaLabel = z.infer<typeof coberturaLabel>;

/**
 * Cobertura que obriga revisão humana (§6.3).
 *
 * Isto é uma função, não um campo que o modelo preenche. O modelo é
 * consultado sobre a cobertura; quem decide que `off_label` e `parcial`
 * exigem olho humano é o produto. A mesma regra é imposta por CHECK no banco.
 */
export function exigeRevisaoHumana(cobertura: CoberturaLabel): boolean {
  return cobertura === 'off_label' || cobertura === 'parcial';
}

export const criticidade = z.enum(['alta', 'media', 'baixa']);
export type Criticidade = z.infer<typeof criticidade>;

export const origemBriefing = z.enum(['cliente', 'agencia']);
export type OrigemBriefing = z.infer<typeof origemBriefing>;

export const motivoGap = z.enum([
  'sem_evidencia_no_acervo',
  'evidencia_insuficiente',
  'ancoragem_nao_verificada',
]);
export type MotivoGap = z.infer<typeof motivoGap>;
