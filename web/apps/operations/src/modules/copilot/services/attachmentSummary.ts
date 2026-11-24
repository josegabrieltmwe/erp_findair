/**
 * Convierte el resultado de `extractShipment` en el mensaje de texto que se manda al siguiente turno de
 * `copilot_chat` (docs/plan-extraccion-ia-erp.md §2.1 punto 3). Deliberadamente NO es el texto que se muestra
 * en la burbuja del usuario (eso es la leyenda corta del adjunto) — esto es lo que lee el Copilot para proponer
 * `create_shipment`. Cero cambios de contrato en `copilot_chat`: es un mensaje más, en texto plano.
 */
import type { AiExtractResult } from "@shared/ai-extract/aiExtract.service";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function leafString(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(leafString).join(", ");
  return "";
}

function flatten(
  value: unknown,
  path: string,
  out: Array<[string, string]>,
): void {
  if (isRecord(value)) {
    for (const [k, v] of Object.entries(value))
      flatten(v, path ? `${path}.${k}` : k, out);
    return;
  }
  const s = leafString(value);
  if (s !== "") out.push([path, s]);
}

export function summarizeExtraction(
  filename: string,
  result: AiExtractResult,
): string {
  const rows: Array<[string, string]> = [];
  flatten(result.extracted, "", rows);
  const fields = rows.map(([k, v]) => `- ${k}: ${v}`).join("\n");

  let text =
    `He adjuntado un documento (${filename}). Esto es lo que se ha podido leer automáticamente; ` +
    `prepárame la expedición con estos datos si tiene sentido, y pregúntame si falta algo importante:\n${fields}`;
  if (result.missingFields.length) {
    text += `\n\nCampos que no se pudieron leer: ${result.missingFields.join(", ")}.`;
  }
  if (result.warnings.length) {
    text += `\n\nAvisos de la extracción: ${result.warnings.join("; ")}.`;
  }
  return text;
}
