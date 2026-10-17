/**
 * TR-5 anti-drift check.
 *
 * Compares files with identical names between cargo_express and
 * shipment_express (composables/, services/, stores/). Any diff that is not
 * justified in drift_allowlist.json fails the build.
 *
 * Baseline: documented drifts existing at the time TR-5 lands.
 * Future PRs that introduce a new fork must add an entry to the allowlist
 * with a brief reason.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const CARGO = join(ROOT, 'apps', 'cargo_express', 'src');
const SHIPMENT = join(ROOT, 'apps', 'shipment_express', 'src');
const ALLOWLIST_PATH = join(__dirname, 'drift_allowlist.json');

const SCANNED_DIRS = ['composables', 'services', 'stores', 'components/shell'] as const;

/**
 * A stub just re-exports the shared impl — either from the platform alias
 * (`@shared/…`) or from the shared-frontend package (`@tmwe/shared-frontend/…`).
 */
function isStub(source: string): boolean {
  return /from\s+['"](@shared\/|@tmwe\/shared-frontend\/)/.test(source);
}

function normalize(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hash(s: string): string {
  return createHash('sha1').update(s).digest('hex').slice(0, 12);
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.ts') || f.endsWith('.vue'));
}

interface DriftEntry {
  reason: string;
}
type Allowlist = Record<string, DriftEntry>;

const allowlist: Allowlist = existsSync(ALLOWLIST_PATH)
  ? JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf-8'))
  : {};

const violations: string[] = [];
const okPairs: string[] = [];

for (const sub of SCANNED_DIRS) {
  const cargoDir = join(CARGO, sub);
  const shipmentDir = join(SHIPMENT, sub);
  const cargoFiles = new Set(listFiles(cargoDir));
  const shipmentFiles = new Set(listFiles(shipmentDir));
  const common = [...cargoFiles].filter((f) => shipmentFiles.has(f));

  for (const file of common) {
    const cargoSrc = readFileSync(join(cargoDir, file), 'utf-8');
    const shipmentSrc = readFileSync(join(shipmentDir, file), 'utf-8');
    const a = normalize(cargoSrc);
    const b = normalize(shipmentSrc);
    const key = `${sub}/${file}`;

    if (a === b) {
      // Byte-identical is only OK when both are thin re-export stubs pointing at
      // @shared. Two identical *implementations* are a new copy-paste fork that
      // must live in packages/platform instead — flag it.
      if (isStub(cargoSrc) && isStub(shipmentSrc)) {
        okPairs.push(`${key} (shared stub)`);
      } else if (allowlist[key]) {
        okPairs.push(`${key} (allowlisted: ${allowlist[key].reason})`);
      } else {
        violations.push(
          `${key} — identical fork; move the impl to packages/platform and leave re-export stubs`,
        );
      }
      continue;
    }
    if (allowlist[key]) {
      okPairs.push(`${key} (allowlisted: ${allowlist[key].reason})`);
      continue;
    }
    violations.push(`${key} — diverges (cargo=${hash(a)}, shipment=${hash(b)})`);
  }
}

if (violations.length > 0) {
  console.error('drift check: violations detected');
  for (const v of violations) console.error('  ✗ ' + v);
  console.error('');
  console.error(`add an entry to ${ALLOWLIST_PATH} with a justification to allow this drift.`);
  process.exit(1);
}

console.log(`drift check: OK — ${okPairs.length} pair(s) validated`);
