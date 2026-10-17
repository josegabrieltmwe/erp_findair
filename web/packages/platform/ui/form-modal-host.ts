import type { ComputedRef, Ref } from "vue";

/**
 * Store-agnostic contract that {@link FormModal} needs from a host draft store.
 *
 * Both the courier (`shipment.store`) and cargo (`cargo.store`) stores expose a
 * draft buffer, but their raw signatures diverge (e.g. `commitDraft` returns
 * `bool` in cargo vs `{ ok, errors }` in courier, and cargo has no
 * `clearDraft`). Each app adapts its store to this shape with a tiny wrapper
 * (see `useModalDraftHost` in each app) so the frame stays identical.
 */
export interface ModalDraftHost {
  /** In-flight persistence flag (reactive). */
  saving: Ref<boolean> | ComputedRef<boolean>;
  /** A draft scope is currently open (reactive). */
  draftActive: Ref<boolean> | ComputedRef<boolean>;
  /** The open draft carries buffered edits (reactive). */
  isDraftDirty: Ref<boolean> | ComputedRef<boolean>;
  /** Validation messages from the last failed commit (reactive). */
  draftErrors: Ref<string[]> | ComputedRef<string[]>;

  /** Open a draft scope (idempotent / re-entrancy-guarded). */
  beginDraft(): void;
  /** Persist the whole buffer. Resolves with validation errors on failure. */
  commitDraft(): Promise<{ ok: boolean; errors: string[] }>;
  /** Revert buffered edits and close the scope. */
  discardDraft(): void;
  /** Close the scope WITHOUT reverting (buffer already resolved / empty). */
  clearDraft(): void;
}
