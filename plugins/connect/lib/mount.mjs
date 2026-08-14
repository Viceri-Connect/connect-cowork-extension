// connect/lib/mount.mjs
// Nucleo do mecanismo de mount de atalhos ("knowledge roots") no workspace da sessao.
//
// Objetivo: expor um diretorio de origem (que pode estar sincronizado com
// SharePoint/OneDrive noutro lugar do disco) como um alias "flat" dentro do
// diretorio de trabalho da sessao.
//
//   Windows  -> junction NTFS (mklink /J) — nao exige privilegio de admin.
//   POSIX/nuvem -> symlink de diretorio — mesmo efeito logico.
//
// A mesma funcao roda nos dois mundos; o SO e detectado em tempo de execucao.
// Zero dependencias externas (Node embarcado).

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const IS_WINDOWS = process.platform === 'win32';
export const LINK_KIND = IS_WINDOWS ? 'junction' : 'symlink';

// ---------------------------------------------------------------------------
// Validacao: o alias e um nome simples dentro do workspace. Nunca pode conter
// separadores, "..", nem ser absoluto — senao o link poderia escapar da sessao.
// ---------------------------------------------------------------------------
export function validateAlias(alias) {
  if (!alias || typeof alias !== 'string') {
    throw new Error('alias vazio ou invalido');
  }
  if (alias.includes('/') || alias.includes('\\') || alias.includes('..') || path.isAbsolute(alias)) {
    throw new Error(`alias invalido: "${alias}" — nao pode conter "/", "\\", ".." ou ser um caminho absoluto`);
  }
  return alias;
}

export function resolveLinkPath(workspaceDir, alias) {
  validateAlias(alias);
  const ws = path.resolve(workspaceDir);
  const link = path.join(ws, alias);
  // Cinto de seguranca extra: garante que o link resolvido fica dentro do workspace.
  if (link !== ws && !link.startsWith(ws + path.sep)) {
    throw new Error('o link resolvido escaparia do workspace — abortando');
  }
  return { ws, link };
}

function isLink(p) {
  try {
    // Em Windows, junctions sao reparse points e o lstat os marca como symlink.
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

function readLinkTarget(p) {
  try { return fs.readlinkSync(p); } catch { return null; }
}

// Remove APENAS o link/junction, jamais o conteudo da origem.
function removeLinkOnly(link) {
  if (IS_WINDOWS) {
    // rmdir sobre uma junction remove so a junction (o alvo fica intacto).
    const r = spawnSync('cmd', ['/c', 'rmdir', link], { encoding: 'utf8' });
    if (r.status !== 0) {
      throw new Error(`falha ao remover junction: ${(r.stderr || r.stdout || '').trim()}`);
    }
  } else {
    fs.unlinkSync(link); // unlink em symlink remove so o link
  }
}

// Cria o diretorio se nao existir (o scaffold da sessao vive fora do OneDrive).
export function ensureDir(dir) {
  fs.mkdirSync(path.resolve(dir), { recursive: true });
  return path.resolve(dir);
}

// ---------------------------------------------------------------------------
// mount — cria um atalho (junction/symlink) alias -> source dentro do workspace
// ---------------------------------------------------------------------------
export function mount({ workspaceDir, alias, source, replace = false }) {
  const { ws, link } = resolveLinkPath(workspaceDir, alias);

  if (!fs.existsSync(ws)) throw new Error(`workspace nao existe: ${ws}`);

  const src = path.resolve(source);
  if (!fs.existsSync(src)) throw new Error(`origem nao existe: ${src}`);
  if (!fs.statSync(src).isDirectory()) throw new Error(`origem nao e um diretorio: ${src}`);

  const linkExists = fs.existsSync(link) || isLink(link);
  if (linkExists) {
    if (isLink(link)) {
      const current = readLinkTarget(link);
      const sameTarget = current && path.resolve(current) === src;
      if (sameTarget && !replace) {
        return { status: 'exists', alias, link, source: src, kind: LINK_KIND, platform: process.platform };
      }
      if (replace) {
        removeLinkOnly(link);
      } else {
        throw new Error(`alias "${alias}" ja montado apontando para outro destino (${current}); use replace=true para trocar`);
      }
    } else {
      // Existe um diretorio/arquivo REAL nesse nome — nao mexemos, por seguranca.
      throw new Error(`ja existe um item real (nao-junction) em ${link} — abortando para nao sobrescrever dados`);
    }
  }

  if (IS_WINDOWS) {
    const r = spawnSync('cmd', ['/c', 'mklink', '/J', link, src], { encoding: 'utf8' });
    if (r.status !== 0) {
      throw new Error(`falha ao criar junction: ${(r.stderr || r.stdout || '').trim()}`);
    }
  } else {
    fs.symlinkSync(src, link, 'dir');
  }

  return { status: 'mounted', alias, link, source: src, kind: LINK_KIND, platform: process.platform };
}

// ---------------------------------------------------------------------------
// unmount — remove um atalho do workspace (nunca a origem)
// ---------------------------------------------------------------------------
export function unmount({ workspaceDir, alias }) {
  const { link } = resolveLinkPath(workspaceDir, alias);

  if (!fs.existsSync(link) && !isLink(link)) {
    return { status: 'absent', alias, link };
  }
  if (!isLink(link)) {
    // Trava critica: so desmontamos junctions/symlinks, nunca diretorios reais.
    throw new Error(`recusando desmontar: ${link} e um diretorio real, nao uma junction/symlink`);
  }

  removeLinkOnly(link);
  return { status: 'unmounted', alias, link };
}

// Lista os aliases (junctions/symlinks) atualmente montados no workspace.
export function listMounts(workspaceDir) {
  const ws = path.resolve(workspaceDir);
  if (!fs.existsSync(ws)) return [];
  return fs.readdirSync(ws)
    .map((name) => ({ name, full: path.join(ws, name) }))
    .filter((e) => isLink(e.full))
    .map((e) => ({ alias: e.name, link: e.full, source: readLinkTarget(e.full), kind: LINK_KIND }));
}
