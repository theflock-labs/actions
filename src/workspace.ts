import { lstat, realpath, readFile, writeFile, mkdir } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep, dirname } from 'node:path';

const blocked = /(^|\/)(\.git|\.flock|node_modules|\.ssh|\.aws|\.config|\.env(?:\.[^/]*)?|[^/]*\.(?:pem|key|p12))($|\/)/i;
const protectedWrite = /(^|\/)(\.github|\.flock-tasks)($|\/)/;
export class Workspace {
  constructor(readonly root: string) {}
  async path(path: string, allowed: string[], write = false): Promise<string> {
    if (!path || isAbsolute(path) || path.includes('\\') || path.includes('\0')) throw new Error('Path must be relative to the workspace');
    const full = resolve(this.root, path);
    const normalized = relative(this.root, full).split(sep).join('/');
    if ((!normalized && (write || !allowed.includes('.'))) || normalized.startsWith('../') || normalized === '..' || blocked.test(normalized) || (write && protectedWrite.test(normalized))) throw new Error('Protected or escaping path');
    const permits = allowed.some(p => {
      const rule = p.replace(/\/$/, '');
      return p === '.' || normalized === rule || (p.endsWith('/') && normalized.startsWith(`${rule}/`));
    });
    if (!permits) throw new Error(`Path not allowed: ${normalized}`);
    const root = await realpath(this.root);
    let current = this.root;
    for (const part of normalized.split('/')) {
      current = resolve(current, part);
      try {
        const info = await lstat(current);
        if (info.isSymbolicLink()) throw new Error('Symlinks are not permitted');
        if (info.isFile() && info.nlink > 1) throw new Error('Hard-linked files are not permitted');
        const actual = await realpath(current);
        if (actual !== root && !actual.startsWith(root + sep)) throw new Error('Path escapes workspace');
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
    return full;
  }
  async read(path: string, allowed: string[]): Promise<string> {
    const full = await this.path(path, allowed);
    const info = await lstat(full);
    if (!info.isFile() || info.size > 131072) throw new Error('Read requires a regular file of at most 128 KiB');
    return readFile(full, 'utf8');
  }
  async write(path: string, content: string, allowed: string[]): Promise<void> {
    if (Buffer.byteLength(content) > 131072) throw new Error('Write exceeds 128 KiB');
    const full = await this.path(path, allowed, true);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, { encoding: 'utf8', flag: 'w' });
  }
}
