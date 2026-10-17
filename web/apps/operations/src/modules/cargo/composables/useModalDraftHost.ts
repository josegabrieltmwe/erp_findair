import { computed } from "vue";
import type { ModalDraftHost } from "@shared/ui/form-modal-host";
import { useCargoStore } from "@cargo/stores/cargo.store";

/**
 * Adapts the cargo store to the shared {@link ModalDraftHost} contract consumed
 * by `@shared/ui/FormModal`. Bridges the two shape differences vs the courier
 * store: `commitDraft` returns a bare `bool` here (mapped to `{ ok, errors }`)
 * and validation errors live in a `Record` (`lastDraftErrors`, flattened to a
 * string[] for the frame's alert).
 */
export function useModalDraftHost(): ModalDraftHost {
  const store = useCargoStore();
  return {
    saving: computed(() => store.saving),
    draftActive: computed(() => store.draftActive),
    isDraftDirty: computed(() => store.isDraftDirty),
    draftErrors: computed<string[]>(() => Object.values(store.lastDraftErrors)),
    beginDraft: () => store.beginDraft(),
    commitDraft: async () => {
      const ok = await store.commitDraft();
      // On failure the store populated lastDraftErrors; surface them so the
      // FormModal can show the alert.
      return {
        ok,
        errors: ok ? [] : Object.values(store.lastDraftErrors),
      };
    },
    discardDraft: () => store.discardDraft(),
    clearDraft: () => store.clearDraft(),
  };
}
