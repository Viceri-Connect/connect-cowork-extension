// connect/lib/sincronizar.mjs
// sincronizar_subvault e catalogo_sync — a ponta executavel da ADR-23.
//
// Ordem (ADR-23 item 4), e o porque de cada passo:
//   1. casa o conceito no registro derivado — a mesma regua do `resolver`
//      (ambiguidade recusada, desempate por parametro);
//   2. sem `origem` declarada -> `sem-origem`: o fluxo antigo (perguntar o caminho)
//      continua valendo, nada quebra;
//   3. CATALOGO PRIMEIRO: se o cliente ja sincroniza a pasta, so registra. Disparar
//      o link de novo abriria o Explorer na cara do operador sem motivo;
//   4. dispara o `odopen://` e espera a pasta aparecer NO CATALOGO. Nunca registra
//      caminho que o cliente nao listou — prazo esgotado devolve `aguardando` com
//      a governanca, porque lento e negado sao indistinguiveis daqui;
//   5. fixa no dispositivo so `classe: vault` (o agente le o conteudo); `diretorio`
//      fica sob demanda;
//   6. grava o caminho com registrarSubVaultLocal, escopado pelo coletivo.
//
// Nunca lanca: devolve sempre { status, ... } para a skill decidir.

import fs from 'node:fs';
import { resolveConfig, registrarSubVaultLocal } from './session.mjs';
import { lerRegistro, casarMuitos, classeDeclarada } from './resolver.mjs';
import { montarLinkSync, localizarNoCatalogo, origemEmYaml, host as hostPadrao, PLATAFORMAS_SYNC } from './onedrive.mjs';
import { gravarDiagnostico } from './diagnostico.mjs';

const ESPERA_PADRAO_S = 90;
const INTERVALO_MS = 3000;

function casarEntidade({ conceito, coletivo, override }) {
  const cfg = resolveConfig(override);
  const registro = lerRegistro([cfg.cerebroPessoal, cfg.vaultMatriz].filter(Boolean));
  if (!conceito) return { erro: { status: 'erro', motivo: 'conceito ausente' } };
  const m = casarMuitos(registro, conceito, coletivo);
  if (m.status === 'ambigua') {
    const candidatos = m.candidatos.map((e) => e.conceito);
    return { erro: { status: 'ambigua', conceito, candidatos, avisos: [`"${conceito}" casa com ${candidatos.join(', ')} — pergunte ao operador qual, ou repita com o conceito exato`] } };
  }
  if (m.status !== 'unico') {
    return { erro: { status: 'nao-encontrado', conceito, avisos: ['so entidade com casa fora da matriz (`externo: true`) e sincronizavel'] } };
  }
  return { entry: m.entrada, cfg, registro };
}

