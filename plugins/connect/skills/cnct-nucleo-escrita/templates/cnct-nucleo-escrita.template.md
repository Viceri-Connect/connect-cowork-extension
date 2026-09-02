# cnct-nucleo-escrita — Contrato de escrita (mecanismo, índice de vaults)

> Entregue e mantido pelo **produto** (mecanismo, não conteúdo da empresa — corte por prefixo `_`: pasta
> com `_` é mecanismo, pasta sem `_` é conteúdo da empresa; ver `GLOSSARIO.md#corte-mecanismo-conteudo`).
> Lido pelo executor `cnct-nucleo-escrita` (plugin `connect`) em runtime, **antes** de qualquer escrita
> em qualquer vault desta instância. O executor não sabe onde nada mora — **este arquivo é a única
> fonte que diz onde**. Editar aqui = comportamento muda na próxima sessão, sem reinstalar o plugin.
>
> **Stub gerado automaticamente** (matriz sem este arquivo ainda) — personalize o "Índice de vaults"
> abaixo assim que o primeiro sub-vault desta instância ganhar manifesto no grafo.

→ `[[modelo-roteamento]]` (quando esta matriz tiver um) · `[[vault-config]]`

---

## Convenção de localização (vale para todo vault desta instância)

A taxonomia de conteúdo de qualquer vault (a matriz atuando como vault de conteúdo próprio, ou
um sub-vault) vive em `_inteligencia/skills/vault-write/vault-write.md`, **relativo à raiz
daquele vault**. É a única convenção que o executor precisa seguir — ele nunca deduz isso
sozinho, segue o que está declarado aqui.

## Índice de vaults desta instância (deriva do grafo em `vault-config.md` § "Grafo de entidades")

| Vault | Alias na sessão | Taxonomia (vault-write.md) |
|---|---|---|
| Matriz (conteúdo próprio) | `./matriz` | `./matriz/_inteligencia/skills/vault-write/vault-write.md` |
| _(cada sub-vault novo entra aqui quando ganhar manifesto no grafo)_ | | |

> Este índice é espelho de leitura do grafo (nunca fonte paralela — `GLOSSARIO.md#indice-e-espelho`): todo vault novo que
> ganhar manifesto em `vault-config.md` § "Grafo de entidades" entra aqui como linha nova, mesma
> convenção de localização. Se um vault um dia precisar de convenção diferente, a exceção é
> declarada nesta tabela — o executor segue a exceção, nunca o padrão, quando ela existir.

## Se a taxonomia não existir no vault alvo

Reportar a lacuna ao operador — nunca herdar taxonomia de outro vault, nunca inventar. Ausência
de taxonomia é **gatilho de elicitação** (o vault nasce e ainda não tem taxonomia própria — ver
`GLOSSARIO.md#gatilho-de-nascimento`), não erro silencioso nem motivo para adiar a escrita
usando uma regra emprestada.

---

## Regras universais de escrita (valem em qualquer vault, não repetir por vault)

- Todo arquivo escrito ou atualizado ganha `[[wikilinks]]` para os arquivos mencionados; nota
  nova é linkada de pelo menos uma existente (nunca nota solta).
- Ponteiro é **tipado** (`GLOSSARIO.md#ponteiro-tipado`): `[[wikilink]]` só para nota do mesmo vault;
  artefato externo → path nomeando a natureza; fato derivável (path de mount, vault ativo) →
  resolver, nunca apontar.
- **Escrita é in loco.** O arquivo é editado onde já vive (alias montado na sessão) — a exceção é
  quando o conteúdo nasce nesta sessão como entregável (docx/xlsx/pptx/skill/pdf): aí o caminho é
  gerar → entregar → depositar no destino, e este contrato não se aplica (é output, não vault).
- **Teste de admissão de histórico:** um arquivo tem UM tempo verbal (presente ou passado, nunca
  os dois); quem escreve histórico declara quem resgata e quando — sem isso não é histórico, é
  resíduo, não escrever.
- **Casa da ADR/RNF:** arquivo próprio, com identidade e ciclo de vida — **nunca** em prosa dentro
  de doc de visão. Índice de cada pasta tem nome semântico (nunca `README.md`), aponta e não
  transcreve. **Onde exatamente é a casa, quem diz é a carta de processo do coletivo**
  (`_cerebro/processos/{processo}.md`), não este contrato: topologia é declaração de quem executa o
  processo, e o produto hospeda a declaração em vez de prescrevê-la.
  > ⚠️ **Corrigido em 2026-09-02.** Este template declarava `projetos/{projeto}/adr/` literalmente, e
  > o defeito não era o caminho estar velho — era o **produto prescrevendo topologia**, contra
  > `vault-declara-produto-nao-prescreve`. Toda instância materializada a partir daqui nascia com uma
  > forma que o coletivo não decidiu, e no dia em que a topologia canônica mudou, a prescrição passou
  > a apontar para fora dela.
- **Decisão sem decisão não é ADR** — questão aberta, dependente de dado externo/produção, vive no
  arquivo de decisões abertas do projeto, com dono e o que a desbloqueia.
- **Despromoção antes de acrescentar:** para todo destino que a sessão vai tocar, classificar
  *substitui* (estado, próximo passo, cabeçalho) × *acumula* (decisões, pendências, capturas,
  histórico); nunca podar sem confirmar duplicação na fonte primeiro.

## O que fica específico de cada vault (vive no `vault-write.md` daquele vault, não aqui)

Panorama de camadas próprio · decisão de pasta (nomes de pasta daquele vault) · testes de
classificação · checklist adicional (ex.: isolamento de dado confidencial de cliente) · regras que
só fazem sentido naquele escopo.

## Fora de escopo deste contrato

Estado do operador gerido pelo Connect (`./operador/`, ex.: `TASKS.md`, perfil) não é conteúdo de
vault — não passa por este contrato. Ver `cnct-nucleo-encerramento`.

<!-- fim: cnct-nucleo-escrita.md · gerado por cnct-nucleo-escrita (stub) · {{DATA_INSTALACAO}} -->
