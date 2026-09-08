// FIXTURE — não é código de produção, e não deve ser "corrigido".
//
// Este arquivo existe para violar `ring0-no-vendor-sdk` de propósito, de dentro
// do anel 0. `pnpm test:boundaries` exige que o dependency-cruiser o reprove.
// Se você "arrumar" este import, a cerca de I4 deixa de ser verificada e o
// teste falha — que é exatamente o comportamento pretendido.
//
// Excluído do tsconfig, do eslint e da config de produção do dependency-cruiser.
// @ts-nocheck
import Anthropic from '@anthropic-ai/sdk';

export const cliente = new Anthropic();
