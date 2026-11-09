// connect/lib/instancia.mjs
// CODIGO DE INSTANCIA (0.39.0) — o primeiro uso sem caminho de pasta.
//
// O problema: no primeiro uso o plugin nao sabe qual e a instancia. O `catalogo_sync` so
// acha a Matriz depois que ela ja esta no disco, e para disparar o sync o plugin precisa
// da origem dela na nuvem (site, web, lista, pasta) — que NAO pode morar no pacote: o
// produto nao carrega conhecimento de instancia (GLOSSARIO: produto-sem-instancia).
//
// A saida: o mesmo bloco `origem` que um manifesto declara (GLOSSARIO: origem-na-nuvem),
// publicado FORA da Matriz como um texto curto que vai no guia da instancia:
//
//     CNCT1-<base64url de JSON compacto>
//
// Nao e segredo e nao concede acesso — a permissao continua no SharePoint. E metadado
// interno (ids de site e pasta), por isso o guia que o carrega e de circulacao interna.
//
//   gerarCodigoInstancia   — na maquina de quem governa: le a origem da Matriz ja
//                            configurada no catalogo do OneDrive e devolve o codigo.
//   configurarPorCodigo    — no primeiro uso: valida o codigo SEM efeito colateral,
//                            confere a conta, sincroniza, espera o catalogo, fixa e grava
//                            a Matriz no connect.config.json. Mesmo contrato de espera do
//                            sincronizar_subvault: nunca registra caminho que nao apareceu.
//
// Nunca lanca: devolve sempre { status, ... } para a skill decidir.

import fs from 'node:fs';
import path from 'node:path';
import { resolveConfig, gravarConfig } from './session.mjs';
import {
  validarItemOrigem, lerOrigem, normalizarGuid, montarLinkSync, localizarNoCatalogo, capturarOrigem,
  host as hostPadrao, PLATAFORMAS_SYNC,
} from './onedrive.mjs';

export const PREFIXO = 'CNCT';
export const VERSAO_CODIGO = 1;
const RE_CODIGO = /CNCT(\d+)-([A-Za-z0-9_-]{16,})/;
const RE_DOMINIO = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;
// O que prova que a pasta sincronizada e uma Matriz (mesma prova do `configurar`).
export const PROVA_MATRIZ = path.join('_cerebro', 'vault-config.md');

const ESPERA_PADRAO_S = 120;
const INTERVALO_MS = 3000;

const b64url = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64url = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
const semHifen = (g) => String(normalizarGuid(g) || '').replace(/-/g, '');

// ---------------------------------------------------------------------------
// codificar / decodificar — puros, sem host.
// `origem` no formato do manifesto (chaves com hifen), como o `catalogo_sync` sugere.
// ---------------------------------------------------------------------------
export function codificarCodigo({ origem, dominio, instancia = null, governanca = null } = {}) {
  const erros = [];
  if (!origem || typeof origem !== 'object') erros.push('`origem` ausente');
  else erros.push(...validarItemOrigem({ provedor: 'sharepoint', ...origem }));
  const dom = String(dominio || '').trim().toLowerCase().replace(/^@/, '');
  if (!RE_DOMINIO.test(dom)) erros.push('`dominio` de e-mail ausente ou invalido (ex.: empresa.com.br)');
  if (erros.length) return { status: 'invalido', erros };

  const carga = {
    v: VERSAO_CODIGO,
    ...(instancia ? { n: String(instancia).trim() } : {}),
    d: dom,
    ...(governanca ? { g: String(governanca).trim() } : {}),
    o: {
      s: String(origem.site).trim().replace(/\/+$/, ''),
      ...(origem['site-titulo'] ? { t: String(origem['site-titulo']).trim() } : {}),
      p: String(origem.pasta).trim().replace(/^\/+|\/+$/g, ''),
      si: semHifen(origem['site-id']),
      wi: semHifen(origem['web-id']),
      li: semHifen(origem['lista-id']),
      pi: semHifen(origem['pasta-id']),
    },
  };
  return { status: 'ok', codigo: `${PREFIXO}${VERSAO_CODIGO}-${b64url(JSON.stringify(carga))}` };
}

