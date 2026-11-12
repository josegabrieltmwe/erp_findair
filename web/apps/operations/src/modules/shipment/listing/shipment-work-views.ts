import type { ListingWorkView } from "@shared/listing/types";

export const SHIPMENT_WORK_VIEWS = [
  {
    id: "standard",
    labelKey: "listing.work_view.standard",
    columns: [
      "id",
      "cliente",
      "awb",
      "origin",
      "destination",
      "created",
      "packages",
      "weight",
      "status",
      "actions",
    ],
    bulkActions: ["tracking", "control", "archive"],
  },
  {
    id: "tracking",
    labelKey: "listing.work_view.tracking",
    columns: [
      "id",
      "awb",
      "destination",
      "created",
      "cliente",
      "status",
      "actions",
    ],
    bulkActions: ["tracking", "control", "archive"],
    suggestedBulkAction: "tracking",
  },
  {
    id: "control",
    labelKey: "listing.work_view.control",
    columns: [
      "id",
      "cliente",
      "origin",
      "destination",
      "packages",
      "weight",
      "status",
      "actions",
    ],
    bulkActions: ["control", "archive"],
    suggestedBulkAction: "control",
  },
] as const satisfies readonly ListingWorkView[];

export function shipmentDefaultWorkView(listingType: string): string {
  if (listingType === "in_transit") return "tracking";
  return "standard";
}

/**
 * Cola de trabajo con la que se abre el listado para el personal TMWE (equivale al `dacontr` del legado:
 * las expediciones propias aún sin controlar). Debe ser un tipo que `normalisedType` acepte (clave del
 * catálogo KPI de la home); un test lo comprueba.
 */
export const DEFAULT_SHIPMENT_QUEUE = "dacontr";

/**
 * Acciones por lote del listado de expediciones. Mismas acciones que el legado (`BULK_ACTIONS`), pero
 * ejecutadas por el API en una sola petición (`api_shipment_bulk`, `api_cod_reconciliation`).
 */
export type ShipmentBulkActionId =
  | "control"
  | "depart"
  | "transit"
  | "deliver"
  | "archive"
  | "tracking"
  | "pickup_send"
  | "pickup_confirm"
  | "pickup_picked"
  | "pickup_failed"
  | "pickup_reset"
  | "cod_collected"
  | "cod_bank"
  | "cod_annul";

const PICKUP_ACTIONS: readonly ShipmentBulkActionId[] = [
  "pickup_send",
  "pickup_confirm",
  "pickup_picked",
  "pickup_failed",
  "pickup_reset",
];
const COD_ACTIONS: readonly ShipmentBulkActionId[] = [
  "cod_collected",
  "cod_bank",
  "cod_annul",
  "control",
];

/** Colas de recogida del fornitore (legado `PK`). `preseint` es de nuestros conductores: abre con «controlar». */
const PICKUP_QUEUES: ReadonlySet<string> = new Set([
  "presefornN",
  "presefornW",
  "presefornF",
  "presefornS",
  "presefornQ",
  "presefornX",
  "pickup_status",
]);
const COD_QUEUES: ReadonlySet<string> = new Set([
  "codcliprnt",
  "codcliprnt2",
  "cod_pending",
]);
/** Listas «pronto a salir» (legado `contrnopart`/`spedoggi`). */
const DEPART_QUEUES: ReadonlySet<string> = new Set(["contrnopart", "spedoggi"]);
/** Listas de envíos ya salidos (legado `OUT`). */
const OUT_QUEUES: ReadonlySet<string> = new Set([
  "in_transit",
  "intransit",
  "intransit2",
  "indelay",
  "deipartn2",
  "nogiacprobl",
]);

/**
 * Acciones disponibles según la cola abierta. La primera es la sugerida (la «por defecto» del cajón en el
 * legado: `bulkOptionsFor`). El API decide qué se aplica de verdad: aquí solo se ofrece lo que tiene sentido
 * en cada cola.
 */
export function shipmentBulkActionsFor(
  type: string,
): readonly ShipmentBulkActionId[] {
  if (type === "offert") return ["archive"]; // una oferta se confirma desde su ficha, no se «controla» en bloque
  if (PICKUP_QUEUES.has(type)) return [...PICKUP_ACTIONS, "tracking"];
  if (type === "preseint") return ["control", ...PICKUP_ACTIONS, "tracking"];
  if (COD_QUEUES.has(type)) return [...COD_ACTIONS, "tracking"];
  if (DEPART_QUEUES.has(type))
    return ["depart", "transit", "archive", "tracking"];
  if (OUT_QUEUES.has(type)) return ["transit", "deliver", "archive", "tracking"];
  return ["control", "depart", "archive", "tracking"]; // IN / resto: ricezione y control
}

/**
 * ¿Esta acción saca el registro de la cola abierta? Solo para el feedback inmediato (quitar la fila sin
 * esperar); la relectura del API es la que manda, así que un falso negativo solo retrasa el feedback.
 */
export function actionLeavesQueue(
  type: string,
  action: ShipmentBulkActionId,
): boolean {
  if (action === "archive") return true;
  if (action === "control") return type === "dacontr" || type === "dactrnote";
  if (action === "depart") return DEPART_QUEUES.has(type);
  if (action === "pickup_send") return type === "presefornN";
  if (action === "pickup_confirm") return type === "presefornW";
  if (action === "pickup_failed")
    return type === "presefornN" || type === "presefornW";
  if (action === "pickup_reset") return type === "presefornF";
  return false;
}