// ---------------------------------------------------------------------------
// sincronizarSubvault — async porque espera o cliente OneDrive.
// ---------------------------------------------------------------------------
export async function sincronizarSubvault({
  conceito,
  coletivo = null,
  escopo = null,
  email = null,
  aguardarSegundos = ESPERA_PADRAO_S,
  host = hostPadrao,
  ...override
} = {}) {
  const { erro, entry } = casarEntidade({ conceito, coletivo, override });
  if (erro) return erro;

  const base = {
    conceito: entry.conceito,
    classe: classeDeclarada(entry.classe),
    governanca: entry.governanca || null,
  };

  if (!entry.criado) {
    return { ...base, status: 'pendente-criacao', avisos: ['o acervo ainda nao foi materializado — nao ha o que sincronizar'] };
  }
  if (entry.origemErros?.length && !entry.origem?.length) {
    return { ...base, status: 'origem-invalida', erros: entry.origemErros, avisos: ['o bloco `origem` do manifesto esta malformado — corrigir na matriz (quem governa a entidade)'] };
  }
  const origem = (entry.origem || [])[0];
  if (!origem) {
    return { ...base, status: 'sem-origem', avisos: [`o manifesto de "${entry.conceito}" nao declara \`origem\` — pergunte o caminho ao operador e grave com registrar_subvault_local, como antes`] };
  }

  const coletivoChave = coletivo || entry.escopo || null;

  if (!PLATAFORMAS_SYNC.includes(host.plataforma)) {
    return { ...base, status: 'plataforma-nao-suportada', link: montarLinkSync(origem, { email }), avisos: [`sync automatico so no Windows e no macOS (esta maquina: ${host.plataforma}). O operador pode abrir o \`link\` (ou sincronizar pelo SharePoint) e informar o caminho`] };
  }
  // macOS (P175, 0.37.0): caminho NAO medido. Tudo o que falhar aqui degrada para o
  // fluxo antigo (perguntar o caminho e registrar_subvault_local), que funciona.
  const avisosPlataforma = host.plataforma === 'darwin'
    ? ['macOS: sync automatico em validacao (P175) — se algo falhar, chame catalogo_sync e devolva o `diagnostico` ao time do Connect; o caminho manual (registrar_subvault_local) segue valendo']
    : [];

  let link = null;
  const home = resolveConfig(override).home;
  const concluir = (achado, ja, cat) => {
    if (!achado.caminho) {
      // O cliente sincroniza a pasta, mas o caminho que ele gravou nao virou pasta de
      // disco (P175: token `$Group.Container$` no Mac). Esperar nao resolve — declara,
      // grava o diagnostico e devolve o fluxo manual.
      const diagnosticoArquivo = gravarDiagnostico({ home, nome: 'onedrive-sincronizar', dados: { conceito: entry.conceito, status: 'caminho-nao-traduzido', bruto: achado.entrada?.mountPointBruto || null, motivo: achado.entrada?.mountPointMotivo || null, diagnostico: cat?.diagnostico || null } });
      return {
        ...base,
        status: 'caminho-nao-traduzido',
        link,
        motivo: achado.entrada?.mountPointMotivo || null,
        diagnosticoArquivo,
        avisos: [
          'o OneDrive ja sincroniza esta pasta, mas o Connect nao conseguiu traduzir o caminho que o cliente gravou para uma pasta de disco',
          'siga pelo fluxo manual: pergunte ao operador onde a pasta aparece (no Mac, Finder > Locais > OneDrive) e grave com registrar_subvault_local',
          ...(diagnosticoArquivo ? [`peca ao operador para enviar ao time do Connect o arquivo ${diagnosticoArquivo}`] : []),
        ],
      };
    }
    if (!fs.existsSync(achado.caminho)) {
      return { ...base, status: 'aguardando', link, avisos: [`o catalogo lista a pasta em "${achado.caminho}", mas ela ainda nao existe no disco — repita em instantes`] };
    }
    const fixacao = base.classe === 'vault'
      ? host.fixar(achado.caminho)
      : { status: 'nao-aplicavel', motivo: 'classe diretorio fica sob demanda (ADR-23 item 3)' };
    const reg = registrarSubVaultLocal({ conceito: entry.conceito, caminho: achado.caminho, coletivo: coletivoChave, escopo, home: override.home });
    return {
      ...base,
      status: reg.status === 'gravado' ? 'sincronizado' : 'erro-registro',
      jaSincronizado: ja,
      caminho: achado.caminho,
      via: achado.via,
      fixacao,
      registro: reg,
      avisos: [
        ...avisosPlataforma,
        ...(fixacao.status === 'erro' ? [`a pasta sincroniza, mas fixar no dispositivo falhou (${fixacao.motivo}) — o operador pode marcar "Manter sempre neste dispositivo" pelo Explorer`] : []),
        ...(fixacao.status === 'nao-suportado' ? [`a pasta sincroniza, mas nao foi fixada no dispositivo (${fixacao.motivo}). REPASSE ao operador: ${fixacao.instrucao || 'marque "Manter sempre neste dispositivo" na pasta'}`] : []),
        `proximo passo: resolver({ conceito: "${entry.conceito}" }) para montar`,
      ],
    };
  };

  // 3. catalogo primeiro
  const antes = host.lerCatalogo();
  const ja = localizarNoCatalogo(antes.entradas || [], origem);
  if (ja) return concluir(ja, true, antes);

  // `userEmail` e obrigatorio: sem ele o cliente ignora o link em silencio.
  // Vem do parametro ou da conta Business logada; mais de uma conta sem parametro
  // e ambiguidade — pergunta, nunca escolhe.
  let emailFinal = email;
  if (!emailFinal) {
    const contas = host.emailsDasContas();
    if (!contas.length && host.plataforma === 'darwin') {
      // No macOS a leitura da conta e hipotese (P175): nao achar nao prova que nao ha
      // conta. Segue sem `userEmail` e declara — no Windows o mesmo caso e bloqueio.
      avisosPlataforma.push('macOS: e-mail da conta OneDrive nao localizado nas preferencias — link disparado sem `userEmail`. Se nada abrir, repita informando `email`');
    } else if (!contas.length) {
      return { ...base, status: 'onedrive-sem-conta', avisos: ['nenhuma conta OneDrive corporativa logada nesta maquina — o operador precisa entrar no OneDrive com a conta da empresa antes de sincronizar'] };
    } else {
      const unicos = [...new Set(contas.map((c) => c.email.toLowerCase()))];
      if (unicos.length > 1) {
        return { ...base, status: 'ambigua-conta', contas: unicos, avisos: [`ha ${unicos.length} contas OneDrive corporativas (${unicos.join(', ')}) — pergunte ao operador qual e repita com \`email\``] };
      }
      emailFinal = contas[0].email;
    }
  }
  link = montarLinkSync(origem, { email: emailFinal });

  // 4. dispara e espera
  try {
    host.abrirLink(link);
  } catch (e) {
    return { ...base, status: 'erro-disparo', link, avisos: [`nao foi possivel abrir o link de sync: ${e.message}`] };
  }
  const limite = Date.now() + Math.max(0, aguardarSegundos) * 1000;
  while (Date.now() < limite) {
    await host.esperar(INTERVALO_MS);
    const cat = host.lerCatalogo();
    const achado = localizarNoCatalogo(cat.entradas || [], origem);
    if (achado) return concluir(achado, false, cat);
  }

  const diagnosticoArquivo = host.plataforma === 'darwin'
    ? gravarDiagnostico({ home, nome: 'onedrive-sincronizar', dados: { conceito: entry.conceito, status: 'aguardando', linkDisparado: !!link, comEmail: !!emailFinal, diagnostico: host.lerCatalogo().diagnostico || null } })
    : null;
  return {
    ...base,
    status: 'aguardando',
    link,
    ...(diagnosticoArquivo ? { diagnosticoArquivo } : {}),
    avisos: [
      ...(diagnosticoArquivo ? [`se continuar aguardando, peca ao operador para enviar ao time do Connect o arquivo ${diagnosticoArquivo}`] : []),
      `o OneDrive nao listou a pasta em ${aguardarSegundos}s. Pode ser sync lento (chame de novo em instantes) ou falta de permissao no site — neste caso peca acesso a ${entry.governanca || 'quem governa a entidade'}`,
      'se o OneDrive abriu uma caixa de erro, ela diz qual dos dois e',
    ],
  };
}

