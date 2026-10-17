import { reactive, computed, type ComputedRef } from "vue";

/**
 * Draft layer for the MAWB form.
 *
 * The form saves one field at a time on blur, and every PATCH response
 * refreshes the whole `awb_cargo` row. Without a draft layer that refresh
 * overwrites whatever the operator is typing in the *other* fields — the
 * "los campos se sobreescriben al terminar de teclear" bug.
 *
 * The rule is simply: a field the operator has touched and whose save has not
 * come back yet is owned by the operator, not by the server. `displayValue()`
 * returns the draft for such fields and the stored value for every other one.
 *
 * Values are kept as strings because that is what Vuetify inputs emit; callers
 * cast on commit (see `CargoMawbFormV2.onPatch`).
 */
export interface MawbFieldDraft {
  /** Value to bind to the input: the draft while dirty, else the stored value. */
  displayValue: (field: string, stored: unknown) => string;
  /** Record a local edit without persisting it. */
  setDraft: (field: string, value: string) => void;
  /** Drop the draft for a field (after a confirmed save, or on reload). */
  clearDraft: (field: string) => void;
  /** Drop every draft. */
  clearAll: () => void;
  /** True when the field has an unsaved local edit. */
  isDirty: (field: string) => boolean;
  /** True when any field in the set has an unsaved local edit. */
  anyDirty: (fields: readonly string[]) => boolean;
  /** Reactive list of the currently dirty field names. */
  dirtyFields: ComputedRef<string[]>;
}

export function useMawbFieldDraft(): MawbFieldDraft {
  // A reactive plain object rather than a Map: Vue 3 tracks Map mutations, but
  // a record keyed by field name keeps the template reads cheap and debuggable.
  const drafts = reactive<Record<string, string>>({});

  function displayValue(field: string, stored: unknown): string {
    if (field in drafts) return drafts[field];
    return stored == null ? "" : String(stored);
  }

  function setDraft(field: string, value: string): void {
    drafts[field] = value;
  }

  function clearDraft(field: string): void {
    delete drafts[field];
  }

  function clearAll(): void {
    for (const k of Object.keys(drafts)) delete drafts[k];
  }

  function isDirty(field: string): boolean {
    return field in drafts;
  }

  function anyDirty(fields: readonly string[]): boolean {
    return fields.some((f) => f in drafts);
  }

  const dirtyFields = computed<string[]>(() => Object.keys(drafts));

  return {
    displayValue,
    setDraft,
    clearDraft,
    clearAll,
    isDirty,
    anyDirty,
    dirtyFields,
  };
}
