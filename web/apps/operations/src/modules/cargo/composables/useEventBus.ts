/**
 * Tiny global event bus used to bridge the sticky action bar (in AppShell)
 * with the dialogs/handlers mounted in ShipmentDetailPage. Vue 3 has no
 * built-in event bus; this is the most compact implementation that stays
 * tree-shakable and avoids reaching for an external dep.
 */
type EventName =
  | "openChat"
  | "openProforma"
  | "openLdv"
  | "openSubcontracting"
  | "cancelShipment"
  | "emailMittente"
  // Cargo-specific:
  | "openMawb"
  | "openHandler"
  | "openMailAgenzie"
  | "cancelCargo";

type Handler = () => void;

const handlers = new Map<EventName, Set<Handler>>();

export const eventBus = {
  on(event: EventName, h: Handler): () => void {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event)!.add(h);
    return () => handlers.get(event)!.delete(h);
  },
  emit(event: EventName): void {
    handlers.get(event)?.forEach((h) => {
      try {
        h();
      } catch (err) {
        console.error("[eventBus]", event, err);
      }
    });
  },
};
