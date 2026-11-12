import { ref, type Ref } from "vue";
import {
  BULK_MAX,
  classifyBulkError,
  sanitizeBulkIds,
  summarizeBulk,
  type BulkApiResult,
} from "./bulkRun";

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface BulkActionSpec {
  /** Etiqueta de la acción, ya traducida (sale en el diálogo de confirmación). */
  label: string;
  /** Hace la llamada al API con los ids YA saneados. */
  run: (ids: number[]) => Promise<BulkApiResult>;
  /** Mensaje de éxito total (ya traducido). */
  successMessage: (applied: number) => string;
  /** Mensaje de éxito parcial: algunas se omiten (ya traducido). */
  skippedMessage: (applied: number, skipped: number) => string;
  /** Mensaje si el API responde `success:false` sin detalle. */
  failedMessage: string;
  /** Acción destructiva: el diálogo usa el estilo de peligro. */
  danger?: boolean;
}

export interface UseBulkRunOptions<TRow extends { id: number }> {
  /** Filas que el listado tiene cargadas ahora (las que devolvió el API para este usuario). */
  rows: () => readonly TRow[];
  /** Selección de la tabla (se vacía de lo aplicado; lo omitido sigue marcado). */
  selected: Ref<TRow[]>;
  t: Translate;
  /** Diálogo de confirmación (`useConfirmStore().ask`). */
  confirm: (o: {
    title: string;
    message: string;
    confirmLabel?: string;
    variant?: "default" | "danger";
  }) => Promise<boolean>;
  toast: (kind: "success" | "warning" | "error", message: string) => void;
  /** Nombre corto de una fila para el diálogo («#123 · Cliente»). */
  describe?: (row: TRow) => string;
  /** Tras aplicar: quitar de la vista lo que sale de la cola, recargar, refrescar contadores. */
  afterApplied: (applied: number[]) => void | Promise<void>;
  max?: number;
}

/** Cuántos nombres se listan en la confirmación (el resto se resume como «y N más»). */
const NAMES_SHOWN = 12;

/**
 * Ejecuta una acción por lote con las salvaguardas del legado (`BULK._applica`) y las del SPA:
 * saneado de ids contra las filas cargadas, tope, confirmación con el número y los primeros nombres,
 * resultado por elemento (aplicadas / omitidas con motivo) y 403 tratado como «alguno no es tuyo».
 */
export function useBulkRun<TRow extends { id: number }>(
  opts: UseBulkRunOptions<TRow>,
) {
  const busy = ref(false);
  /** Omitidas del último lote (id → motivo), para pintarlas o filtrarlas. */
  const lastSkipped = ref<Array<{ id: number; reason: string }>>([]);
  const max = opts.max ?? BULK_MAX;

  async function execute(spec: BulkActionSpec): Promise<void> {
    if (busy.value) return;
    const byId = new Map(opts.rows().map((r) => [r.id, r] as const));
    const { ids, foreign, overLimit } = sanitizeBulkIds(
      opts.selected.value.map((r) => r.id),
      new Set(byId.keys()),
      max,
    );
    if (foreign > 0) {
      opts.toast("warning", opts.t("listing.bulk.foreign_dropped", { count: foreign }));
    }
    if (ids.length === 0) return;
    if (overLimit) {
      opts.toast("warning", opts.t("listing.bulk.capped", { max }));
    }

    const names = opts.describe
      ? ids
          .slice(0, NAMES_SHOWN)
          .map((id) => byId.get(id))
          .filter((r): r is TRow => !!r)
          .map((r) => `• ${opts.describe!(r)}`)
      : [];
    const more =
      ids.length > NAMES_SHOWN
        ? `\n${opts.t("listing.bulk.and_more", { count: ids.length - NAMES_SHOWN })}`
        : "";
    const ok = await opts.confirm({
      title: opts.t("listing.bulk.confirm_title"),
      message:
        opts.t("listing.bulk.confirm_message", {
          action: spec.label,
          count: ids.length,
        }) + (names.length ? `\n\n${names.join("\n")}${more}` : ""),
      confirmLabel: opts.t("listing.bulk.confirm_ok"),
      variant: spec.danger ? "danger" : "default",
    });
    if (!ok) return;

    busy.value = true;
    lastSkipped.value = [];
    try {
      const res = await spec.run(ids);
      if (!res.success) {
        opts.toast("error", res.error || spec.failedMessage);
        return;
      }
      const { applied, skipped } = summarizeBulk(ids, res);
      lastSkipped.value = skipped;
      // Lo aplicado sale de la selección; lo omitido se queda marcado para que se vea qué falta.
      const skippedIds = new Set(skipped.map((s) => s.id));
      opts.selected.value = opts.selected.value.filter((r) =>
        skippedIds.has(r.id),
      );
      opts.toast(
        skipped.length ? "warning" : "success",
        skipped.length
          ? spec.skippedMessage(applied.length, skipped.length)
          : spec.successMessage(applied.length),
      );
      await opts.afterApplied(applied);
    } catch (err) {
      const f = classifyBulkError(err);
      if (f.kind === "denied") {
        // 403: algún id no es del usuario. No se reintenta por subconjuntos (sería sondear ids ajenos).
        opts.toast("error", opts.t("listing.bulk.denied"));
        opts.selected.value = [];
        await opts.afterApplied([]);
      } else if (f.kind === "not_applicable") {
        lastSkipped.value = f.skipped;
        opts.toast(
          "warning",
          spec.skippedMessage(0, f.skipped.length || ids.length),
        );
      } else {
        opts.toast("error", f.message || spec.failedMessage);
      }
    } finally {
      busy.value = false;
    }
  }

  return { busy, lastSkipped, execute };
}
