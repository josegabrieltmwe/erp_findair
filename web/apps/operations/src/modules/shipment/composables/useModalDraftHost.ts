import { computed } from "vue";
import type { ModalDraftHost } from "@shared/ui/form-modal-host";
import { useShipmentStore } from "@shipment/stores/shipment.store";

/**
 * Adapts the courier shipment store to the shared {@link ModalDraftHost}
 * contract consumed by `@shared/ui/FormModal`. The shipment store already
 * matches the shape (commitDraft returns `{ ok, errors }`, clearDraft exists);
 * validation errors flow through commitDraft's return value, so `draftErrors`
 * is an empty reactive stub (the FormModal captures the returned errors
 * locally).
 */
export function useModalDraftHost(): ModalDraftHost {
  const store = useShipmentStore();
  return {
    saving: computed(() => store.saving),
    draftActive: computed(() => store.draftActive),
    isDraftDirty: computed(() => store.isDraftDirty),
    draftErrors: computed<string[]>(() => []),
    beginDraft: () => store.beginDraft(),
    commitDraft: () => store.commitDraft(),
    discardDraft: () => store.discardDraft(),
    clearDraft: () => store.clearDraft(),
  };
}
