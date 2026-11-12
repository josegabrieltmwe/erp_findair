/**
 * Tipos del módulo "presa propia" (pickup con autistas internos).
 * Reflejan las respuestas de los 10 endpoints Web_* (tabla `prese`,
 * `autisti_zone`, `sedi_interne`, giro/manifiesto/POD).
 */

/** Envelope estándar del backend modern. */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  error_code?: string;
}

export interface Paginated<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
    from: number;
    to: number;
  };
}

/** Una fila de la tabla `prese`. */
export interface Pickup {
  id: number;
  id_sede: number;
  id_contatti: number; // autista asignado (0 = sin asignar)
  data: string; // datetime de la cita
  address_sped: "N" | "S"; // N=en sede, S=en dirección de la spedizione
  presa_fissa: "N" | "S" | "R"; // R=fija removida del día
  affidata: "N" | "S"; // entregada al autista
  n_colli: number | null;
  peso: number | null;
  note: string | null;
  stato: "A" | "O";
  autogen?: "N" | "S";
  /** Día en que se hizo el ritiro (fecha cero o nula = aún sin hacer). */
  data_ritiro?: string | null;
  /** Expediciones activas cuyo `id_presa_p` es esta presa (solo en el listado). */
  shipment_ids?: number[];
  insert_datetime?: string;
  insert_user?: number;
  insert_IP?: string;
}

export interface PickupFilters {
  id_sede?: number | null;
  id_contatti?: number | null;
  affidata?: "N" | "S" | null;
  presa_fissa?: "N" | "S" | "R" | null;
  autogen?: "N" | "S" | null;
  /** Un solo día (alias `date` en el API); no se combina con `data_da`/`data_a`. */
  data?: string | null;
  data_da?: string | null;
  data_a?: string | null;
  data_ritiro?: string | null;
}

/** Resultado por presa de una asignación o liberación masiva. */
export interface BulkResultItem {
  pickup_id: number;
  ok: boolean;
  error?: string | null;
}

export interface BulkResult {
  assigned: number;
  failed: number;
  results: BulkResultItem[];
}

export type PickupWritePayload = Partial<
  Pick<
    Pickup,
    | "id_sede"
    | "id_contatti"
    | "data"
    | "address_sped"
    | "presa_fissa"
    | "affidata"
    | "n_colli"
    | "peso"
    | "note"
  >
>;

/** Un día del calendario (payload de api_pickup_calendar). */
export interface CalendarDay {
  date: string;
  pickups: Pickup[];
  count: number;
  assigned: number;
  not_assigned: number;
}

export interface CalendarResult {
  date_from: string;
  date_to: string;
  driver_id: number | null;
  total: number;
  days: number;
  calendar: CalendarDay[];
}

/** Autista disponible (para asignación). */
export interface Driver {
  id: number;
  nome: string;
  pickup_count?: number;
  cell?: string;
  tel?: string;
}

/** Overview diario del panel operativo (api_operations_panel). */
export interface OperationsOverview {
  date: string;
  pickups: {
    total: number;
    assigned: number;
    unassigned: number;
    fixed: number;
    completed: number;
  };
  giacenze: {
    total_open: number;
    new_today: number;
    overdue: number;
    awaiting_client: number;
  };
  deliveries: { pending: number };
}

/** Una parada del giro del autista (api_driver_routes build_daily_route). */
export interface RouteStop {
  order: number;
  pickup_id: number;
  pickup_datetime: string;
  n_colli: number | null;
  peso: number | null;
  note: string | null;
  affidata: "N" | "S";
  presa_fissa: "N" | "S" | "R";
  sede: {
    id: number;
    label: string;
    indirizzo: string;
    citta: string;
    prov: string;
    cap: string;
    lat: number | null;
    lng: number | null;
    presa_ora?: string;
    presa_limite?: string;
  };
  cliente: { id: number; ragsoc: string };
  /** `R` ritiro, `C` entrega. Ausente en un API anterior a T-21 (se toma como `R`). */
  kind?: "R" | "C";
  /** Dirección real donde parar: la sede o la de la expedición (parada a domicilio). */
  direccion?: StopAddress;
  /** Expediciones de la parada, con su LDV (código de barras). */
  shipments?: ManifestShipment[];
  address_sped?: "N" | "S";
}

