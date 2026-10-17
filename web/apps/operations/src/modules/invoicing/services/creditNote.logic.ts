/**
 * Lógica pura de la nota de crédito parcial (sin Vue ni red).
 * Espeja Credit_Note_Service::resolve_items_vat(): iva = round(neto * % / 100, 2).
 */
import type { InvoiceLine } from "./invoice.service";

/** Motivos fiscales TD04 (Credit_Note_Service::VALID_MOTIVI). */
export const CREDIT_MOTIVI = [
  "restituzione",
  "bonifica",
  "errore",
  "sconto",
  "altro",
] as const;
export type CreditMotivo = (typeof CREDIT_MOTIVI)[number];

export interface CreditLine {
  id: number;
  descriz: string;
  /** Neto de la línea original: tope de lo acreditable. */
  maxNet: number;
  aliquota: number | null;
  codIva: string | null;
  selected: boolean;
  /** Neto a acreditar (editable, ≤ maxNet). */
  net: number;
}

export interface CreditItem {
  descriz: string;
  importo_netto: number;
  importo_iva?: number;
  aliquota_iva?: number;
  cod_iva?: string;
}

export interface CreditTotals {
  net: number;
  vat: number;
  gross: number;
}

export function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/** IVA de una línea: round(neto * aliquota / 100, 2). Sin tipo → 0. */
export function vatOf(net: number, aliquota: number | null): number {
  if (aliquota === null || !Number.isFinite(aliquota)) return 0;
  return round2(round2(net) * aliquota / 100);
}

/** Acota el neto introducido a [0, máximo de la línea]. */
export function capNet(value: number, max: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(round2(value), round2(max));
}

/** Líneas acreditables (servicio C/M con neto positivo), todas sin seleccionar. */
export function creditLinesFrom(dettagli: InvoiceLine[]): CreditLine[] {
  return dettagli
    .filter(
      (l) =>
        (l.tipo_record === "C" || l.tipo_record === "M") &&
        Number(l.importo_netto) > 0,
    )
    .map((l) => ({
      id: l.id,
      descriz: l.descriz,
      maxNet: round2(Number(l.importo_netto)),
      aliquota:
        l.aliquota_iva === null || l.aliquota_iva === undefined
          ? null
          : Number(l.aliquota_iva),
      codIva: l.cod_iva ? String(l.cod_iva) : null,
      selected: false,
      net: round2(Number(l.importo_netto)),
    }));
}

export function selectedLines(lines: CreditLine[]): CreditLine[] {
  return lines.filter((l) => l.selected);
}

export function creditTotals(lines: CreditLine[]): CreditTotals {
  let net = 0;
  let vat = 0;
  for (const l of selectedLines(lines)) {
    net += l.net;
    vat += vatOf(l.net, l.aliquota);
  }
  net = round2(net);
  vat = round2(vat);
  return { net, vat, gross: round2(net + vat) };
}

/** Errores que bloquean el envío: nada elegido o importes fuera de rango. */
export function creditErrors(lines: CreditLine[]): string[] {
  const sel = selectedLines(lines);
  const errs: string[] = [];
  if (sel.length === 0) errs.push("none_selected");
  if (sel.some((l) => !(l.net > 0))) errs.push("net_zero");
  if (sel.some((l) => l.net > l.maxNet + 0.001)) errs.push("net_over");
  return errs;
}

/** Items del POST. Con tipo de IVA conocido se envía también el IVA calculado. */
export function buildCreditItems(lines: CreditLine[]): CreditItem[] {
  return selectedLines(lines).map((l) => {
    const item: CreditItem = {
      descriz: l.descriz,
      importo_netto: round2(l.net),
    };
    if (l.aliquota !== null && l.codIva) {
      item.aliquota_iva = l.aliquota;
      item.cod_iva = l.codIva;
      item.importo_iva = vatOf(l.net, l.aliquota);
    }
    return item;
  });
}

/** Importes ya acreditados y pendientes de una factura (api_credit_notes?remaining_for). */
export interface CreditRemaining {
  original_netto: number;
  original_iva: number;
  credited_netto: number;
  credited_iva: number;
  remaining_netto: number;
  remaining_iva: number;
}

export const REMAINING_TOLERANCE = 0.01;

export type RemainingIssue = "fully_credited" | "net_over" | "vat_over";

/**
 * Comprueba la nota de crédito contra lo pendiente de acreditar. Total: solo
 * se bloquea si ya no queda neto. Parcial: se bloquea si el neto o el IVA
 * elegidos superan lo pendiente (tolerancia 0,01). Sin datos → sin bloqueo
 * (el backend valida igualmente).
 */
export function remainingIssues(
  mode: "full" | "partial",
  totals: { net: number; vat: number },
  remaining: CreditRemaining | null,
): RemainingIssue[] {
  if (!remaining) return [];
  const issues: RemainingIssue[] = [];
  if (remaining.remaining_netto <= REMAINING_TOLERANCE / 2) {
    issues.push("fully_credited");
    return issues;
  }
  if (mode === "partial") {
    if (totals.net - remaining.remaining_netto > REMAINING_TOLERANCE + 1e-9)
      issues.push("net_over");
    if (totals.vat - remaining.remaining_iva > REMAINING_TOLERANCE + 1e-9)
      issues.push("vat_over");
  }
  return issues;
}
