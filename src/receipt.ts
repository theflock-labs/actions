import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Receipt } from './types.js';

export async function saveReceipt(path: string, receipt: Receipt): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(receipt, null, 2) + '\n', { encoding: 'utf8', mode: 0o600, flag: 'wx' });
}
export const successful = (receipt: Receipt): boolean => receipt.status !== 'failed';
