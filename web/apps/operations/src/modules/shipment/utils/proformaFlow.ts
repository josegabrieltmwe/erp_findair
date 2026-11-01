/**
 * Genera el PDF solo si el guardado previo tuvo éxito: de lo contrario saldría
 * un PDF con los datos antiguos del servidor.
 */
export async function generatePdfAfterSave<T>(
  save: () => Promise<boolean>,
  generate: () => Promise<T>,
): Promise<{ aborted: true } | { aborted: false; result: T }> {
  if (!(await save())) return { aborted: true };
  return { aborted: false, result: await generate() };
}
