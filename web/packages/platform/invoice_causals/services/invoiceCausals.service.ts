import { http } from '../../anagrafiche/services/http';

// `fatture_causali_new` — motor de determinación de IVA/SDI por partner
// (NO confundir con `fatture_causali_clienti`, el catálogo global de
// vat_causals/client_causals). Cada fila es una regla: artículo IVA base,
// exención condicional por ruta (tipo='IE' + iso_from/iso_to), o una voz de
// texto (tipo A/D/F/N/NS) reutilizada en la factura. Ver
// Invoice_Causal_Model.php y Vat_Determination_Service.php (backend) para
// el consumo real en la generación de facturas.
export interface InvoiceCausal {
  id: number;
  id_partner?: number;
  ordine?: number;
  tipo_cli_base?: string | null;
  descr_cli_erp?: string | null;
  descr?: string;
  descrEN?: string;
  tipo?: string;
  art?: string | null;
  aliquota?: number | null;
  xml_natura?: string | null;
  xml_rif_norm?: string | null;
  flag_noiva?: string | null;
  iso_from?: string | null;
  iso_to?: string | null;
  blocca?: string | null;
  nota_uso?: string | null;
  stato?: string;
  [k: string]: unknown;
}

export interface InvoiceCausalsMeta {
  causals: InvoiceCausal[];
  // Código Natura SDI => etiqueta legible. Lista CERRADA (Sdi_Natura_Resolver_Service).
  natures: Record<string, string>;
  // ISO2 de países CEE (paesi_iso.CEE='S'), para el picker +CEE/-CEE.
  cee_countries: string[];
}

// `tipo` es un enum cerrado (fatt_causali_tld.php → testi_erp). Mantenido en
// sincronía manual con esa tabla — no hay endpoint de metadatos para esto
// porque son literales de negocio estables, no datos.
export const CAUSAL_TIPO_OPTIONS = [
  { value: 'IE', labelKey: 'invoice_causals.tipo_ie' },
  { value: 'I', labelKey: 'invoice_causals.tipo_i' },
  { value: 'L', labelKey: 'invoice_causals.tipo_l' },
  { value: 'A', labelKey: 'invoice_causals.tipo_a' },
  { value: 'D', labelKey: 'invoice_causals.tipo_d' },
  { value: 'F', labelKey: 'invoice_causals.tipo_f' },
  { value: 'NS', labelKey: 'invoice_causals.tipo_ns' },
  { value: 'SC', labelKey: 'invoice_causals.tipo_sc' },
  { value: 'N', labelKey: 'invoice_causals.tipo_n' },
] as const;

// Fila "system-fixed": sembrada desde la plantilla del partner_id=1 al
// arrancar la página legacy (fatt_causali.php). tipo/tipo_cli_base/ordine
// deben quedar de solo lectura para estas filas — paridad legacy exacta.
export function isSystemFixedRow(row: Pick<InvoiceCausal, 'ordine'>): boolean {
  return (row.ordine ?? 0) < 20;
}

// iso_from/iso_to solo tienen sentido para reglas de exención por ruta:
// tipo='IE' Y sin clase de cliente asociada (tipo_cli_base vacío/'N').
// Paridad legacy: InpTx1()/GrpChg() en fatt_causali.php.
export function isRouteRuleEditable(row: Pick<InvoiceCausal, 'tipo' | 'tipo_cli_base'>): boolean {
  const cliBase = row.tipo_cli_base ?? '';
  return row.tipo === 'IE' && (cliBase === '' || cliBase === 'N');
}

const ENDPOINT = '/api_invoice_causals';

export const invoiceCausalsService = {
  async listWithMeta(): Promise<InvoiceCausalsMeta> {
    const raw = await http<{ data?: Partial<InvoiceCausalsMeta> }>(ENDPOINT, {
      query: { meta: '1' },
    });
    return {
      causals: raw?.data?.causals ?? [],
      natures: raw?.data?.natures ?? {},
      cee_countries: raw?.data?.cee_countries ?? [],
    };
  },

  async create(payload: Partial<InvoiceCausal>): Promise<InvoiceCausal | null> {
    const raw = await http<{ data?: InvoiceCausal; error?: string }>(ENDPOINT, {
      method: 'POST',
      body: payload,
    });
    if (raw?.error) throw new Error(raw.error);
    return raw?.data ?? null;
  },

  async update(id: number, payload: Partial<InvoiceCausal>): Promise<InvoiceCausal | null> {
    const raw = await http<{ data?: InvoiceCausal; error?: string }>(ENDPOINT, {
      method: 'PUT',
      body: { id, ...payload },
    });
    if (raw?.error) throw new Error(raw.error);
    return raw?.data ?? null;
  },

  async remove(id: number): Promise<void> {
    const raw = await http<{ error?: string }>(ENDPOINT, {
      method: 'DELETE',
      query: { id },
    });
    if (raw?.error) throw new Error(raw.error);
  },
};