// Aceita o codigo solto ou no meio de um texto (o pedido inicial do operador).
export function extrairCodigo(texto) {
  const m = String(texto || '').match(RE_CODIGO);
  return m ? m[0] : null;
}

// Copiar de PDF quebra o codigo em linhas. Candidatos: o codigo colado como veio e,
// se ele for seguido de quebras, a juncao dos pedacos seguintes — do mais longo ao mais
// curto, ate um decodificar como JSON (palavra do pedido grudada no fim nao decodifica).
// Visualizadores de PDF tambem tratam o `-` no fim da linha como hifenizacao e o
// apagam (medido no guia de 27/10: `CNCT1-` virou `CNCT1`). Por isso cada juncao
// entre pedacos tenta as duas formas — sem nada e com `-` — e vale a que decodificar.
// Hifens tipograficos (U+2010..U+2015, U+2212) contam como `-`.
const MAX_PEDACOS = 10;
function candidatos(texto) {
  const s = String(texto || '').replace(/[‐-―−]/g, '-');
  const i = s.search(/CNCT\d/);
  if (i < 0) return [];
  const pedacos = s.slice(i).split(/\s+/).filter(Boolean).slice(0, MAX_PEDACOS);
  const lista = [];
  const add = (junto) => {
    const m = junto.match(/^CNCT(\d)-?([A-Za-z0-9_-]+)/);
    if (!m) return;
    const c = `CNCT${m[1]}-${m[2]}`;
    if (!lista.includes(c)) lista.push(c);
  };
  for (let k = pedacos.length; k >= 1; k--) {
    const juncoes = k - 1;
    for (let mask = 0; mask < (1 << juncoes); mask++) {
      let junto = pedacos[0];
      for (let j = 1; j < k; j++) junto += ((mask >> (j - 1)) & 1 ? '-' : '') + pedacos[j];
      add(junto);
    }
  }
  return lista;
}

export function decodificarCodigo(texto) {
  const lista = candidatos(texto);
  if (!lista.length) return { status: 'codigo-invalido', erros: ['nenhum codigo de instancia (CNCT1-...) no texto'] };
  const ver = lista[0].match(/^CNCT(\d)-/)[1];
  if (Number(ver) !== VERSAO_CODIGO) {
    return { status: 'codigo-invalido', erros: [`versao de codigo desconhecida (CNCT${ver}) — atualize o plugin Connect ou peca um codigo novo`] };
  }
  let carga = null;
  let bruto = null;
  for (const c of lista) {
    try {
      const x = JSON.parse(deB64url(c.slice(c.indexOf('-') + 1)));
      if (x && typeof x === 'object' && x.o) { carga = x; bruto = c; break; }
    } catch { /* proximo candidato */ }
  }
  if (!carga) return { status: 'codigo-invalido', erros: ['o codigo esta incompleto ou foi alterado — copie de novo do guia, inteiro'] };
  if (!carga || carga.v !== VERSAO_CODIGO || !carga.o) return { status: 'codigo-invalido', erros: ['conteudo do codigo fora do formato esperado'] };

  const dominio = String(carga.d || '').toLowerCase();
  const erros = [];
  if (!RE_DOMINIO.test(dominio)) erros.push('dominio de e-mail ausente no codigo');
  const { itens, erros: errosOrigem } = lerOrigem([{
    provedor: 'sharepoint', site: carga.o.s, 'site-titulo': carga.o.t, pasta: carga.o.p,
    'site-id': carga.o.si, 'web-id': carga.o.wi, 'lista-id': carga.o.li, 'pasta-id': carga.o.pi,
  }]);
  erros.push(...errosOrigem.map((e) => e.replace(/^origem\[0\]: /, '')));
  if (erros.length) return { status: 'codigo-invalido', erros };

  return {
    status: 'ok',
    codigo: bruto,
    instancia: carga.n || null,
    dominio,
    governanca: carga.g || null,
    origem: itens[0],
  };
}

