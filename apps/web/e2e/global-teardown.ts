import { execFileSync } from 'node:child_process';
import { E2E_CONTAINER } from './global-setup.js';

// Remove the e2e Postgres container (Ryuk is disabled in global-setup, so cleanup
// is ours). Named, so this is deterministic regardless of port.
export default function globalTeardown(): void {
  try {
    execFileSync('docker', ['rm', '-f', E2E_CONTAINER], { stdio: 'ignore' });
  } catch {
    // already gone — fine.
  }
}
