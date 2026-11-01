/** Cuota contable de una factura de proveedor (reparto por cuenta del plan). */
export interface SupplierQuote {
  anno: number;
  importo_netto: number;
  id_piano_conto: number;
}

/**
 * Cuotas a enviar: se descarta la cuota vacía (neto 0 y cuenta 0) sea cual sea
 * el año, porque emptyQuote() rellena el año actual y el servidor respondería
 * 422 QUOTES_MISMATCH con una cuota fantasma.
 */
export function quotesToSend(quotes: SupplierQuote[]): SupplierQuote[] {
  return quotes
    .filter(
      (q) => Number(q.importo_netto) !== 0 || Number(q.id_piano_conto) !== 0,
    )
    .map((q) => ({
      anno: Number(q.anno) || 0,
      importo_netto: Number(q.importo_netto) || 0,
      id_piano_conto: Number(q.id_piano_conto) || 0,
    }));
}
