import { http } from "./http";

/**
 * Proforma invoice REST client — wraps the modern `api_proforma_*`
 * controllers. Field names mirror the DB columns exactly (no legacy
 * aliases like `q`/`unit`/`prezzo`) — those aliases were used by the
 * old SPA mockup; the backend has only ever accepted the canonical
 * forms below.
 *
 * Tables behind the endpoints:
 *   `fattura_proforma`       (header — Proforma_Model)
 *   `fattura_proforma_dett`  (line items — Proforma_Detail_Model)
 */

export interface ProformaItem {
  id?: number | string;
  id_proforma?: number | string;
  descrizione: string;
  voce_doganale?: string;
  qta: number;
  qta_unit?: string;
  peso_netto?: number;
  peso_lordo?: number;
  peso_unit?: "K" | "L";
  valore: number;
  stato?: "A" | "O";
}

export interface ProformaHeader {
  iso_paese_origine?: string;
  motivo?: string;
  id_valuta?: number;
  data?: string;
}

export interface Proforma extends ProformaHeader {
  id: number | string;
  id_spedizione: number | string;
  items: ProformaItem[];
  total?: number;
  currency_code?: string;
  motivo_descr?: string;
}

export interface ProformaLookup {
  success: boolean;
  motivi?: Array<{ id: string; descr: string }>;
  units?: string[];
  valute?: Array<{ id: number; sigla: string }>;
  paesi?: Array<{ iso: string; nome: string }>;
}

export const proformaService = {
  // The backend (Proforma_Crud_Controller) keys on `id_spedizione`, not
  // `shipment_id`, in both the list filter and the create body — sending the
  // wrong name made GET return nothing and POST fail with "id_spedizione is
  // required". Map it here so callers keep using the SPA's shipment_id name.
  /**
   * Proforma de la expedición con sus líneas. La API no tiene un GET por
   * expedición que devuelva items: el listado filtrado por `id_spedizione`
   * vuelve como `{data, pagination}` (sin items) y la ficha `?id=` como
   * `{success, data: {..., items}}`. Antes se leía `{success, proforma}`,
   * que la API nunca devuelve, y el modal salía siempre vacío.
   */
  async get(
    shipment_id: number,
  ): Promise<{ success: boolean; proforma?: Proforma | null }> {
    const list = await http<{ data?: Array<{ id: number | string }> }>(
      "/api_proforma_crud",
      { query: { id_spedizione: shipment_id } },
    );
    const first = list.data?.[0];
    if (!first) return { success: true, proforma: null };
    const one = await http<{ success: boolean; data?: Proforma }>(
      "/api_proforma_crud",
      { query: { id: first.id } },
    );
    const p = one.data;
    if (!one.success || !p) return { success: false, proforma: null };
    return {
      success: true,
      proforma: {
        ...p,
        id_valuta:
          p.id_valuta === undefined ||
          p.id_valuta === null ||
          `${p.id_valuta}` === "0"
            ? undefined
            : Number(p.id_valuta),
        items: (p.items ?? []).map((it) => ({
          ...it,
          qta: Number(it.qta ?? 0),
          peso_netto: Number(it.peso_netto ?? 0),
          peso_lordo: Number(it.peso_lordo ?? 0),
          valore: Number(it.valore ?? 0),
        })),
      },
    };
  },
  /**
   * Una proforma por expedición: si ya existe se actualiza (PUT, reemplaza
   * items); si no, se crea. Antes siempre hacía POST y la API respondía 409
   * PROFORMA_DUPLICATE sobre cualquier proforma existente.
   */
  async save(
    shipment_id: number,
    header: ProformaHeader,
    items: ProformaItem[],
  ): Promise<{ success: boolean; proforma?: Proforma; error?: string }> {
    const list = await http<{ data?: Array<{ id: number | string }> }>(
      "/api_proforma_crud",
      { query: { id_spedizione: shipment_id } },
    );
    const existing = list.data?.[0]?.id;
    const r = await http<{ success: boolean; data?: Proforma; error?: string }>(
      "/api_proforma_crud",
      existing
        ? { method: "PUT", body: { id: existing, ...header, items } }
        : {
            method: "POST",
            body: { id_spedizione: shipment_id, ...header, items },
          },
    );
    return { success: !!r.success, proforma: r.data, error: r.error };
  },
  /**
   * Copia la proforma de una expedición a otra. La API espera el id de la
   * proforma origen y `target_shipment_id` (Proforma_Duplicate_Controller);
   * antes se enviaba `{from_shipment_id, to_shipment_id}` y respondía 422.
   */
  async duplicate(
    from_shipment_id: number,
    to_shipment_id: number,
  ): Promise<{ success: boolean; error?: string }> {
    const list = await http<{ data?: Array<{ id: number | string }> }>(
      "/api_proforma_crud",
      { query: { id_spedizione: from_shipment_id } },
    );
    const id = list.data?.[0]?.id;
    if (!id) return { success: false, error: "NO_SOURCE_PROFORMA" };
    const r = await http<{ success: boolean }>("/api_proforma_duplicate", {
      method: "POST",
      body: { id, target_shipment_id: to_shipment_id },
    });
    return { success: !!r.success };
  },
  /** Catálogos: la API devuelve filas `{sigla_dhl, descriz}`; se normalizan aquí. */
  async lookup(): Promise<ProformaLookup> {
    type Row = { sigla_dhl: string; descriz?: string };
    const [motivi, units] = await Promise.all([
      http<{ success: boolean; data?: Row[] }>("/api_proforma_lookup", {
        query: { type: "motivi" },
      }),
      http<{ success: boolean; data?: Row[] }>("/api_proforma_lookup", {
        query: { type: "units" },
      }),
    ]);
    return {
      success: true,
      motivi: (motivi.data ?? []).map((m) => ({
        id: m.sigla_dhl,
        descr: (m.descriz ?? m.sigla_dhl).trim(),
      })),
      units: (units.data ?? []).map((u) => u.sigla_dhl),
    };
  },
  /**
   * PDF de la proforma. `api_proforma_file` devuelve el BINARIO (no JSON con
   * `url`): se descarga como blob y se devuelve una URL local para abrirla.
   */
  async generatePdf(
    shipment_id: number,
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    const base =
      (typeof window !== "undefined" && window.__TMWE_SHIPMENT__?.basePath) ||
      "/bff/v1";
    const res = await fetch(`${base}/api_proforma_file`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shipment_id }),
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("pdf")) {
      const body = (await res.json().catch(() => null)) as {
        detail?: string;
      } | null;
      return { success: false, error: body?.detail };
    }
    const url = URL.createObjectURL(await res.blob());
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return { success: true, url };
  },
};
