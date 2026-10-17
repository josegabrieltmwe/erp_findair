/**
 * Tipos del dominio CRM / pratiche (paridad crm_form.php).
 */

/** Estado de la pratica / evento: A aperta, C chiusa, L limbo (lunga attesa). */
export type StatoPratica = "A" | "C" | "L";

/** Follow-up flag de la cabecera: T to-do, C closed. */
export type LastStep = "T" | "C";

/** Canal de envío de un mensaje al cliente. */
export type MetodoInvio = "M" | "S" | "F" | "C";

/** Estado de envío de un docsstory. */
export type EsitoInvio = "WRK" | "OK" | "KO";

/** Cabecera de una pratica CRM (tabla crm). */
export interface CrmPratica {
  id: number;
  created?: boolean;
  id_anagrafica: number;
  id_contatto: number | null;
  id_fornitore: number | null;
  id_crm_tipo: number | null;
  oggetto: string;
  descriz: string;
  note_interne: string;
  data_open: string | null;
  data_next: string | null;
  last_step: LastStep | null;
  nome: string;
  email: string;
  tel: string;
  id_spedizione: number | null;
  rif_cliente: string;
  rif_fornitore: string;
  stato_pratica: StatoPratica;
  stato: string;
  // Campos derivados del JOIN (get_by_id / get_list)
  type?: string;
  typeEN?: string;
  sender_name?: string;
  sender_username?: string;
  /** rag_soc del cliente (JOIN anagrafiche en el listado). */
  cliente_rag_soc?: string | null;
  events?: CrmEvento[];
}

/** Atajos del listado legacy (winbody.php?pp=crm&ti=…). */
export type CrmListShortcut = "open" | "todo" | "alert";

/** Evento / avanzamento de una pratica (tabla crm_exe). */
export interface CrmEvento {
  id: number;
  id_crm: number;
  id_contatto: number | null;
  descriz: string;
  stato_pratica: StatoPratica;
  data: string;
  stato: string;
  sender_name?: string;
  sender_username?: string;
  insert_datetime?: string;
}

export interface CrmEventoUpdate {
  descriz?: string;
  stato_pratica?: StatoPratica;
  data?: string;
}

/** Tipo de pratica (tabla crm_tipi). */
export interface CrmTipo {
  id: number;
  descr: string;
  descrEN?: string;
  tipo_voce?: "P" | "I" | "T";
}

/** Mensaje saliente ligado a la pratica (docsstory, script_assoc='crm'). */
export interface CrmMessaggio {
  id: number;
  id_anagr: number;
  descriz: string;
  metodo: MetodoInvio;
  dest_msg: string;
  file1_nome: string | null;
  esito: EsitoInvio;
  OTP?: string;
  insert_datetime: string;
}

/** Envelope estándar de los endpoints ({success, data, message}). */
export interface SingleEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

/** Resultado paginado. */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

/** Payload para enviar un mensaje al cliente. */
export interface SendMessagePayload {
  id_crm: number;
  metodo?: MetodoInvio;
  dest_msg?: string;
  descriz?: string;
  text?: string;
  usabase?: "S" | "N";
}
