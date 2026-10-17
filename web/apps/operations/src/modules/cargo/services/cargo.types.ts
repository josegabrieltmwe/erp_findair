/**
 * Shape returned by `/bff/v1/unified_cargo_shipment?id=N` (Cargo CRUD
 * via Web_Cargo_Crud_Controller). All numeric fields come back as strings —
 * the SPA parses them where appropriate.
 *
 * Field names mirror the legacy `spedizioni_cargo` table so the SPA can map
 * sections 1:1 with `spedyc_form.php`.
 */
export interface CargoPackage {
  id: string | number;
  id_spedizione: string | number;
  id_cargo?: string | number;
  n_collo: string | number;
  peso: string;
  dim_a: string;
  dim_l: string;
  dim_p: string;
  volume?: string;
  stackable?: "S" | "N";
  turnable?: "S" | "N";
  segnac_cliente?: string | null;
  /**
   * Warehouse weighing timestamp (spedizioni_colli.data_pesatura). A real
   * date means the package was physically weighed in the warehouse; the zero
   * date ('0000-00-00 00:00:00') / null means the weight is client-declared.
   * Read-only signal surfaced in the colli table (legacy icollifll/pesata).
   */
  data_pesatura?: string | null;
}

export interface CargoChargeDetail {
  id: string | number;
  id_cargo: string | number;
  tipo: string;
  type?: string;
  somma?: "S" | "N";
  nome?: string;
  code?: string;
  costo_unit?: string;
  costo_min?: string;
  costo_max?: string;
  qty?: string;
  total?: string;
  valuta?: string;
  idunivoco_volo?: string;
}

export interface CargoFlightLeg {
  /** Index 1..5 (spedyc has up to 5 flight segments). */
  index: number;
  flight_num: string;
  flight_data: string;
  flight_airp: string;
  flight_datad: string;
  flight_aird: string;
}

export interface Cargo {
  id: string | number;
  id_cargo?: string | number;

  // Client / partner
  id_cliente?: string;
  id_sede?: string;
  id_partner?: string;
  id_partner_show1?: string;
  id_partner_show2?: string;
  id_anagr_titolare?: string;

  // Dates
  data_sped0?: string;
  data_sped1?: string;
  data_corriere?: string;
  data_volo_partenza?: string;
  data_volo_arrivo?: string;
  data_consegna_prevista?: string;
  consegna_stato?: string;
  consegna_data?: string;
  consegna_firma?: string;

  // Weight / volume
  peso?: string;
  pesor?: string;
  pesor_lk?: "S" | "N";
  peso_reale?: string;
  peso_fornit_reale?: string;
  colli?: string;
  coeff_volm?: string;
  /**
   * Client metric/imperial display preference, derived server-side from
   * `anagrafiche.metric_imperial` ('M' = metric, 'I' = imperial). NOT a
   * column on `spedizioni_cargo`; injected by Shipment_Management_Service.
   * Read-only on the SPA — there is no persistence path back.
   */
  metric_imperial?: "M" | "I";
  stackable?: "S" | "N";
  turnable?: "S" | "N";
  giacenza_gg?: string;

  // Cargo-specific flow
  terminal_part?: string;
  terminal_dest?: string;
  terminal_wrk?: string;
  vettore_tipo?: string;
  vettore_sigla?: string;
  vettore_id?: string;
  vettore_nome?: string;
  tipo_merce?: string;
  tipo_cons?: string;
  incoterm?: string;
  cargo_dazi?: string;

  // Flights (up to 5 legs encoded as flight_num1..5)
  flight_num1?: string;
  flight_num2?: string;
  flight_num3?: string;
  flight_num4?: string;
  flight_num5?: string;
  flight_data1?: string;
  flight_data2?: string;
  flight_data3?: string;
  flight_data4?: string;
  flight_data5?: string;
  flight_airp1?: string;
  flight_airp2?: string;
  flight_airp3?: string;
  flight_airp4?: string;
  flight_airp5?: string;
  flight_datad1?: string;
  flight_datad2?: string;
  flight_datad3?: string;
  flight_datad4?: string;
  flight_datad5?: string;
  flight_aird1?: string;
  flight_aird2?: string;
  flight_aird3?: string;
  flight_aird4?: string;
  flight_aird5?: string;