// ---------------------------------------------------------------------------
// gerarCodigoInstancia — quem governa a instancia, com a Matriz ja configurada.
// ---------------------------------------------------------------------------
export function gerarCodigoInstancia({ dominio = null, instancia = null, governanca = null, pasta = null, host = hostPadrao, ...override } = {}) {
  const cfg = resolveConfig(override);
  if (!cfg.vaultMatriz || !fs.existsSync(cfg.vaultMatriz)) {
    return { status: 'matriz-nao-configurada', avisos: ['gere o codigo numa maquina com a Matriz ja configurada (configurar) e sincronizada pelo OneDrive'] };
  }
  if (!PLATAFORMAS_SYNC.includes(host.plataforma)) {
    return { status: 'plataforma-nao-suportada', avisos: [`o catalogo do OneDrive so e lido no Windows e no macOS (esta maquina: ${host.plataforma})`] };
  }
  const cat = host.lerCatalogo();
  const cap = capturarOrigem(cat.entradas || [], cfg.vaultMatriz);
  if (!cap) {
    return { status: 'origem-nao-encontrada', matriz: cfg.vaultMatriz, avisos: ['o catalogo do OneDrive nao lista a pasta da Matriz — ela foi copiada em vez de sincronizada? Sincronize pelo botao "Sincronizar" do SharePoint e repita'] };
  }
  if (!cap.exata) {
    return {
      status: 'origem-maior',
      subcaminho: cap.subcaminho,
      avisos: [`a Matriz esta dentro de uma pasta sincronizada maior (subcaminho "${cap.subcaminho}"). O codigo faria quem chega sincronizar a pasta inteira — sincronize a pasta da Matriz sozinha e gere de novo`],
    };
  }

  let dom = dominio;
  const avisos = [];
  if (!dom) {
    const contas = [...new Set((host.emailsDasContas() || []).map((c) => String(c.email || '').toLowerCase()).filter(Boolean))];
    const doms = [...new Set(contas.map((e) => e.split('@')[1]).filter(Boolean))];
    if (doms.length !== 1) {
      return { status: 'dominio-indefinido', contas, avisos: ['nao deu para inferir o dominio de e-mail da instancia pela conta OneDrive — repita informando `dominio`'] };
    }
    dom = doms[0];
    avisos.push(`dominio inferido da conta OneDrive logada: ${dom}`);
  }

  // O catalogo guarda so o NOME da pasta; quem localiza e o `pasta-id`. `pasta` completa
  // (biblioteca/caminho) e opcional e so deixa o link informativo fiel.
  const origemFinal = pasta ? { ...cap.origem, pasta: String(pasta).trim() } : cap.origem;
  const r = codificarCodigo({ origem: origemFinal, dominio: dom, instancia, governanca });
  if (r.status !== 'ok') return { status: 'invalido', erros: r.erros };
  return {
    status: 'ok',
    codigo: r.codigo,
    dominio: dom,
    origem: origemFinal,
    avisos: [
      ...avisos,
      ...(governanca ? [] : ['sem `governanca`: quem receber "aguardando" nao sabera a quem pedir acesso — informe o papel ou a pessoa que concede acesso ao site']),
      'o codigo nao e segredo e nao concede acesso, mas carrega ids internos do SharePoint: publique so em material de circulacao interna',
    ],
  };
}

