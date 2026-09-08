# packages/locator

Anel 0. Puro, síncrono, sem I/O, sem relógio, sem config. **É o ponto de
imposição de I1.**

## Três regras não-óbvias

**`POLITICA_VERIFICACAO` é congelado de propósito.** Não é arquivo de config e
não é variável de ambiente. I1 diz "sem exceção, sem flag de bypass, sem modo
de desenvolvimento que relaxe isso", e um threshold ajustável por ambiente é
flag de bypass com outro nome. Mudar um número exige código, PR e uma rodada do
harness. `versao` é persistida em cada âncora.

**Normalização preserva offsets.** Cada passo mantém `paraCru: Int32Array`.
Normalizar destrutivamente é fácil e inútil: dá para verificar que a citação
existe, mas não ONDE, e o dossiê inteiro repousa em destacar o trecho exato.

**Numerais nunca são normalizados.** `p<0,05` da bula não vira `p<0.05`.
Separador decimal é diferença semântica real em pt-BR, e dobrar número em
silêncio é como uma claim acaba ancorada no tamanho de efeito errado.

## O que `verifyQuote` NÃO responde

Ela responde *"este texto está no documento, e onde?"*. Ela **não** responde
*"esta claim é fiel ao contexto da fonte?"*.

A consequência tem teste que a documenta (`LIMITE CONHECIDO` em
`test/verify.test.ts`): soltar uma negação da **borda** de uma citação produz
um trecho literalmente presente no documento, e portanto verifica. `"Nao houve
diferença"` citado como `"houve diferença"` passa, corretamente — nenhuma
verificação de string pode distinguir isso de uma citação honesta que começa
uma palavra depois.

Fidelidade semântica é checagem humana, e é para isso que a âncora leva o
revisor à página exata. O que este módulo garante é que **existe** uma página
exata para ir.

As guardas do tier fuzzy pegam deriva de negação no **meio** da citação, onde a
janela de alinhamento é obrigada a conter o termo.

## Por que a guarda de elisão não usa traceback de matriz de edição

Foi a primeira tentativa, e não funciona. O alinhamento de custo mínimo **não é
único**: apagar `" de piora da"` de uma citação de 200 caracteres dá distância
12, mas o traceback com "diagonal primeiro" relata uma corrida de 7, porque
substituições de mesmo custo quebram a corrida. Medir "a maior deleção
contígua" exige escolher entre alinhamentos empatados, e essa escolha é
indefensável num ponto de imposição de invariante.

`regiaoDivergente()` usa prefixo e sufixo comuns, que são únicos e não têm
desempate. Além de determinístico, pega um caso que o traceback e um teste de
comprimento perderiam: cláusula trocada por outra do mesmo tamanho.

## O gate

`test/property.test.ts` é a especificação executável. **Zero falso-aceite é
barra dura**; falso-rejeite vai para backlog e não bloqueia. Se você mudar
tiers, normalização ou política, é essa suíte que decide.