  // Handler
  handler_id?: string;
  handler_id_sede?: string;
  handler_data_limite?: string;
  handler_uscita?: string;
  handler_data_cons?: string;
  handler_note?: string;

  // Master AWB (número en spedizioni_cargo; los datos del documento MAWB —
  // emisor, agente IATA, firmas — viven en awb_cargo, gestionados por
  // CargoMawbFormV2, NO como columnas *_x10 de spedizioni_cargo).
  AWB_forn?: string | null;
  AWB_form_old?: string | null;

  // Customs
  dogana_imp?: string;
  id_valuta_dogana?: string;
  dogana_descri?: string;
  contenuto?: string;
  acc_export?: "S" | "N";
  acc_import?: "S" | "N";
  acc_dryice?: "S" | "N";
  acc_danggoods?: "S" | "N";
  acc_bancale?: "S" | "N";
  sdoganam_E?: "S" | "N";
  sdoganam_I?: "S" | "N";
  sdoganam_crm?: "S" | "N";
  sdoganam_istruz?: string | null;
  id_ag_export?: string;
  id_ag_import?: string;
  export_ag_mail?: string;
  import_ag_mail?: string;
  data_mail_ag_export?: string;
  data_mail_ag_import?: string;

  // Insurance
  assicuraz_imp?: string;
  id_valuta_assic?: string;

  // Offerta / quote workflow
  gestione?: "P" | "D" | "Q" | "" | string;
  offerta?: "S" | "N" | "" | string;
  offerta_txt?: string;

  // Money flows (cargo has 3 separate flows: export, import, volo)
  carico_export?: string;
  carico_import?: string;
  carico_volo?: string;
  costo_volo_previsto?: string;
  costo_volo_reale?: string;
  carico_extra?: string;
  // Per-flow price locks (spedizioni_cargo enum S/N) — when 'S' the auto-recalc
  // leaves that price untouched (legacy *_lk columns).
  carico_volo_lk?: "S" | "N";
  costo_volo_previsto_lk?: "S" | "N";
  // Currency of each money flow + its EUR rate (real columns change_valuta* /
  // change_rate*; the volo recalc watches these to re-trigger on FX edits).
  change_valuta?: string;
  change_rate?: string;
  change_valuta_costo?: string;
  change_rate_costo?: string;
  postfatt_txt?: string;
  id_fattura_a?: string;
  id_fattura_a2?: string;
  id_fattura_p?: string;
  id_valuta_cliente?: string;
  valuta_target?: string;

  // Linked express shipments
  id_spediz_part?: string;
  id_spediz_dest?: string;
  id_spediz_handl?: string;

  // Other flags
  noiva_art9?: "S" | "N";
  archiviata?: "S" | "N";
  controllata?: "S" | "N" | "O";
  badaddress?: "S" | "N";
  ricalcola_volo?: "S" | "N";
  crg_prepag?: "S" | "N";
  sendmail_p?: "S" | "N";
  sendmail_d?: "S" | "N";
  mail_mawb_cli?: string;

  // Status
  stato?: "A" | "D" | string;

  // Notes
  note?: string;
  note_x_destin?: string;
  note_operative?: string;

  // Webcargo rate id (linked rate selection)
  id_rate_webcargo?: string;

  // Top-level lookups (added by the controller / service for convenience)
  cliente?: string;
  ang_partner_id?: string;
  ang_partner_rag_soc?: string;
  ang_partner_name?: string;
  ang_partner_tipo?: string;
  ang_partner_vat?: string;
  ang_client_vat?: string;
  ang_sed_vat?: string;
  paese_dest?: string;
  paese_part?: string;
  paese_sed?: string;
  user_sigla?: string;
  RIF_cliente?: string;
  rif_cliente?: string;
  otp?: string;
  owner_user?: string;
}

export interface CargoCrudResponse {
  success: boolean;
  data?: Cargo;
  error?: string;
  error_id?: string;
  /**
   * Machine-readable failure code from the backend. `NOT_FOUND` means the
   * cargo does not exist, was soft-deleted (stato='O'), or the user has no
   * access — a permanent condition, so the UI must not offer a retry.
   */
  error_code?: string;
}
