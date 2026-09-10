// FIXTURE — não é código de produção, e não deve ser "corrigido".
//
// Viola `frontend-no-server-secrets` de propósito, de dentro de um bundle de
// browser. `pnpm test:boundaries` exige que o dependency-cruiser o reprove.
//
// É a prova de I3: nenhuma chave de LLM no cliente. A regra existia desde o S0,
// mas até `apps/` existir ela passava por vacuidade — não havia arquivo de
// frontend algum para ela reprovar, e uma regra que nunca é exercitada não é
// distinguível de uma regra quebrada.
// @ts-nocheck
import Anthropic from '@anthropic-ai/sdk';
import { migrar } from '@merge/db';

export const cliente = new Anthropic({ apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY });
export const migracao = migrar;
