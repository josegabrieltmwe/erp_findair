/**
 * Shape returned by ajax_shipment_crud GET (with_packages, with_supplements,
 * with_files). All numeric fields come back as strings because mysqli returns
 * strings; the SPA parses them to numbers where appropriate.
 *
 * `destination_address` and `origin_address` use the modern API-friendly
 * field names returned by Shipment_Management_Service::get_shipment_complete
 * (name, address, city, country, airport, attention, email, tel) — NOT the
 * legacy column names. The legacy flat fields (dest_*, part_*) are also
 * present on the top-level Shipment for backward compatibility.
 */
/** The tab keys of the shipment detail page (drives v-tabs + @navigate). */
export type ShipmentTab =
  | "overview"
  | "addresses"
  | "packages"
  | "service"
  | "documents"
  | "activity";

export interface ShipmentAddress {
  id?: string | number;
  name?: string;
  /** Backend returns string[] when the address has been split; address_one_line is the joined view. */
  address?: string | string[];
  address_one_line?: string;
  cap?: string;
  city?: string;
  prov?: string;
  country?: string;
  country_name?: string;
  airport?: string;
  attention?: string;
  tel?: string;
  cell?: string;
  email?: string;
  /** Legacy aliases kept as optional — some endpoints still use them. */
  nome?: string;
  adress?: string;
  citta?: string;
  id_paese_iso?: string;
  attenzione?: string;
  mail?: string;
  dhl_airport?: string;
  dhl_units?: string;
  tipo?: "P" | "D" | string;
  sed_rag_soc?: string;
  sed_id?: string;
}

export interface ShipmentPackage {
  id: string | number;
  id_spedizione: string | number;
  n_collo: string | number;
  segnac_cliente?: string;
  peso: string;
  dim_a: string;
  dim_l: string;
  dim_p: string;
  volume?: string;
}

export interface ShipmentSupplement {
  id: string | number;
  id_spedizione: string | number;
  id_supplementi: string | number;
  attivo: "S" | "N";
  delta: "S" | "N";
  /** Generic price (legacy alias; equals fix_priceC for delta!='S', fix_priceF for delta='S'). */
  prezzo?: string | null;
  /** What the client is charged. null = no override, price it from the listino. */
  fix_priceC?: string | number | null;
  /** What the supplier costs us. null = no override, price it from the listino. */
  fix_priceF?: string | number | null;
  prezzo_lk?: "S" | "N";
  descrizione?: string;
  help?: string;
}

export interface ShipmentFile {
  id: string | number;
  id_spedizione: string | number;
  filename?: string;
  descrizione?: string;
  size?: string;
  insert_datetime?: string;
  show_partner?: "S" | "N";
}

/**
 * Top-level shipment payload. Field names mirror the legacy `spedizioni` table
 * (Italian) so the SPA can map blocks 1:1 with `spedy_form.php`.
 */
export interface Shipment {
  id: string | number;

  // Client / header
  id_cliente?: string;
  id_sede?: string;
  id_anagr_titolare?: string;
  cliente?: string;
  rif_cliente?: string;
  RIF_cliente?: string;

  // Dates
  data_sped0?: string;
  data_sped1?: string;
  data_corriere?: string;
  data_consegna_prevista?: string;
  consegna_data?: string;
  consegna_firma?: string;

  // Packages
  colli?: string;
  peso?: string;
  peso_tassato?: string;
  peso_reale?: string;
  peso_fornit?: string;
  peso_fornit_reale?: string;
  volume_cliente?: string;
  opz_par_doc?: "P" | "D" | "" | string;
  km_forza?: string;
  /** Measurement system: 'M' = metric (kg/cm), 'I' = imperial (lb/in). */
  metricsystem?: "M" | "I";
  /**
   * Display unit system derived from the client anagrafica (get_shipment_complete).
   * 'I' = imperial (lb/in), else metric (kg/cm). Read-only on the shipment: the DB
   * always persists metric; this only drives how the operator sees the units.
   */
  metric_imperial?: "M" | "I" | string;
  /** Weight measurement state: '0' = not weighted, '1' = weighted, '2' = counter-measured. */
  pesata?: "0" | "1" | "2" | string;

