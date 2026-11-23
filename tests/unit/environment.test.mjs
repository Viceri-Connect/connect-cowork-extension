import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultConnectHome, inspectEnvironment, platformCapabilities } from '../../plugins/connect/lib/environment.mjs';

describe('platformCapabilities', () => {
  it('describes Windows host facilities', () => {
    expect(platformCapabilities('win32')).toEqual({
      platform: 'win32',
      family: 'windows',
      linkKind: 'junction',
      shell: 'cmd.exe',
      powershell: 'powershell.exe',
    });
  });

  it('describes POSIX host facilities without claiming PowerShell', () => {
    expect(platformCapabilities('linux')).toEqual({
      platform: 'linux',
      family: 'posix',
      linkKind: 'symlink',
      shell: '/bin/sh',
      powershell: null,
    });
  });
});

describe('defaultConnectHome', () => {
  it('uses the established Windows home folder', () => {
    expect(defaultConnectHome({ platform: 'win32', homeDir: 'user-home' }))
      .toBe(path.join('user-home', 'Connect'));
  });

  it('uses a hidden home folder on POSIX', () => {
    expect(defaultConnectHome({ platform: 'linux', homeDir: 'user-home' }))
      .toBe(path.join('user-home', '.connect'));
  });
});

describe('inspectEnvironment', () => {
  it('reports an accessible configured home without probing or creating links', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-env-'));
    try {
      const report = inspectEnvironment({ connectHome: home, pluginData: home, platform: 'linux' });
      expect(report.connectHome).toMatchObject({
        path: home,
        exists: true,
        isDirectory: true,
        readable: true,
        writable: true,
        persistence: 'host-managed',
      });
      expect(report.links).toEqual({ kind: 'symlink', availability: 'not-probed' });
      expect(report.machineControl.exposedByConnect).toBe(false);
      expect(fs.readdirSync(home)).toEqual([]);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('ignores a literal unresolved environment placeholder', () => {
    const report = inspectEnvironment({ connectHome: '${CONNECT_HOME}', platform: 'linux' });
    expect(report.connectHome.path).not.toContain('${CONNECT_HOME}');
  });
});