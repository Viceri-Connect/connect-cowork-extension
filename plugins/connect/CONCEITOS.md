# Connect — Conceitos: instância, matriz, sub-vault, vault pessoal

> Taxonomia canônica do produto. O que é cada coisa, o que **não** é, e por que a
> distinção importa. Mecanismo (corte `_`/conteúdo, D96) — vale para qualquer empresa
> que instale o Connect.
>
> Versão 0.1.0 · 2026-08-17 · Impulsa / Viceri

---

## 1. Instância (uma "mente" Connect)

Uma **instância** do Connect é **uma mente**: uma espinha dorsal cognitiva com **uma**
estrutura organizacional própria. Tem exatamente:

- **1 matriz** (a espinha — §2), e
- **N sub-vaults** (os contextos-filhos que a matriz define — §3).

**"Mais de uma matriz" = mais de uma instância**, nunca duas matrizes na mesma sessão.
Se o operador atua em outra espinha dorsal — outra estrutura organizacional, outro
conjunto de regras — isso é **outra instância** (outra mente), selecionada por sessão.
Multi-instância é "trocar a mente ativa", não "montar várias matrizes juntas".

> Estado do MVP: **uma instância, uma matriz**. Multi-instância é evolução pós-MVP.

## 2. Matriz — a espinha dorsal (exatamente 1 por instância)

A **matriz** consolida a espinha dorsal da mente. É onde a **fábrica do Connect** trabalha,
conectando sub-contextos, e é ela que **define o que é filho**. Contém:

- **Mecanismo** (pastas `_…`): a forma fixa entregue pelo produto.
- **Manifestos** (§ contrato-manifesto): as declarações leves de quais entidades existem,
  quem governa e onde está a fonte de cada uma.

A matriz **não hospeda o acervo pesado** dos filhos — só declara que existem e os governa
(o acervo desce sob demanda, D103). Uma matriz governa, por exemplo, uma empresa e seus
**sub-clientes** e **sub-processos**.

## 3. Sub-vault — um contexto-filho que a matriz define (N por instância)

Um **sub-vault** é um contexto que a matriz declara e conecta: cliente, tribo, sub-processo,
controle pessoal — qualquer tipo (D101). Tem manifesto na matriz + acervo na própria fonte.

> **Um vault de cliente é um sub-vault** (sub-cliente) governado pela matriz — **NÃO é uma
> matriz Connect.** Um vault de cliente ser rico e completo (ter seu próprio `_cerebro`,
> produtos, projetos) **não** o torna uma matriz: matriz é papel de *espinha de uma mente*,
> sub-vault é papel de *filho definido por uma matriz*. O mesmo vault pode ser sub-vault de
> uma instância sem nunca ser matriz de nenhuma.

## 4. Vault pessoal — **opcional** (enriquecimento, não requisito)

O que o Connect precisa para o **dois-cérebros funcionar** — protocolo, mecanismo de
carregamento em camadas/lazy, e o **perfil mínimo do operador** (Camada 0) — é **provido pela
própria extensão**, não por um vault Obsidian pessoal. Consequências:

- **O vault pessoal deixou de ser obrigatório.** A espinha vem de `config/protocolo-mecanismo.md`
  (injetada pelo hook, D104); o **perfil do operador é gerido pelo Connect** e vive no
  **CONNECT_HOME** (§5).
- **Coexistência.** Se o operador mantém o próprio vault Obsidian com protocolos próprios
  (`CLAUDE.md` etc.), os dois **convivem**: o Connect não força seu protocolo no vault do
  usuário nem depende de ler o `CLAUDE.md` dele. Um vault pessoal, quando presente, entra só
  como **enriquecimento** (montado como `./pessoal`), nunca como condição de funcionamento.

## 5. CONNECT_HOME — o estado gerido pelo Connect (não é conhecimento)

Pasta de **estado/runtime**, deliberadamente **fora do OneDrive** (junctions e scaffolds não
podem sincronizar). Guarda três coisas, todas geridas pela extensão:

- `connect.config.json` — a config **da máquina** (qual é a matriz; vault pessoal opcional).
- `operador/` — o **perfil do operador** gerido pelo Connect (`_cerebro/meu-config.md` +
  delta opcional). É o que torna o vault pessoal dispensável.
- `sessions/{id}/` — os scaffolds efêmeros de sessão (onde moram as junctions `./matriz`,
  sub-vaults resolvidos, e `./pessoal` quando houver).

Default no Windows: `%LOCALAPPDATA%\Connect`, criado automaticamente. O operador **não
precisa administrá-lo** — a única escolha que lhe importa é qual é a matriz da instância.

---

## Resumo — o que é o quê

| Conceito | Cardinalidade | Papel | Exemplo |
|---|---|---|---|
| **Instância** | — | uma mente / espinha dorsal | "Connect da Empresa X" |
| **Matriz** | 1 por instância | governa; define o que é filho | matriz da Empresa X |
| **Sub-vault** | N por instância | contexto-filho definido pela matriz | tribo-a, cliente-a |
| **Vault pessoal** | 0 ou 1, **opcional** | enriquecimento do operador | vault Obsidian próprio |
| **CONNECT_HOME** | 1 por máquina | estado do Connect (config + perfil + sessões) | `%LOCALAPPDATA%\Connect` |

> Fontes de decisão: D96 (corte `_`/conteúdo), D97/D102 (manifesto+acervo, grafo), D101
> (sub-vault tipado), D104 (espinha é mecanismo injetado), D105 (perfil do operador gerido
> pela fábrica). Decisão desta sessão (2026-08-17): perfil do operador no CONNECT_HOME; vault
> pessoal opcional; matriz↔instância 1:1 (um vault de cliente é sub-vault, não matriz).