// ---------------------------------------------------------------------------
// configurarPorCodigo — o primeiro uso. Async: espera o cliente OneDrive.
// Ordem, e o porque de cada passo:
//   1. decodifica e valida SEM efeito colateral (codigo ruim nao dispara nada);
//   2. Matriz ja configurada e existente: nao mexe (outra pasta = pergunta, nunca troca);
//   3. CATALOGO PRIMEIRO: ja sincronizada -> so configura, sem abrir o OneDrive de novo;
//   4. conta: precisa de UMA conta OneDrive do dominio da instancia — e ela que vai no
//      `userEmail` do link (sem ele o cliente ignora o link em silencio);
//   5. dispara e espera o catalogo listar a pasta; prazo esgotado = `aguardando`;
//   6. prova de Matriz (_cerebro/vault-config.md), fixa no dispositivo, grava a config.
// ---------------------------------------------------------------------------
export async function configurarPorCodigo({
  codigo,
  email = null,
  substituir = false,
  aguardarSegundos = ESPERA_PADRAO_S,
  host = hostPadrao,
  ...override
} = {}) {
  const dec = decodificarCodigo(codigo);
  if (dec.status !== 'ok') return { ...dec, avisos: ['nada foi feito — confira o codigo no guia da sua empresa'] };
  const { origem, dominio, instancia, governanca } = dec;
  const base = { instancia, dominio, governanca };
  const cfg = resolveConfig(override);

  const configurada = cfg.vaultMatriz && fs.existsSync(cfg.vaultMatriz) ? cfg.vaultMatriz : null;

  if (!PLATAFORMAS_SYNC.includes(host.plataforma)) {
    return { ...base, status: 'plataforma-nao-suportada', link: montarLinkSync(origem), avisos: [`sync automatico so no Windows e no macOS (esta maquina: ${host.plataforma}). O operador sincroniza a pasta pelo SharePoint e informa o caminho (configurar)`] };
  }

  const avisos = host.plataforma === 'darwin'
    ? ['macOS: sync automatico em validacao — se algo falhar, chame catalogo_sync e devolva o `diagnostico` ao time do Connect; o caminho manual (configurar) segue valendo']
    : [];

  const concluir = (achado, ja) => {
    if (!achado.caminho) {
      return { ...base, status: 'caminho-nao-traduzido', avisos: [...avisos, 'o OneDrive ja sincroniza a Matriz, mas o caminho nao virou pasta de disco — pergunte ao operador onde ela aparece e use configurar'] };
    }
    if (!fs.existsSync(achado.caminho) || !fs.existsSync(path.join(achado.caminho, PROVA_MATRIZ))) {
      return { ...base, status: 'aguardando', caminho: achado.caminho, avisos: [...avisos, 'a pasta apareceu, mas o OneDrive ainda esta trazendo o conteudo — repita em instantes'] };
    }
    if (configurada && path.resolve(configurada).toLowerCase() === path.resolve(achado.caminho).toLowerCase()) {
      return { ...base, status: 'ja-configurado', jaSincronizado: ja, caminho: achado.caminho, avisos: [...avisos, 'nada a fazer: esta Matriz ja e a configurada. Siga com iniciar_sessao'] };
    }
    if (configurada && !substituir) {
      return { ...base, status: 'outra-matriz-configurada', configurada, caminho: achado.caminho, avisos: ['ja existe outra Matriz configurada nesta maquina — pergunte ao operador se quer trocar; se sim, repita com `substituir: true`'] };
    }
    const fixacao = host.fixar(achado.caminho, { arvoreEmSegundoPlano: true });
    const gravacao = gravarConfig({ home: override.home, vaultMatriz: achado.caminho });
    if (!gravacao.gravados?.vaultMatriz) {
      return { ...base, status: 'erro-config', caminho: achado.caminho, gravacao, avisos: [...avisos, gravacao.motivo || 'nao foi possivel gravar a Matriz no connect.config.json'] };
    }
    return {
      ...base,
      status: 'configurado',
      jaSincronizado: ja,
      caminho: achado.caminho,
      fixacao,
      configPath: gravacao.configPath,
      avisos: [
        ...avisos,
        ...(fixacao.status === 'erro' ? [`a Matriz sincroniza, mas fixar no dispositivo falhou (${fixacao.motivo}) — o operador pode marcar "Manter sempre neste dispositivo" pelo Explorer`] : []),
        ...(fixacao.status === 'nao-suportado' ? [`a Matriz nao foi fixada no dispositivo. REPASSE ao operador: ${fixacao.instrucao || 'marque "Manter sempre neste dispositivo" na pasta'}`] : []),
        'proximo passo: iniciar_sessao (perfil do operador nasce pela cnct-fabrica-operador se ainda nao existir) e pedir para conectar a pasta da Matriz ao projeto Cowork',
      ],
    };
  };

  // 3. catalogo primeiro
  const antes = host.lerCatalogo();
  const ja = localizarNoCatalogo(antes.entradas || [], origem);
  if (ja) return concluir(ja, true);
  // Outra Matriz ja configurada e esta nem sincronizada: nao dispara sync sem o operador decidir.
  if (configurada && !substituir) {
    return { ...base, status: 'outra-matriz-configurada', configurada, avisos: ['ja existe outra Matriz configurada nesta maquina — pergunte ao operador se quer trocar; se sim, repita com `substituir: true`'] };
  }

  // 4. conta do dominio da instancia
  const doDominio = (e) => String(e || '').toLowerCase().endsWith(`@${dominio}`);
  let emailFinal = null;
  if (email) {
    if (!doDominio(email)) {
      return { ...base, status: 'conta-de-outro-dominio', avisos: [`o e-mail informado nao e @${dominio}. Use a conta da empresa no OneDrive`] };
    }
    emailFinal = email;
  } else {
    const contas = [...new Set((host.emailsDasContas() || []).map((c) => String(c.email || '').toLowerCase()).filter(Boolean))];
    const validas = contas.filter(doDominio);
    if (validas.length === 1) emailFinal = validas[0];
    else if (validas.length > 1) {
      return { ...base, status: 'ambigua-conta', contas: validas, avisos: [`ha ${validas.length} contas @${dominio} no OneDrive — pergunte ao operador qual e repita com \`email\``] };
    } else if (!contas.length && host.plataforma === 'darwin') {
      avisos.push('macOS: e-mail da conta OneDrive nao localizado nas preferencias — link disparado sem `userEmail`. Se nada abrir, repita informando `email`');
    } else if (!contas.length) {
      return { ...base, status: 'onedrive-sem-conta', avisos: [`o OneDrive desta maquina nao esta conectado. Peca ao operador para abrir o OneDrive e entrar com o e-mail @${dominio}; depois repita`] };
    } else {
      return { ...base, status: 'conta-de-outro-dominio', contas, avisos: [`o OneDrive esta conectado com ${contas.join(', ')}, e a Matriz desta empresa exige uma conta @${dominio}. Peca ao operador para entrar no OneDrive com o e-mail da empresa; nada foi sincronizado`] };
    }
  }

  // 5. dispara e espera
  const link = montarLinkSync(origem, { email: emailFinal });
  try {
    host.abrirLink(link);
  } catch (e) {
    return { ...base, status: 'erro-disparo', avisos: [`nao foi possivel abrir o OneDrive: ${e.message}`] };
  }
  const limite = Date.now() + Math.max(0, aguardarSegundos) * 1000;
  while (Date.now() < limite) {
    await host.esperar(INTERVALO_MS);
    const achado = localizarNoCatalogo(host.lerCatalogo().entradas || [], origem);
    if (achado) return concluir(achado, false);
  }
  return {
    ...base,
    status: 'aguardando',
    avisos: [
      ...avisos,
      `o OneDrive nao listou a Matriz em ${aguardarSegundos}s. Pode ser sync lento (repita em instantes, com o mesmo codigo) ou falta de permissao no site — neste caso peca acesso a ${governanca || 'quem governa o Connect na sua empresa'}`,
      'se o OneDrive abriu uma caixa de erro, ela diz qual dos dois e',
    ],
  };
}
