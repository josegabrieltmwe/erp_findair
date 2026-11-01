import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const ROUTER = resolve(dirname(fileURLToPath(import.meta.url)), "../../../apps/operations/src/router/index.ts");

export interface RouteInfo {
  path: string;
  requiresAdmin: boolean;
}

/**
 * Rutas absolutas y sin parámetros del router de la SPA, leídas del propio fichero para que una ruta nueva
 * entre sola. Las rutas con `:id` necesitan ids de prueba y se cubren aparte.
 */
export function staticRoutes(): RouteInfo[] {
  const src = readFileSync(ROUTER, "utf8");
  const chunks = src.split(/\n\s*\{\s*\n\s*path:\s*"/).slice(1);
  const out: RouteInfo[] = [];
  for (const c of chunks) {
    const path = c.slice(0, c.indexOf('"'));
    if (!path.startsWith("/") || path.includes(":") || path === "/") continue;
    // Solo el bloque de esa ruta (hasta la siguiente ruta de primer nivel o su cierre).
    const head = c.split(/\n  \},?\n/)[0] ?? c;
    out.push({ path, requiresAdmin: /requiresAdmin:\s*true/.test(head) });
  }
  return [...new Map(out.map((r) => [r.path, r])).values()];
}