// ---------------------------------------------------------------------------
// catalogoSync — o caminho inverso (ADR-23 item 5). Le o que o cliente OneDrive
// sincroniza e cruza com o registro POR ID. Serve para:
//   - registrar de uma vez o caminho de quem ja sincroniza tudo (`registrar: true`);
//   - o curador gerar o bloco `origem` de quem ainda nao tem.
// O cruzamento por nome NUNCA registra: so aparece como `candidatoPorNome`, para o
// curador confirmar.
// ---------------------------------------------------------------------------
export function catalogoSync({ registrar = false, host = hostPadrao, ...override } = {}) {
  const cfg = resolveConfig(override);
  const registro = lerRegistro([cfg.cerebroPessoal, cfg.vaultMatriz].filter(Boolean));
  const cat = host.lerCatalogo();
  const entradas = cat.entradas || [];

  const entidades = registro.map((e) => {
    const o = (e.origem || [])[0];
    const achado = o ? localizarNoCatalogo(entradas, o) : null;
    let registrado = null;
    if (registrar && achado?.caminho && fs.existsSync(achado.caminho)) {
      registrado = registrarSubVaultLocal({ conceito: e.conceito, caminho: achado.caminho, coletivo: e.escopo || null, home: override.home }).status;
    }
    return {
      conceito: e.conceito,
      classe: classeDeclarada(e.classe),
      temOrigem: !!o,
      origemErros: e.origemErros?.length ? e.origemErros : undefined,
      localNestaMaquina: achado ? achado.caminho : null,
      // Sincronizado, mas o caminho do catalogo nao virou pasta de disco (P175).
      ...(achado && !achado.caminho ? { sincronizadoSemCaminho: true, motivo: achado.entrada?.mountPointMotivo || null } : {}),
      registrado,
    };
  });

  const pastaIdsDeclarados = new Set(registro.flatMap((e) => (e.origem || []).map((o) => o.pastaId)));
  const naoDeclaradas = entradas
    .filter((x) => x.tipo === 'pasta' && x.pastaId && !pastaIdsDeclarados.has(x.pastaId))
    .map((x) => ({
      pasta: x.nome,
      local: x.mountPoint,
      ...(x.mountPointBruto ? { localBruto: x.mountPointBruto } : {}),
      ...(x.mountPointMotivo ? { localMotivo: x.mountPointMotivo } : {}),
      candidatoPorNome: registro.filter((e) => !(e.origem || []).length && x.nome && x.nome.toLowerCase().replace(/^_/, '').includes(e.conceito.split('-')[0])).map((e) => e.conceito),
      origemSugerida: (() => {
        // `pasta` so com o nome: o catalogo nao guarda o caminho na biblioteca, e
        // quem localiza e o `pasta-id` (medido em 06/10). `site-titulo` nomeia a
        // pasta local de quem sincronizar depois.
        const o = { provedor: 'sharepoint', site: x.webUrl, 'site-titulo': x.webTitle || undefined, pasta: x.nome, 'site-id': x.siteId, 'web-id': x.webId, 'lista-id': x.listaId, 'pasta-id': x.pastaId };
        return { ...o, yaml: origemEmYaml(o) };
      })(),
    }));

  // No Mac (em validacao) grava sempre; no Windows so quando algo nao esta ok.
  const semCaminho = entidades.filter((e) => e.sincronizadoSemCaminho).length + naoDeclaradas.filter((x) => x.localMotivo).length;
  const diagnosticoArquivo = (host.plataforma === 'darwin' || cat.status !== 'ok' || semCaminho)
    ? gravarDiagnostico({
      home: cfg.home,
      nome: 'onedrive-catalogo',
      dados: {
        status: cat.status,
        diagnostico: cat.diagnostico || null,
        avisos: cat.avisos || [],
        entidades: entidades.map(({ conceito, temOrigem, localNestaMaquina, sincronizadoSemCaminho, motivo }) => ({ conceito, temOrigem, local: localNestaMaquina, sincronizadoSemCaminho, motivo })),
        naoDeclaradas: naoDeclaradas.map(({ pasta, local, localBruto, localMotivo }) => ({ pasta, local, localBruto, localMotivo })),
      },
    })
    : null;

  return {
    status: cat.status,
    plataforma: host.plataforma,
    // Onde o leitor procurou o catalogo e o que achou em cada raiz (so nomes e
    // contagens, nunca conteudo). E o insumo para calibrar o macOS (P175).
    diagnostico: cat.diagnostico || null,
    ...(diagnosticoArquivo ? { diagnosticoArquivo } : {}),
    entidades,
    naoDeclaradas,
    avisos: [
      ...(semCaminho ? [`${semCaminho} pasta(s) sincronizada(s) sem caminho de disco traduzido — o fluxo manual (registrar_subvault_local) segue valendo`] : []),
      ...(diagnosticoArquivo && (host.plataforma === 'darwin' || semCaminho || cat.status !== 'ok') ? [`se algo aqui estiver errado, peca ao operador para enviar ao time do Connect o arquivo ${diagnosticoArquivo} — ele nao precisa rodar nada`] : []),
      ...(!PLATAFORMAS_SYNC.includes(host.plataforma) ? [`catalogo do OneDrive so e lido no Windows e no macOS (esta maquina: ${host.plataforma})`] : []),
      ...(host.plataforma === 'darwin' && cat.status !== 'ok' ? ['macOS: leitor do catalogo em validacao (P175) — devolva este `diagnostico` ao time do Connect'] : []),
      ...(cat.avisos || []),
      ...(naoDeclaradas.length ? ['`origemSugerida` esta completa para gravar: `pasta` vem so com o nome (o catalogo nao guarda o caminho na biblioteca) e isso basta, porque o OneDrive localiza pelo `pasta-id`. Antes de gravar, confirme com o operador QUAL entidade e — o casamento por nome e so candidato'] : []),
    ],
  };
}