  // Accessories
  acc_aree_remote?: "S" | "N";
  acc_auto_fuori_misura?: string;
  acc_fermo_deposito?: "S" | "N";
  /** INT FK to a courier (anagrafiche scelta_forn BSI/BES), 0 = none. NOT a boolean. */
  acc_fissa_corriere?: number | string;
  acc_dryice?: "S" | "N";
  acc_danggoods?: "S" | "N";
  acc_bancale?: "S" | "N";

  // Contrassegno
  contras_imp?: string;
  contras_incasso?: "S" | "N" | string;
  contras_data_inc?: string;
  contras_id_report?: string;
  id_contrassegno?: string;
  id_valuta_contras?: string;
  // Sigla ISO de id_valuta_contras resuelta por el backend (LEFT JOIN valute).
  // El binding del autocomplete lee esta y escribe la sigla en id_valuta_contras.
  contras_valuta?: string;

  // Insurance
  assicuraz_imp?: string;
  id_valuta_assic?: string;
  ass_minimo_client?: string;
  ass_minimo_partner?: string;

  // Customs
  dogana_imp?: string;
  id_valuta_dogana?: string;
  dogana_descri?: string;
  dogana_valuta?: string;
  contenuto?: string;

  // Pickup schedule
  presa_tipo?: "T" | "S" | "0" | string;
  presa_stato?: string;
  presa_numero?: string;
  presa_dalle?: string;
  presa_alle?: string;
  presa_fissa?: "S" | "N";
  presap_dalle?: string;
  presap_alle?: string;
  presa_note?: string;
  presa_invio_mitt?: string;
  presa_fornitore?: "S" | "N";
  id_presa_p?: string;
  id_presa_c?: string;
  consegna_danoi?: "S" | "N";

  // Service & fornitore
  id_servizio?: string;
  id_servizio_fornitore?: string;
  cod_cliente_fornitore?: string;
  id_fornitore?: string;
  servizio?: string;
  service?: string;
  AWB_forn?: string;
  AWB_form_old?: string;
  AWB_id_forn?: string;
  awb?: string;

  // Amounts
  carico?: string;
  carico_lk?: "S" | "N";
  fuel_surc?: string;
  fuel_surc_cst?: string;
  costo?: string;
  costo_previsto_lk?: "S" | "N";
  fornitore_lk?: "S" | "N";
  costor?: string;
  /** Costo reale fattura fornitore (post-booking reconciliation). */
  costo_reale?: string;
  /** Fuel surcharge sul costo reale (post-booking). */
  post_fuel_surc?: string;
  postfatt?: string;
  /** Free-text description of post-invoice surcharge (legacy: postfatt_txt). */
  postfatt_txt?: string;
  /** Giacenza reconciliation amount (legacy: giac_ricons). */
  giac_ricons?: string;
  controllo_fatt?: string;
  checkforn?: string;
  giac_cant?: string;
  crm_cant?: string;
  id_servforn_eco?: string;
  costo_daverif?: "S" | "N";

  // Invoicing
  id_fattura_a?: string;
  id_fattura_a2?: string;
  id_fattura_p?: string;

  // Status flags
  noiva_art9?: "S" | "N";
  archiviata?: "S" | "N";
  // 'O' = "Offer" (legacy whecmx filters `controllata != 'O'`; see
  // Kpi_Definition_Registry). The flags box exposes it as a select option.
  controllata?: "S" | "N" | "O";
  prioritario?: "S" | "N";
  badaddress?: "S" | "N";

  // Notes
  note?: string;
  note_x_destin?: string;
  note_operative?: string;

  // Delivery
  consegna_stato?: string;
  descr_ita?: string;
  descr_eng?: string;
  descr_spa?: string;
  descr_fra?: string;

  // Currencies
  anag_tit_valuta?: string;

  // Computed / flattened lookup helpers (added by the controller for the SPA)
  cliente_label?: string;
  sed_label?: string;
  sed_rag_soc?: string;
  ang_partner_id?: string;
  ang_partner_rag_soc?: string;
  ang_partner_name?: string;
  ang_partner_tipo?: string;
  ang_partner_vat?: string;
  ang_client_vat?: string;
  ang_sed_vat?: string;
  paese_sed?: string;
  paese_sed_en?: string;
  paese_part?: string;
  paese_part_en?: string;
  paese_dest?: string;
  paese_dest_en?: string;
  user_sigla?: string;

