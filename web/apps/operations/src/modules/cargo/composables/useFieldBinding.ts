import { reactive, watch } from "vue";
import { useCargoStore } from "@cargo/stores/cargo.store";
import type { Cargo } from "@cargo/services/cargo.types";

/**
 * Helper for "1 field → 1 commit on blur" bindings against the cargo store.
 * Mirrors the shipment_express implementation: returns a reactive object so
 * `binding.local` resolves to a value (not a Ref) in templates.
 */
export interface FieldBinding<T> {
  local: T;
  commit: () => Promise<void>;
}

/**
 * Quita los ceros de relleno de un decimal de BD.
 *
 * MySQL devuelve `DECIMAL(10,4)` como "250.0000", y ese texto llegaba tal cual
 * al input: el operador veia "250.0000" donde habia escrito "250". No es un
 * problema de precision — se conservan los decimales que el usuario SI puso,
 * asi que "0.453" se queda como "0.453" y solo se recorta el relleno.
 */
export function trimNumber(v: unknown): string {
  const raw = String(v ?? "");
  if (!/^-?\d*\.\d+$/.test(raw)) return raw; // no es decimal: intacto
  const out = raw.replace(/0+$/, "").replace(/\.$/, "");
  return out === "" || out === "-" ? "0" : out;
}

export function useFieldBinding<K extends keyof Cargo>(
  field: K,
  fallback: NonNullable<Cargo[K]>,
  options: { numeric?: boolean } = {},
): FieldBinding<NonNullable<Cargo[K]>> {
  const store = useCargoStore();

  const binding = reactive({
    local: fallback,
    async commit(): Promise<void> {
      const current = store.cargo?.[field];
      // Comparar en la MISMA forma: sin esto, "250" vs "250.0000" pareceria un
      // cambio y cada blur dispararia un PATCH inutil.
      const same = options.numeric
        ? trimNumber(binding.local) === trimNumber(current)
        : binding.local === current;
      if (same) return;
      await store.update({ [field]: binding.local } as Partial<Cargo>);
    },
  }) as FieldBinding<NonNullable<Cargo[K]>>;

  watch(
    () => store.cargo?.[field],
    (v) => {
      const next = v ?? fallback;
      binding.local = (
        options.numeric ? trimNumber(next) : next
      ) as NonNullable<Cargo[K]>;
    },
    { immediate: true },
  );

  return binding;
}