export interface StopAddress {
  origen: "sede" | "expedicion";
  nombre?: string;
  indirizzo?: string;
  cap?: string;
  citta?: string;
  prov?: string;
  paese?: string;
  tel?: string;
}

export interface ManifestShipment {
  id: number;
  /** Código de barras de la LDV (id con relleno a 10 cifras). */
  ldv: string;
  ref_cliente?: string | null;
  colli: number;
  peso: number;
  /** Importe a cobrar en la entrega (0 = sin contrassegno). */
  contrassegno: number;
  contrassegno_incasso?: string | null;
}

export interface DriverRoute {
  driver_id: number;
  date: string;
  stops: RouteStop[];
  total: number;
}

export interface RouteDaySummary {
  date: string;
  total_pickups: number;
  assigned: number;
  unassigned: number;
  total_colli: number;
  total_peso: number;
  by_driver: Array<{
    driver_id: number;
    driver_nome: string;
    pickup_count: number;
    total_colli: number;
    total_peso: number;
  }>;
}

export interface ManifestSummary {
  total_stops: number;
  total_colli: number;
  total_peso: number;
  /** Campos añadidos por T-21; opcionales para un API anterior. */
  total_pickups?: number;
  total_deliveries?: number;
  total_contrassegno?: number;
  shipments_colli?: number;
  shipments_peso?: number;
}

/** Manifiesto / borderò del autista (api_driver_manifest). */
export interface Manifest {
  date: string;
  driver: { id: number; nome: string; cell: string; tel: string };
  summary: ManifestSummary;
  stops: RouteStop[];
}

/** Zona CAP→autista (autisti_zone). */
export interface DriverZone {
  id: number;
  cap: string;
  id_contatto: number;
  nome_autista?: string;
}

export interface Province {
  id_provincia: string;
}

/** Opciones de la generación diaria de fijas (T-11). */
export interface GenerateDailyOptions {
  dry_run?: boolean;
  include_non_business_days?: boolean;
}

export interface GenerateDailyResult {
  date: string;
  generated: number;
  skipped: number;
  /** Los campos siguientes los añade T-11; opcionales para un API anterior. */
  invalid?: number;
  skipped_courier?: number;
  skipped_rest_day?: number;
  /** Sedes cuyo día de la semana no está en `presa_dias`. */
  skipped_weekday?: number;
  calendar_errors?: number;
  locked?: boolean;
  dry_run?: boolean;
}

/** Resultado por CAP de un guardado en lote de zonas. */
export interface ZoneSaveItem {
  cap: string;
  id_contatto: number;
  ok: boolean;
  error?: string;
}

/** Fila de `api_operations_panel?view=drivers`. */
export interface OperationsDriverRow {
  driver_id: number;
  driver_name: string;
  pickup_count: number;
  total_colli: number;
  total_peso: number;
}

/** Fila de `api_operations_panel?view=alerts` (giacenza abierta sobre el umbral). */
export interface GiacenzaAlert {
  id?: number;
  id_spedizione?: number;
  ldv?: number | string | null;
  dest_nome?: string | null;
  data_open?: string | null;
}

/** Config de presa recurrente por sede (api_pickup_recurring). */
export interface RecurringConfig {
  id_sede: number;
  presa_fissa: "N" | "S";
  id_autista: number;
  presa_ora?: string;
  presa_limite?: string;
}

/** Respuesta de api_driver_pod / api_driver_delivery (campos aditivos). */
export interface PodResult {
  signature_file_id?: number | null;
  state_updated?: boolean;
  warnings?: Array<"gps_no_valido" | "firma_imagen_no_almacenada" | string>;
}

/** Resultado de verify_ldv (api_driver_delivery GET). */
export interface LdvLookup {
  id: number | null;
  ldv: string;
  destinatario: string;
  indirizzo: string;
  citta: string;
  cap: string;
  stato_sped: string;
}

/** Payload de registro de entrega / POD (api_driver_pod POST). */
export interface PodPayload {
  ldv: string;
  esito: string; // 'C' consegnato, 'M' mancata, …
  note?: string;
  /** Imagen de la firma (data URI png/jpg); el API la guarda como documento. */
  firma?: string;
  /** Nombre de quien firma. */
  firma_nome?: string;
  lat?: number | null;
  lng?: number | null;
  data_consegna?: string;
}