  // Sede & sede partner flat fields (for non-triangulation pickup)
  sed_id?: string;
  sed_indirizzo?: string;
  sed_cap?: string;
  sed_citta?: string;
  sed_prov?: string;
  sed_id_paese_iso?: string;
  sed_dhl_airport?: string;
  sed_dhl_units?: string;
  sed_tel?: string;
  sed_mail?: string;
  sed_cargo_airport?: string;
  sed_cargo_port?: string;

  // Cargo linkage
  id_cargo?: string;
  cargo_pickup?: "S" | "N";
  cargo_to_handler?: "S" | "N";

  // Partner show
  id_partner_show1?: string;
  id_partner_show2?: string;

  // Flags / misc
  delivered_mail?: "S" | "N";
  erp_partner?: "S" | "N";
  uses_sede_address?: boolean;
  level?: string;
  otp?: string;
  owner_user?: string;

  // Nested addresses
  origin_address?: ShipmentAddress | null;
  destination_address?: ShipmentAddress | null;
  part?: ShipmentAddress | null;
  dest?: ShipmentAddress | null;
  /** Convenience flat fields some controllers add for the destination address. */
  dest_id?: string;
  dest_address?: string;
  dest_attenzione?: string;
  dest_cap?: string;
  dest_citta?: string;
  dest_dhl_airport?: string;
  dest_dhl_units?: string;
  dest_id_paese_iso?: string;
  dest_mail?: string;
  dest_prov?: string;
  dest_tel?: string;
  dest_tipo?: string;
  /** Convenience flat fields for the pickup (mittente) address. */
  part_id?: string;
  part_address?: string;
  part_attenzione?: string;
  part_cap?: string;
  part_citta?: string;
  part_dhl_airport?: string;
  part_dhl_units?: string;
  part_id_paese_iso?: string;
  part_mail?: string;
  /** Pickup cellular phone (distinct from landline `part_tel`). */
  part_cell?: string;
  part_prov?: string;
  part_tel?: string;
  part_tipo?: string;

  // Relations (when with_packages/with_supplements/with_files = true)
  packages_from_db?: ShipmentPackage[];
  // Backend serializa esto como objeto keyed por PK `id`
  // (Abstract_Spedizioni::get_spedizione_complete usa array_column(..., null, 'id')).
  // El store normaliza a array via Object.values — los consumidores
  // siempre reciben ShipmentSupplement[] al leer `store.supplements`.
  supplements?: ShipmentSupplement[] | Record<string, ShipmentSupplement>;
  supplement_ids?: number[];
  files?: ShipmentFile[];
  /** Arbitrary shipment metadata (spedizioni_meta), e.g. awb_reso_tnt. */
  metadata?: Record<string, unknown>;
}

/**
 * Receipt returned by `ajax_shipment_crud` on update.
 *
 * NOT the updated row: the backend answers with what it DID
 * (`Shipment_Management_Service::update_shipment`), never echoing the written
 * columns. Typing `data` as `Shipment` invited callers to merge it as if it
 * were fresh state — which silently kept stale values for any field cleared to
 * an empty string (see persistUpdate in shipment.store).
 */
export interface ShipmentUpdateReceipt {
  updated?: boolean;
  id?: number;
  /** Fields outside the whitelist — accepted by the request, never written. */
  ignored_fields?: string[];
  /** Fields refused because the shipment is price-locked (carico_lk='S'). */
  blocked_by_lock?: string[];
  recalculated?: Record<string, unknown> | null;
  side_effects?: unknown[];
  validation_errors?: string[];
}

/** GET `ajax_shipment_crud` — `data` IS the shipment row. */
export interface ShipmentCrudResponse {
  success: boolean;
  data?: Shipment;
  error?: string;
  error_id?: string;
}

/** POST `ajax_shipment_crud` (update) — `data` is the receipt, not the row. */
export interface ShipmentUpdateResponse {
  success: boolean;
  data?: ShipmentUpdateReceipt;
  error?: string;
  error_id?: string;
}
