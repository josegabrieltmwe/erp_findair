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
  data_da?: string | null;
  data_a?: string | null;
  data_ritiro?: string | null;
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
  by_driver: Array<{ driver_id: number; driver_nome: string; pickup_count: number; total_colli: number; total_peso: number }>;
}

/** Manifiesto / borderò del autista (api_driver_manifest). */
export interface Manifest {
  date: string;
  driver: { id: number; nome: string; cell: string; tel: string };
  summary: { total_stops: number; total_colli: number; total_peso: number };
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

/** Config de presa recurrente por sede (api_pickup_recurring). */
export interface RecurringConfig {
  id_sede: number;
  presa_fissa: "N" | "S";
  id_autista: number;
  presa_ora?: string;
  presa_limite?: string;
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
  firma?: string;
  lat?: number | null;
  lng?: number | null;
  data_consegna?: string;
}
