/** Tools of the backend contract that have a human label under `copilot.tools.<name>`. */
const KNOWN_TOOLS = [
  "listShipments",
  "trackShipment",
  "searchAddressBook",
  "getShipment",
  "listCargo",
  "countShipments",
  "getTrackingEvents",
  "getShipmentDocuments",
  "navigateTo",
  "proposeCreateShipment",
  "proposeEditCargoShipment",
  "proposeCancelCargoShipment",
  "proposeCancelExpressShipment",
] as const;

const KNOWN = new Set<string>(KNOWN_TOOLS);

/** i18n key for a tool name; unknown or non-string names fall back to the generic label, never the raw name. */
export function toolLabelKey(name: unknown): string {
  return typeof name === "string" && KNOWN.has(name)
    ? `copilot.tools.${name}`
    : "copilot.tools.unknown";
}

/** Distinct i18n keys, in order of first use. */
export function toolLabelKeys(
  tools: ReadonlyArray<{ name?: unknown }>,
): string[] {
  return [...new Set(tools.map((tool) => toolLabelKey(tool?.name)))];
}
