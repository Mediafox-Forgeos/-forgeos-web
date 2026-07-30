import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Test 22: Vendor-specific behavior is absent from the core engine. A
 * static guard, not a mock-based unit test — scans every production source
 * file under this directory for a hardcoded vendor name used in a
 * conditional, which is exactly the anti-pattern
 * docs/domain/MOVOS_DEVICE_CAPABILITY_ARCHITECTURE_v0.1.md and this work
 * order's Phase 8 instruction forbid. Comments/docstrings that merely
 * *mention* a vendor as an example (as several files in this engine
 * legitimately do) are allowed; a live conditional branching on one is not.
 */
const OCPP_SRC_ROOT = join(__dirname);

// Real EV-charger vendor names referenced anywhere in this codebase's docs
// (Device Capability Architecture, Kylum hardware information request) —
// checked here specifically because they are the ones most likely to
// tempt a "just add a special case for X" shortcut.
const KNOWN_VENDOR_NAMES = ['Kempower', 'ABB', 'Alpitronic', 'Wallbox'];

function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('vendor neutrality of the OCPP core', () => {
  it('contains no conditional logic branching on a hardcoded vendor name', () => {
    const files = listSourceFiles(OCPP_SRC_ROOT);
    const offenders: string[] = [];

    for (const file of files) {
      const contents = readFileSync(file, 'utf8');
      for (const line of contents.split('\n')) {
        const trimmed = line.trim();
        // Skip comments — a vendor name in prose (e.g. explaining a
        // decision or a hardware-info-request example) is fine; only a
        // live conditional expression referencing one is the violation.
        if (
          trimmed.startsWith('//') ||
          trimmed.startsWith('*') ||
          trimmed.startsWith('/*')
        ) {
          continue;
        }
        for (const vendor of KNOWN_VENDOR_NAMES) {
          const conditionalPattern = new RegExp(
            `(if|switch|case|===|==)\\s*\\(?['"\`]${vendor}['"\`]`,
          );
          if (
            conditionalPattern.test(line) ||
            line.includes(`=== '${vendor}'`)
          ) {
            offenders.push(`${file}: ${trimmed}`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('the device-capability tree, not the protocol adapters, is where vendor differences belong', () => {
    // Structural assertion: neither concrete adapter file imports anything
    // from a vendor-profile module (which doesn't exist yet — Architecture
    // Backlog #32 — precisely because it isn't needed until real vendor
    // data justifies it, per docs/domain/MOVOS_DEVICE_CAPABILITY_ARCHITECTURE_v0.1.md).
    const adapterFiles = [
      join(OCPP_SRC_ROOT, 'protocol/ocpp16/ocpp16-adapter.ts'),
      join(OCPP_SRC_ROOT, 'protocol/ocpp201/ocpp201-adapter.ts'),
    ];
    for (const file of adapterFiles) {
      const contents = readFileSync(file, 'utf8');
      expect(contents).not.toMatch(/vendor-profile/i);
    }
  });
});
