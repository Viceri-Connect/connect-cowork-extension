// connect/lib/render.mjs
// Renderiza o relatorio de iniciarSessao() como um bloco markdown de contexto,
// injetado na sessao (via stdout do hook) ou devolvido pela tool MCP.
// E aqui que os atalhos e a identidade "passam a existir" para o agente.

// ---------------------------------------------------------------------------
// blocoCarta — a carta de navegacao de UM vault, pronta para injecao.
// Injetada VERBATIM quando presente (o vault fala por si); quando ausente, o
// bloco diz a lacuna e o proximo passo — nunca substitui a carta por ponteiros
// inventados pelo mecanismo (D98).
// ---------------------------------------------------------------------------
export function blocoCarta(carta, rotulo = 'vault') {
  const L = [];
  if (!carta) return L;

  if (carta.presente) {
    const proc = carta.origem === 'legado' ? ' (hot cache legado — migracao pendente)' : '';
    L.push(`> Camada 1 declarada por \`${carta.caminhoRelativo}\`${proc} — injetada verbatim:`);
    L.push('');
    L.push(carta.inline);
    if (carta.validacao && !carta.validacao.ok) {
      L.push('');
      L.push(`> ⚠️ Carta incompleta (${rotulo}) — secoes obrigatorias ausentes: ${carta.validacao.faltando.join(', ')}. Ofereca completar via \`cnct-fabrica-navegacao\`.`);
    }
  } else {
    L.push(`> ⚠️ **Lacuna de navegacao (${rotulo}):** este vault nao declara camada 1 (\`_cerebro/camada-1.md\`).`);
    L.push('> O mecanismo NAO inventa ponteiros (D98). Navegar aqui sem carta significa varredura —');
    L.push('> que e ultimo recurso e deixa marca. Ofereca ao operador a `cnct-fabrica-navegacao`');
    L.push('> para materializar a carta (D97: ausencia e gatilho de nascimento, nao erro).');
  }
  return L;
}

// ---------------------------------------------------------------------------
// renderResolucao — bloco de contexto de UM sub-vault recem-resolvido, para a
// tool `resolver` devolver junto do JSON. Sem isso, a camada 1 do sub-vault
// (a curadoria de navegacao daquele acervo) nunca entra no contexto: o agente
// ganharia um mount e nenhuma orientacao — o defeito que o contrato fecha.
// ---------------------------------------------------------------------------
export function renderResolucao(res) {
  if (!res || res.status !== 'resolvido') return '';
  const L = [];
  L.push(`## Connect — sub-vault "${res.conceito}" montado`);
  L.push('');
  L.push(`- Alias: \`${res.caminhoRelativo}\` (${res.tipo || '—'}${res.papel ? '/' + res.papel : ''})`);
  if (res.entradaResolvida?.status === 'resolvida') {
    L.push(`- Ponto de pouso: \`${res.entradaResolvida.caminhoRelativo}\` — abrir esta nota ANTES de qualquer outra coisa neste acervo.`);
  } else if (res.entrada) {
    L.push(`- Ponto de pouso declarado (\`${res.entrada}\`) nao resolvido: ${res.entradaResolvida?.status || 'desconhecido'} — nao tatear o diretorio; avisar o operador.`);
  }
  L.push('');
  L.push(...blocoCarta(res.l1?.carta, res.conceito));
  if (res.avisos?.length) {
    L.push('');
    L.push('### Avisos');
    for (const a of res.avisos) L.push(`- ${a}`);
  }
  return L.join('\n') + '\n';
}

