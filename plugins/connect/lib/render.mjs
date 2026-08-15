// connect/lib/render.mjs
// Renderiza o relatorio de iniciarSessao() como um bloco markdown de contexto,
// injetado na sessao (via stdout do hook) ou devolvido pela tool MCP.
// E aqui que os atalhos e a identidade "passam a existir" para o agente.

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

  // Camada 1 da matriz
  if (report.l1) {
    const iv = report.l1.identidadeVault || {};
    L.push('### Matriz — camada 1 (verdades globais)');
    if (iv.empresa || iv.cliente || iv.contexto) {
      L.push(`- Coletivo: ${iv.empresa || '—'}${iv.cliente ? ' · ' + iv.cliente : ''}${iv.contexto ? ' · ' + iv.contexto : ''}`);
    }
    if (iv['vault-focal-nome']) L.push(`- Ponto focal: ${iv['vault-focal-nome']}`);
    if (report.l1.ponteiros && report.l1.ponteiros.length) {
      L.push('- Ler sob demanda (lazy):');
      for (const p of report.l1.ponteiros) L.push(`  - \`${p.caminho}\` — ${p.nota}`);
    }
    if (report.l1.projetos && report.l1.projetos.length) {
      L.push(`- Projetos na matriz: ${report.l1.projetos.map((p) => `\`${p.caminho}\``).join(', ')}`);
    }
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
  L.push('3. Quando uma skill declarar que precisa de um sub-vault (conceito), acione o Connect para entrega-lo num novo atalho no workspace (mecanismo `resolver`, em construcao).');

  // Avisos
  if (report.avisos && report.avisos.length) {
    L.push('');
    L.push('### Avisos');
    for (const a of report.avisos) L.push(`- ${a}`);
  }

  return L.join('\n') + '\n';
}
