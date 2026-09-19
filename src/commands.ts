import { spawn } from 'node:child_process';
import type { CommandConfig } from './config.js';

export function commandEnv(names: string[]): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of ['PATH', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TMPDIR', 'TMP', 'TEMP', ...names]) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  return env;
}
export function runCommand(config: CommandConfig, cwd: string, input: unknown, signal: AbortSignal): Promise<string> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawn(config.command, config.args, {
      cwd, shell: false, env: commandEnv(config.env), stdio: ['pipe', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    let output = ''; let failure: Error | undefined; let settled = false;
    const stop = (error: Error) => {
      failure ??= error;
      try { if (child.pid && process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch { /* exited */ }
    };
    const abort = () => stop(new Error('Command cancelled'));
    signal.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => stop(new Error('Command timed out')), config.timeoutSeconds * 1000);
    const clean = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); };
    const collect = (chunk: Buffer) => {
      if (Buffer.byteLength(output) + chunk.length > 131072) stop(new Error('Command output exceeds 128 KiB'));
      else output += chunk.toString('utf8');
    };
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    child.once('error', (error) => { if (!settled) { settled = true; clean(); reject(error); } });
    child.once('close', code => {
      if (settled) return;
      settled = true; clean();
      if (failure) reject(failure);
      else if (code !== 0) reject(new Error(`Command exited with code ${code}: ${output.slice(0, 2048)}`));
      else resolve(output);
    });
    child.stdin.on('error', () => { /* Commands may intentionally ignore stdin. */ });
    child.stdin.end(JSON.stringify(input));
    if (signal.aborted) abort();
  });
}
