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
import { montarLinkSync, localizarNoCatalogo, origemEmYaml, host as hostPadrao } from './onedrive.mjs';

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

  if (host.plataforma !== 'win32') {
    return { ...base, status: 'plataforma-nao-suportada', link: montarLinkSync(origem, { email }), avisos: ['sync automatico so no Windows. O operador pode abrir o `link` (ou sincronizar pelo SharePoint) e informar o caminho'] };
  }

  let link = null;
  const concluir = (achado, ja) => {
    if (!achado.caminho || !fs.existsSync(achado.caminho)) {
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
        ...(fixacao.status === 'erro' ? [`a pasta sincroniza, mas fixar no dispositivo falhou (${fixacao.motivo}) — o operador pode marcar "Manter sempre neste dispositivo" pelo Explorer`] : []),
        `proximo passo: resolver({ conceito: "${entry.conceito}" }) para montar`,
      ],
    };
  };

  // 3. catalogo primeiro
  const antes = host.lerCatalogo();
  const ja = localizarNoCatalogo(antes.entradas || [], origem);
  if (ja) return concluir(ja, true);

  // `userEmail` e obrigatorio: sem ele o cliente ignora o link em silencio.
  // Vem do parametro ou da conta Business logada; mais de uma conta sem parametro
  // e ambiguidade — pergunta, nunca escolhe.
  let emailFinal = email;
  if (!emailFinal) {
    const contas = host.emailsDasContas();
    if (!contas.length) {
      return { ...base, status: 'onedrive-sem-conta', avisos: ['nenhuma conta OneDrive corporativa logada nesta maquina — o operador precisa entrar no OneDrive com a conta da empresa antes de sincronizar'] };
    }
    const unicos = [...new Set(contas.map((c) => c.email.toLowerCase()))];
    if (unicos.length > 1) {
      return { ...base, status: 'ambigua-conta', contas: unicos, avisos: [`ha ${unicos.length} contas OneDrive corporativas (${unicos.join(', ')}) — pergunte ao operador qual e repita com \`email\``] };
    }
    emailFinal = contas[0].email;
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
    if (achado) return concluir(achado, false);
  }

  return {
    ...base,
    status: 'aguardando',
    link,
    avisos: [
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
      registrado,
    };
  });

  const pastaIdsDeclarados = new Set(registro.flatMap((e) => (e.origem || []).map((o) => o.pastaId)));
  const naoDeclaradas = entradas
    .filter((x) => x.tipo === 'pasta' && x.pastaId && !pastaIdsDeclarados.has(x.pastaId))
    .map((x) => ({
      pasta: x.nome,
      local: x.mountPoint,
      candidatoPorNome: registro.filter((e) => !(e.origem || []).length && x.nome && x.nome.toLowerCase().replace(/^_/, '').includes(e.conceito.split('-')[0])).map((e) => e.conceito),
      origemSugerida: (() => {
        // `pasta` so com o nome: o catalogo nao guarda o caminho na biblioteca, e
        // quem localiza e o `pasta-id` (medido em 06/10). `site-titulo` nomeia a
        // pasta local de quem sincronizar depois.
        const o = { provedor: 'sharepoint', site: x.webUrl, 'site-titulo': x.webTitle || undefined, pasta: x.nome, 'site-id': x.siteId, 'web-id': x.webId, 'lista-id': x.listaId, 'pasta-id': x.pastaId };
        return { ...o, yaml: origemEmYaml(o) };
      })(),
    }));

  return {
    status: cat.status,
    entidades,
    naoDeclaradas,
    avisos: [
      ...(cat.avisos || []),
      ...(naoDeclaradas.length ? ['`origemSugerida` esta completa para gravar: `pasta` vem so com o nome (o catalogo nao guarda o caminho na biblioteca) e isso basta, porque o OneDrive localiza pelo `pasta-id`. Antes de gravar, confirme com o operador QUAL entidade e — o casamento por nome e so candidato'] : []),
    ],
  };
}
