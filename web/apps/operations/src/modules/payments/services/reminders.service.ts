/**
 * reminders.service — recordatorios de cobro. Endpoint `api_dunning`:
 *   GET ?op=settings          ajustes vigentes (modo, plazos, bloqueo)
 *   GET ?phase=all|notice|overdue   vista previa en seco (no envía nada)
 *   POST ?op=run {confirm:true, phase, client_ids}   envío real
 */
import { http } from "./http";

export type ReminderPhase = "all" | "notice" | "overdue";
export type ReminderType = "AVV5" | "SOLL" | "BLOCCO";
export type ReminderAction =
  | "would_send"
  | "compensated"
  | "no_recipient"
  | "no_template"
  | string;

export interface ReminderSettings {
  partner_id: number;
  date: string;
  mode: "DRY_RUN" | "ACTIVO" | string;
  block_enabled: boolean;
  notice_days: number;
  overdue_min_days: number;
  repeat_days: number;
  block_days: number;
}

export interface ReminderItem {
  partner?: number;
  client_id: number;
  rag_soc?: string;
  tipo: ReminderType | string;
  payments?: unknown[];
  total: number | string;
  credit?: number | string;
  would_block?: boolean;
  to?: string[];
  pec?: string | null;
  action: ReminderAction;
}

export interface ReminderTotals {
  notices?: number;
  overdue?: number;
  compensated?: number;
  would_block?: number;
  blocked?: number;
  sent?: number;
  send_errors?: number;
  no_recipient?: number;
  no_template?: number;
}

export interface ReminderResult {
  items: ReminderItem[];
  totals: ReminderTotals;
  warnings: string[];
}

interface Envelope<T> {
  success: boolean;
  data: T;
}

export interface ClientGroup {
  client_id: number;
  rag_soc: string;
  entries: ReminderItem[];
  total: number;
  would_block: boolean;
  recipients: string[];
  /** Hay algo que realmente se enviaría a este cliente. */
  sendable: boolean;
}

/** Agrupa las líneas del avance por cliente. */
export function groupByClient(items: ReminderItem[]): ClientGroup[] {
  const map = new Map<number, ClientGroup>();
  for (const it of items) {
    const id = Number(it.client_id);
    let g = map.get(id);
    if (!g) {
      g = {
        client_id: id,
        rag_soc: it.rag_soc || `#${id}`,
        entries: [],
        total: 0,
        would_block: false,
        recipients: [],
        sendable: false,
      };
      map.set(id, g);
    }
    g.entries.push(it);
    g.total += Number(it.total || 0);
    if (it.would_block || it.tipo === "BLOCCO") g.would_block = true;
    for (const r of [...(it.to ?? []), ...(it.pec ? [it.pec] : [])]) {
      if (!g.recipients.includes(r)) g.recipients.push(r);
    }
    if (it.action === "would_send") g.sendable = true;
  }
  const groups = [...map.values()];
  groups.forEach((g) => (g.total = Math.round(g.total * 100) / 100));
  return groups;
}

export function sendableIds(groups: ClientGroup[]): number[] {
  return groups.filter((g) => g.sendable).map((g) => g.client_id);
}

/** Envío activo y con permiso; en prueba (DRY_RUN) el servidor no enviaría nada. */
export function canSendReminders(
  settings: Pick<ReminderSettings, "mode"> | null,
  selectedCount: number,
  canCollect: boolean,
): boolean {
  return (
    !!settings && settings.mode === "ACTIVO" && selectedCount > 0 && canCollect
  );
}

export function isDryRun(
  settings: Pick<ReminderSettings, "mode"> | null,
): boolean {
  return !settings || settings.mode !== "ACTIVO";
}

export function buildRunBody(
  phase: ReminderPhase,
  clientIds: number[],
): { confirm: true; phase: ReminderPhase; client_ids: number[] } {
  return { confirm: true, phase, client_ids: clientIds };
}

function normalize(d: Partial<ReminderResult> | undefined): ReminderResult {
  return {
    items: d?.items ?? [],
    totals: d?.totals ?? {},
    warnings: d?.warnings ?? [],
  };
}

export const remindersApi = {
  async settings(signal?: AbortSignal): Promise<ReminderSettings> {
    const res = await http<Envelope<ReminderSettings>>("/api_dunning", {
      query: { op: "settings" },
      signal,
    });
    return res.data;
  },

  async preview(
    phase: ReminderPhase,
    signal?: AbortSignal,
  ): Promise<ReminderResult> {
    const res = await http<Envelope<Partial<ReminderResult>>>("/api_dunning", {
      query: { phase },
      signal,
    });
    return normalize(res.data);
  },

  /** Envío real. Una sola llamada, sin reintentos. */
  async run(
    phase: ReminderPhase,
    clientIds: number[],
  ): Promise<ReminderResult> {
    const res = await http<Envelope<Partial<ReminderResult>>>("/api_dunning", {
      method: "POST",
      query: { op: "run" },
      body: buildRunBody(phase, clientIds),
    });
    return normalize(res.data);
  },
};