export function renderContexto(report) {
  const L = [];
  L.push('## Connect — sessao iniciada');
  L.push('');
  L.push(`Workspace da sessao: \`${report.workspace}\` (fora do OneDrive).`);
  L.push('Todo conhecimento e referenciado por caminho relativo ao workspace — nunca por caminho absoluto de maquina.');
  L.push('');

  // Identidade
  const id = report.identidade;
  if (id && !id._ausente && (id.nome || id.email)) {
    L.push('### Operador');
    L.push(`- Nome: ${id.nome || '—'}`);
    if (id.email) L.push(`- E-mail: ${id.email}`);
    if (id.papeis && id.papeis.length) L.push(`- Papeis: ${id.papeis.join(', ')}`);
    L.push('');
  }

  // Protocolo do mecanismo (D104) — espinha dorsal entregue pelo produto,
  // injetada verbatim para garantir execucao sem depender de arquivo do operador.
  if (report.protocoloMecanismo) {
    L.push('### Protocolo do mecanismo (garantido pelo Connect)');
    L.push('');
    L.push(report.protocoloMecanismo.trim());
    L.push('');
  }

  // Atalhos montados
  const ok = (report.mounts || []).filter((m) => m.status === 'mounted' || m.status === 'exists');
  if (ok.length) {
    L.push('### Atalhos montados');
    for (const m of ok) L.push(`- \`./${m.alias}\` -> \`${m.source}\` (${m.kind})`);
    L.push('');
  }

  // Camada 1 da matriz — identidade do vault + CARTA DE NAVEGACAO injetada
  // verbatim (contrato-navegacao.md). A carta e declarada pelo vault; o produto
  // nao prescreve ponteiro nenhum (D98). Ausencia = lacuna anunciada (D97).
  if (report.l1) {
    const iv = report.l1.identidadeVault || {};
    L.push('### Matriz — camada 1 (declarada pelo vault)');
    if (iv.empresa || iv.cliente || iv.contexto) {
      L.push(`- Coletivo: ${iv.empresa || '—'}${iv.cliente ? ' · ' + iv.cliente : ''}${iv.contexto ? ' · ' + iv.contexto : ''}`);
    }
    if (iv['vault-focal-nome']) L.push(`- Ponto focal: ${iv['vault-focal-nome']}`);
    L.push('');
    L.push(...blocoCarta(report.l1.carta, 'matriz'));
    L.push('');
  }

  // Cerebro pessoal — Camada 0 (D104): hot cache pessoal (delta) + ponteiros.
  const lp = report.l1Pessoal;
  if (lp && (lp.hotCacheInline || (lp.ponteiros && lp.ponteiros.length))) {
    L.push('### Cerebro pessoal — camada 0');
    if (lp.hotCacheInline) {
      L.push('');
      L.push(lp.hotCacheInline.trim());
    }
    if (lp.ponteiros && lp.ponteiros.length) {
      L.push('');
      L.push('- Ler sob demanda (lazy):');
      for (const p of lp.ponteiros) L.push(`  - \`${p.caminho}\` — ${p.nota}`);
    }
    L.push('');
  }

  // Protocolo para o agente (como novos atalhos aparecem)
  L.push('### Protocolo desta sessao');
  L.push('1. Referencie conhecimento sempre por caminho relativo ao workspace (ex.: `./matriz/_cerebro/...`).');
  L.push('2. Mount da junction da o caminho estavel; ele NAO concede acesso de leitura — se o Cowork pedir, conceda acesso a origem correspondente.');
  L.push('3. Ao nomear um conceito (projeto, cliente, area, tribo), acione `resolver` — ele deriva o registro varrendo os manifestos (frontmatter `tipo` + `externo`; nenhum path no vault, D35 — contrato em `contrato-manifesto.md`), casa por conceito/gatilho e monta manifesto + acervo so no toque.');
  L.push('4. Dentro de qualquer vault, navegue pela **ordem de resolucao canonica** (secao no protocolo acima): carta de navegacao -> ponto de pouso -> ponteiro declarado. Varredura e ultimo recurso e deixa marca.');

  // Avisos
  if (report.avisos && report.avisos.length) {
    L.push('');
    L.push('### Avisos');
    for (const a of report.avisos) L.push(`- ${a}`);
  }

  return L.join('\n') + '\n';
}
