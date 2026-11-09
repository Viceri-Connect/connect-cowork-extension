import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function platformCapabilities(platform = process.platform) {
  const windows = platform === 'win32';
  return Object.freeze({
    platform,
    family: windows ? 'windows' : 'posix',
    linkKind: windows ? 'junction' : 'symlink',
    shell: windows ? 'cmd.exe' : '/bin/sh',
    powershell: windows ? 'powershell.exe' : null,
  });
}

export function defaultConnectHome({ platform = process.platform, homeDir = os.homedir() } = {}) {
  return path.join(homeDir, platform === 'win32' ? 'Connect' : '.connect');
}

export function inspectEnvironment({
  connectHome = process.env.CONNECT_HOME,
  pluginData = process.env.PLUGIN_DATA,
  platform = process.platform,
} = {}) {
  const home = typeof connectHome === 'string' && connectHome.trim() && !connectHome.includes('${')
    ? path.resolve(connectHome.trim())
    : defaultConnectHome({ platform });
  let exists = false;
  let isDirectory = false;
  let readable = false;
  let writable = false;

  try {
    const stat = fs.statSync(home);
    exists = true;
    isDirectory = stat.isDirectory();
    if (isDirectory) {
      try { fs.accessSync(home, fs.constants.R_OK); readable = true; } catch { /* not readable */ }
      try { fs.accessSync(home, fs.constants.W_OK); writable = true; } catch { /* not writable */ }
    }
  } catch { /* absent or inaccessible */ }

  const platformInfo = platformCapabilities(platform);
  const persistence = typeof pluginData === 'string' && pluginData.trim()
    && path.resolve(pluginData) === home
    ? 'host-managed'
    : 'unknown';
  return {
    platform: platformInfo,
    runtime: { node: process.version, executable: process.execPath },
    connectHome: { path: home, exists, isDirectory, readable, writable, persistence },
    links: { kind: platformInfo.linkKind, availability: 'not-probed' },
    machineControl: { exposedByConnect: false },
  };
}