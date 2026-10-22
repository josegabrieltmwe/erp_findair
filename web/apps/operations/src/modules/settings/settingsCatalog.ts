/**
 * Catálogo de tarjetas del hub de Settings moderno.
 *
 * Cada tarjeta navega a una ruta interna de `operations` (`routeName`,
 * `router.push`) que vive en `packages/platform/` o en `apps/operations/src/
 * modules/`. Ninguna tarjeta debe apuntar a `admin_config` — esa app es un
 * shell legacy aparte con su propio router hash-based, fuera del sistema de
 * cutover de `navTargets.ts` (ver comentario en `AdminTopBar.vue`: "admin
 * (admin_config) NO está migrado a operations → URL fija"). Si una función
 * todavía solo existe en `admin_config`, el lote correspondiente sigue
 * `inventariado`/pendiente en `docs/settings-parity-matrix.md` — no se debe
 * cerrar con un enlace externo como solución permanente (ver
 * `feedback_no_admin_config_links_in_settings` en memoria, 2026-08-15).
 *
 * `href` (navegación externa, unión discriminada más abajo) queda reservado
 * para destinos fuera del router de operations que NO sean `admin_config`
 * (p. ej. una integración de terceros), no como salida temporal para
 * funciones aún no migradas.
 */

import { type AiScope } from '@shared/ai_admin/composables/useAiScopes';

/** Campos comunes a toda tarjeta, sin importar su destino. */
interface SettingsCardBase {
  key: string;
  /** Clave i18n bajo `settings.settings.catalog.<key>.*` (title/description). */
  i18nKey: string;
  icon: string;
  /** Aliases legacy buscables (nombres de tile/pantalla tradicional) — se
   *  suman a título/descripción en la búsqueda de SettingsPage.vue. Se
   *  pueblan progresivamente en Fase 2 a medida que se documenta cada
   *  función legacy en `docs/settings-parity-matrix.md`. */
  aliases?: string[];
  /** Módulo moderno donde vive realmente la función, cuando no es un
   *  "settings" propiamente dicho (p. ej. Facturación, Importaciones). Se usa
   *  para mostrar "Abre en <módulo>" en vez de tratarla como configuración
   *  genérica. */
  targetModule?: string;
  /**
   * Subcategoría dentro del grupo/tab — clave de `SettingsGroupDef.subgroups`.
   * Rail vertical interno del tab (mismo patrón `group` que
   * `AnagraficaDetailPage.vue`/`extraTabs.ts`). Opcional: una tarjeta sin
   * `subgroup` cae en "otros" solo si el tab declara subgrupos; si el tab no
   * declara ninguno, se ignora y el tab sigue siendo una cuadrícula plana
   * (caso de `organization`, con una sola tarjeta).
   */
  subgroup?: string;
  /** Scope de IA (contrato ai-admin/1) que hace visible la tarjeta. Sin campo =
   *  visible para todos. Es solo UX; la API autoriza. */
  aiScope?: AiScope;
}

/** Navega SIN recarga (`router.push`): la sección ya vive en
 *  `packages/platform/` con una ruta montada en el router de operations. */
interface SettingsCardInternal extends SettingsCardBase {
  routeName: string;
  /** Params de ruta opcionales (p. ej. `{ id: '1' }` para la ficha de TMWE). */
  routeParams?: Record<string, string>;
  href?: never;
}

/** Navega por URL completa (recarga): la sección todavía solo vive en
 *  `admin_config` o en otra app fuera del router de operations. */
interface SettingsCardExternal extends SettingsCardBase {
  href: string;
  routeName?: never;
  routeParams?: never;
}

/** Unión discriminada: cada tarjeta declara EXACTAMENTE uno de
 *  `routeName` (interna) o `href` (externa) — nunca ambos, nunca ninguno.
 *  El objetivo es que un catálogo con los dos campos a la vez, o con
 *  ninguno, sea un error de TypeScript, no un bug descubierto en runtime. */
export type SettingsCardDef = SettingsCardInternal | SettingsCardExternal;

/** Subcategoría del rail vertical interno de un tab. */
export interface SettingsSubgroupDef {
  key: string;
  /** Clave i18n bajo `settings.settings.subgroups.*`. */
  i18nKey: string;
  icon: string;
}

export interface SettingsGroupDef {
  key: string;
  /** Clave i18n bajo `settings.settings.groups.*`. */
  i18nKey: string;
  /** Icono del tab horizontal (mismo patrón que HOME_SECTIONS en home_kpi_catalog.ts). */
  icon: string;
  /**
   * Subcategorías del rail vertical interno (orden = orden de aparición en
   * el rail). Un tab sin `subgroups` (o con una sola tarjeta) se renderiza
   * como cuadrícula plana, sin rail — mismo criterio que
   * `groupedTabs`/`TAB_GROUPS_ORDER` en AnagraficaDetailPage.vue: no forzar
   * jerarquía donde no aporta.
   */
  subgroups?: SettingsSubgroupDef[];
  items: SettingsCardDef[];
}

// Aliases: nombres del tile legacy tal como aparecían en `home_box_8.php`
// (ver docs/settings-parity-matrix.md, bloque A) — permiten que la búsqueda
// encuentre una tarjeta moderna por el nombre con el que un operador la
// conoce de siempre, aunque el título moderno sea distinto.
export const SETTINGS_CATALOG: SettingsGroupDef[] = [
  {
    key: 'master_data',
    icon: 'mdi-database-cog-outline',
    i18nKey: 'master_data',
    subgroups: [
      { key: 'geography', i18nKey: 'geography', icon: 'mdi-earth' },
      { key: 'rates_capacity', i18nKey: 'rates_capacity', icon: 'mdi-cash-register' },
      { key: 'carriers_tracking', i18nKey: 'carriers_tracking', icon: 'mdi-truck' },
      { key: 'anagrafica', i18nKey: 'anagrafica', icon: 'mdi-account-multiple-outline' },
    ],
    items: [
      {
        key: 'geographic_config',
        i18nKey: 'geographic_config',
        icon: 'mdi-earth',
        routeName: 'settings-geographic-config',
        subgroup: 'geography',
        aliases: [
          'Country Zone Settings',
          'Sub-zone Settings',
          'Countries groups',
          'Countries Setup',
        ],
      },
      // Fase 7 / L13: import masivo de zonas KO/RM de "Freschi e Schiavoni"
      // en aree_ko_remote. Backend NUEVO (Freschi_Remote_Area_Import_Controller).
      // Distinto del CRUD fila-a-fila que ya vive en geographic_config.
      {
        key: 'freschi_import',
        i18nKey: 'freschi_import',
        icon: 'mdi-file-upload-outline',
        routeName: 'settings-freschi-import',
        subgroup: 'geography',
        aliases: ['IT Freschi Import File', 'freschi_files'],
      },
      // Fase 7 / L14: import masivo DHL (aeropuertos + prioritarios).
      // Backend NUEVO para ambos sub-imports.
      {
        key: 'dhl_import',
        i18nKey: 'dhl_import',
        icon: 'mdi-truck-fast-outline',
        routeName: 'settings-dhl-import',
        subgroup: 'geography',
        aliases: ['DHL files Import', 'dhl_files', 'dhl_airport', 'dhl_prioritari'],
      },
      // Fase 2: UI ya existía (apps/operations/modules/pickup), sin ruta
      // montada ni tarjeta — SPA huérfana, ver
      // docs/reporte_migracion_pendiente_home_acciones_settings.md §3.
      {
        key: 'driver_zones',
        i18nKey: 'driver_zones',
        icon: 'mdi-map-marker-radius',
        routeName: 'settings-driver-zones',
        subgroup: 'geography',
        aliases: ['Driver pick-up Zones', 'zone_ritiri'],
        targetModule: 'pickup',
      },
      {
        key: 'price_lists',
        i18nKey: 'price_lists',
        icon: 'mdi-cash-register',
        routeName: 'price-lists',
        subgroup: 'rates_capacity',
        aliases: ['Price lists', 'Price List Setup'],
      },
      {
        key: 'carrier_services',
        i18nKey: 'carrier_services',
        icon: 'mdi-truck',
        routeName: 'settings-carrier-services',
        subgroup: 'rates_capacity',
        aliases: ['Our Services', 'Supplier Services', 'Country Zone Settings fornitore'],
      },
      {
        key: 'terminals',
        i18nKey: 'terminals',
        icon: 'mdi-airplane',
        routeName: 'settings-terminals',
        subgroup: 'rates_capacity',
        aliases: ['Cargo terminal'],
      },
      {
        key: 'good_types',
        i18nKey: 'good_types',
        icon: 'mdi-package-variant',
        routeName: 'settings-good-types',
        subgroup: 'rates_capacity',
        aliases: ['cod_stmerc'],
      },
      // Fase 4 / L09: tipos de palé por proveedor, CRUD sobre backend ya
      // existente (Bancali_Tipo_Controller). Alimenta pricing por palé.
      {
        key: 'pallet_types',
        i18nKey: 'pallet_types',
        icon: 'mdi-pallet',
        routeName: 'settings-pallet-types',
        subgroup: 'rates_capacity',
        aliases: ['Pallet type Setup', 'bancali'],
      },
      // Fase 4 / L10: escalones de palé por MPL, CRUD sobre backend ya
      // existente (Bancali_Mpl_Controller).
      {
        key: 'pallet_mpl',
        i18nKey: 'pallet_mpl',
        icon: 'mdi-pallet',
        routeName: 'settings-pallet-mpl',
        subgroup: 'rates_capacity',
        aliases: ['Pallet type Setup mpl', 'bancali_mpl', 'MPL'],
      },
      // Fase 4 / L21: catálogo de presets de rentabilidad (profit_preset),
      // backend nuevo scoped al partner de sesión.
      {
        key: 'profit_presets',
        i18nKey: 'profit_presets',
        icon: 'mdi-chart-line',
        routeName: 'settings-profit-presets',
        subgroup: 'rates_capacity',
        aliases: ['Profit presets', 'profit_preset'],
      },
      // Fase 4 / L08: catálogo de suplementos, CRUD sobre backend ya
      // existente (Supplementi_Controller) con advertencia auto_applied.
      {
        key: 'extracharges',
        i18nKey: 'extracharges',
        icon: 'mdi-plus-box-multiple',
        routeName: 'settings-extracharges',
        subgroup: 'rates_capacity',
        aliases: ['Extracharges Setup', 'supplementi'],
      },
      // Fase 4 / L12: bloqueos de carrier, CRUD sobre backend ya existente
      // (Blocco_Corrieri_Controller) con auditoría de campos.
      {
        key: 'carrier_blocks',
        i18nKey: 'carrier_blocks',
        icon: 'mdi-cancel',
        routeName: 'settings-carrier-blocks',
        subgroup: 'carriers_tracking',
        aliases: ['Carrier/Country Blocks', 'corrieri_blocchi', 'HOME8_241'],
      },
      // Migrada 2026-08-15 desde admin_config (features/tracking_codes/) a
      // packages/platform — reutiliza el mismo backend
      // (api_supplier_tracking_descr/api_supplier_tracking_err), sin
      // cambios. Antes: enlace externo a admin_config#/tracking-codes
      // (L30, Fase 2). Ya no debe haber ninguna tarjeta de Settings que
      // dependa de admin_config.
      {
        key: 'supplier_tracking_codes',
        i18nKey: 'supplier_tracking_codes',
        icon: 'mdi-truck-delivery-outline',
        routeName: 'settings-supplier-tracking-codes',
        subgroup: 'carriers_tracking',
        aliases: ['Supplier tracking details setup', 'fnt_track'],
      },
      // Fase 7 / L07: textos de estados de tracking público, backend NUEVO
      // (Tracking_Pubblico_Controller) deliberadamente restringido a
      // descr_*/note/stato — ver router/index.ts para el porqué.
      {
        key: 'tracking_statuses',
        i18nKey: 'tracking_statuses',
        icon: 'mdi-map-marker-radius-outline',
        routeName: 'settings-tracking-statuses',
        subgroup: 'carriers_tracking',
        aliases: ['Tracking details Setup', 'track_pub'],
      },
      // Fase 6 / L02: sectores comerciales de cliente, backend NUEVO
      // (Settori_Clienti_Controller), FK a fiscal_settings (L03).
      {
        key: 'client_sectors',
        i18nKey: 'client_sectors',
        icon: 'mdi-briefcase-outline',
        routeName: 'settings-client-sectors',
        subgroup: 'anagrafica',
        aliases: ['Commercial Fields', 'cod_stmerc'],
      },
      // Vista administrativa de anagráficas (partners y clientes, ambos con
      // el filtro por dueño disponible), sin `lockTipo` — el ítem del
      // sidebar "Clientes" (/clients, ver router/index.ts) SÍ lo fuerza a
      // 'C' server-side (api_anagrafica_clients, Anagrafica_Clients_Controller),
      // esta tarjeta deja el tipo libre y expone los tabs internos Todos/
      // Partners/Clientes (AnagraficaListPage.vue, `typeTab`). Mismo
      // componente compartido (AnagraficaListPage.vue / AnagraficaDetailPage.vue),
      // sin código de listado/ficha nuevo — solo un punto de entrada distinto.
      //
      // El aislamiento por partner sigue aplicando igual que en /clients:
      // Anagrafica_Service::list_anagrafiche() y
      // Abstract_Anagrafica_Controller::validate_anagrafica_access() ya
      // restringen a `id=partner_id OR id_anagr_titolare=partner_id` para
      // cualquier partner que no sea TMWE (id=1) — server-side, sin
      // importar por qué URL se llegó (incluido el filtro `id_anagr_titolare`
      // de esta vista: se aplica como AND sobre ese aislamiento). Esta
      // tarjeta NO abre una brecha.
      //
      // Nota de UX (no de seguridad): `requiresAdmin` (guard global de
      // /settings) depende de `is_admin`, que no es estrictamente sinónimo
      // de "es TMWE" — un admin no-TMWE vería esta tarjeta prometiendo
      // "todas las anagráficas" pero el backend igual lo limitaría a las
      // suyas. El dato nunca se filtra fuera de ámbito; solo la promesa
      // visual de "todas" no se cumpliría para ese caso.
      {
        key: 'anagrafica',
        i18nKey: 'anagrafica',
        icon: 'mdi-account-search-outline',
        routeName: 'settings-anagrafiche-admin',
        subgroup: 'anagrafica',
        aliases: ['Anagrafiche', 'Todas las anagrafiche', 'Partners', 'Clientes', 'anagr_list', 'Company Details'],
      },
      // Atajo dedicado a partners (tipo='P' forzado server-side, ver
      // router/index.ts `settings-partners-admin` / `lockTipo: 'P'` /
      // Anagrafica_Partners_Controller). El card "anagrafica" de arriba ya
      // permite filtrar a Partners vía su tab interno, pero este card da
      // acceso directo de un click, sin componente ni endpoint duplicado.
      {
        key: 'partners',
        i18nKey: 'partners',
        icon: 'mdi-account-group-outline',
        routeName: 'settings-partners-admin',
        subgroup: 'anagrafica',
        aliases: ['Partner', 'Partners list'],
      },
    ],
  },
  {
    key: 'billing',
    icon: 'mdi-cash-multiple',
    i18nKey: 'billing',
    subgroups: [
      { key: 'payments_banking', i18nKey: 'payments_banking', icon: 'mdi-bank' },
      { key: 'fiscal_it', i18nKey: 'fiscal_it', icon: 'mdi-file-document-outline' },
    ],
    items: [
      {
        key: 'issuer_bank_accounts',
        i18nKey: 'issuer_bank_accounts',
        icon: 'mdi-bank',
        routeName: 'settings-issuer-bank-accounts',
        subgroup: 'payments_banking',
        aliases: ['Bank management'],
      },
      {
        key: 'payment_config',
        i18nKey: 'payment_config',
        icon: 'mdi-credit-card',
        routeName: 'settings-payment-config',
        subgroup: 'payments_banking',
        aliases: ['Payments mode', 'Payment deadlines'],
      },
      // Fase 3 / L25: catálogo de monedas, GET/PUT sobre backend ya
      // existente (Valute_Controller). Ver docs/plan-cierre-settings-moderno.md.
      {
        key: 'currencies',
        i18nKey: 'currencies',
        icon: 'mdi-currency-usd',
        routeName: 'settings-currencies',
        subgroup: 'payments_banking',
        aliases: ['Currencies Setup', 'valute'],
      },
      // Fase 3 / L03: sectores fiscales italianos, CRUD sobre backend ya
      // existente (Studi_Settore_Controller).
      {
        key: 'fiscal_settings',
        i18nKey: 'fiscal_settings',
        icon: 'mdi-domain',
        routeName: 'settings-fiscal-settings',
        subgroup: 'fiscal_it',
        aliases: ['Italian fiscal Setting', 'cod_stsett'],
      },
      // Fase 3 / L04: plan contable italiano, CRUD sobre backend ya
      // existente (Piano_Conti_Controller).
      {
        key: 'chart_of_accounts',
        i18nKey: 'chart_of_accounts',
        icon: 'mdi-finance',
        routeName: 'settings-chart-of-accounts',
        subgroup: 'fiscal_it',
        aliases: ['Italian Piano dei conti', 'cod_conti', 'piano dei conti'],
      },
      // Fase 3 / L01: catálogo global de causali IVA, CRUD sobre backend ya
      // existente (Client_Causals_Controller). No la asignación por cliente.
      {
        key: 'vat_causals',
        i18nKey: 'vat_causals',
        icon: 'mdi-receipt-text-outline',
        routeName: 'settings-vat-causals',
        subgroup: 'fiscal_it',
        aliases: ['VAT customer options', 'anagr_causali_iva', 'causali IVA'],
      },
      // Fase 7 / L19: motor de determinación de IVA/SDI por partner
      // (fatture_causali_new). Backend ya existía completo y protegido
      // (Invoice_Causals_Controller). NO confundir con vat_causals (catálogo
      // global de descripciones, fatture_causali_clienti).
      {
        key: 'invoice_causals',
        i18nKey: 'invoice_causals',
        icon: 'mdi-gavel',
        routeName: 'settings-invoice-causals',
        subgroup: 'fiscal_it',
        aliases: ['fatt_causali', 'Causali fatturazione', 'IVA determination'],
      },
    ],
  },
  {
    key: 'integrations',
    icon: 'mdi-connection',
    i18nKey: 'integrations',
    subgroups: [
      { key: 'carrier_credentials', i18nKey: 'carrier_credentials', icon: 'mdi-key-variant' },
      { key: 'google_maps', i18nKey: 'google_maps', icon: 'mdi-map-marker' },
      { key: 'ai_integrations', i18nKey: 'ai_integrations', icon: 'mdi-robot-outline' },
    ],
    items: [
      {
        key: 'webcargo_key',
        i18nKey: 'webcargo_key',
        icon: 'mdi-key-variant',
        routeName: 'settings-webcargo-key',
        subgroup: 'carrier_credentials',
        aliases: ['API Keys WebCargo'],
      },
      {
        key: 'air_carrier_credentials',
        i18nKey: 'air_carrier_credentials',
        icon: 'mdi-airplane-cog',
        routeName: 'settings-air-carrier-credentials',
        subgroup: 'carrier_credentials',
        aliases: ['API Keys Courier'],
      },
      // Fase 6 / L20: estado del token OAuth de UPS, solo lectura, backend
      // NUEVO (Ups_Token_Status_Controller). Sin renovar/revocar.
      {
        key: 'ups_token_status',
        i18nKey: 'ups_token_status',
        icon: 'mdi-key-alert-outline',
        routeName: 'settings-ups-token-status',
        subgroup: 'carrier_credentials',
        aliases: ['Token UPS'],
      },
      {
        key: 'google_keys',
        i18nKey: 'google_keys',
        icon: 'mdi-map-marker',
        routeName: 'settings-google-keys',
        subgroup: 'google_maps',
        aliases: ['Google Maps API keys'],
      },
      // Fase 6 / L29: mapeo de campos de dirección de Google Places por país,
      // backend NUEVO (Googlemaps_Address_Fields_Admin_Controller). Distinto
      // de google_keys (esto es qué campo interpretar, no credenciales).
      {
        key: 'googlemaps_address_fields',
        i18nKey: 'googlemaps_address_fields',
        icon: 'mdi-map-marker-radius-outline',
        routeName: 'settings-googlemaps-address-fields',
        subgroup: 'google_maps',
        aliases: ['GoogleMap Address', 'admin_google_place_address_handler'],
      },
      // Credenciales de proveedores de IA (Anthropic/OpenAI) por partner, con
      // fallback global. Backend AI_Credentials_Admin_Controller; consumidas
      // por AI_Provider_Router, extracción de ficheros, Whisper, modelli,
      // clasificación de tracking y COD.
      {
        key: 'ai_credentials',
        i18nKey: 'ai_credentials',
        icon: 'mdi-brain',
        routeName: 'settings-ai-credentials',
        subgroup: 'ai_integrations',
        aliases: ['Anthropic', 'Claude', 'OpenAI', 'GPT', 'AI API keys', 'LLM', 'ElevenLabs', 'Voice assistant credentials', 'Copilot voice'],
      },
      // Estado del agente ConvAI public_form real + botón para empujar
      // prompt/tools versionados (Elevenlabs_Agent_Controller, admin-only).
      {
        key: 'elevenlabs_agents_admin',
        i18nKey: 'elevenlabs_agents_admin',
        icon: 'mdi-sync',
        routeName: 'settings-elevenlabs-agents-admin',
        subgroup: 'ai_integrations',
        aliases: ['ElevenLabs agent sync', 'Sync agent', 'public_form agent', 'Approve voice agents', 'Review partner agents'],
      },
      // Agente de voz PROPIO del partner (su cuenta de ElevenLabs, aprobado por
      // TMWE) -- autoservicio del partner. docs/agent-factory/09.
      {
        key: 'elevenlabs_partner_agent',
        i18nKey: 'elevenlabs_partner_agent',
        icon: 'mdi-account-voice',
        routeName: 'settings-elevenlabs-my-agent',
        subgroup: 'ai_integrations',
        aliases: ['My voice agent', 'Own ElevenLabs agent', 'Partner voice agent'],
      },
      // Administracion de IA (contrato ai-admin/1).
      {
        key: 'ai_center',
        i18nKey: 'ai_center',
        icon: 'mdi-chart-box-outline',
        routeName: 'settings-ai-center',
        subgroup: 'ai_integrations',
        aliases: ['AI usage','AI cost','Voice health','AI budgets','Token limits','AI feature flags','AI settings','AI audit log','Voice memory','Erase memory','My AI usage'],
      },
    ],
  },
  {
    key: 'communications',
    icon: 'mdi-forum-outline',
    i18nKey: 'communications',
    subgroups: [
      { key: 'b2b_templates', i18nKey: 'b2b_templates', icon: 'mdi-handshake' },
      // Separado de b2b_templates por su alto blast-radius (Fase 6 L26/L27):
      // ambas tablas alimentan en vivo el renderizado de texto del ERP
      // legacy, ninguna otra tarjeta de este tab comparte ese riesgo.
      { key: 'translations', i18nKey: 'translations', icon: 'mdi-translate' },
    ],
    items: [
      {
        key: 'b2b',
        i18nKey: 'b2b',
        icon: 'mdi-handshake',
        routeName: 'settings-b2b',
        subgroup: 'b2b_templates',
        aliases: ['Home Page information B2B'],
      },
      // Fase 6 / L05: tipos de tarea/caso B2B-CRM, CRUD sobre backend ya
      // existente (Crm_Type_Controller).
      {
        key: 'crm_types',
        i18nKey: 'crm_types',
        icon: 'mdi-format-list-bulleted',
        routeName: 'settings-crm-types',
        subgroup: 'b2b_templates',
        aliases: ['B2B Tasks Objects List', 'crm_tipi'],
      },
      // Avisos (banner) del sitio B2B con fecha de inicio/fin. Backend:
      // api_avviso_sito (módulo master_data).
      {
        key: 'site_notices',
        i18nKey: 'site_notices',
        icon: 'mdi-bullhorn-outline',
        routeName: 'settings-site-notices',
        subgroup: 'b2b_templates',
        aliases: ['B2B Alert', 'gestione_avviso_sito', 'avviso_sito'],
      },
      // Corregido 2026-08-15: existe una implementación COMPLETA y
      // funcional en apps/operations/src/modules/email_templates/ (ruta
      // "email_templates" ya montada, sin depender de admin_config ni de
      // su usePermissionsStore) — nunca había hecho falta el enlace
      // externo, era una SPA huérfana sin tarjeta de Settings apuntándole
      // (mismo patrón que driver_zones en Fase 2).
      {
        key: 'email_templates',
        i18nKey: 'email_templates',
        icon: 'mdi-email-edit-outline',
        routeName: 'email_templates',
        subgroup: 'b2b_templates',
        aliases: ['Modelli email'],
      },
      // Fase 5 / L17: plantillas de documentos/mensajes (modelli) — distinto
      // de email_templates (tabla y controlador propios: Modelli_Controller).
      {
        key: 'document_models',
        i18nKey: 'document_models',
        icon: 'mdi-file-document-outline',
        routeName: 'settings-document-models',
        subgroup: 'b2b_templates',
        aliases: ['Modelli', 'modelli.php'],
      },
      // Fase 6 / L26: editor de textos legacy del ERP (testi), CRUD sobre
      // backend ya existente (Testi_Controller). ⚠️ Alto blast-radius.
      {
        key: 'erp_texts',
        i18nKey: 'erp_texts',
        icon: 'mdi-translate',
        routeName: 'settings-erp-texts',
        subgroup: 'translations',
        aliases: ['testi.php'],
      },
      // Traducciones del sitio B2B (tabla testi) lado a lado, por grupo e
      // idioma — pantalla 'Translation B2B' legacy. Backend: api_master_texts.
      {
        key: 'b2b_texts',
        i18nKey: 'b2b_texts',
        icon: 'mdi-translate-variant',
        routeName: 'settings-b2b-texts',
        subgroup: 'translations',
        aliases: ['Translation B2B', 'testi_gest'],
      },
      // Fase 6 / L27: diccionario de traducciones ERP (testi_erp), backend
      // NUEVO (Testi_Erp_Controller). ⚠️ Alto blast-radius.
      {
        key: 'erp_dictionary',
        i18nKey: 'erp_dictionary',
        icon: 'mdi-book-alphabet',
        routeName: 'settings-erp-dictionary',
        subgroup: 'translations',
        aliases: ['Translation ERP', 'testi_erp'],
      },
    ],
  },
  {
    key: 'cargo',
    icon: 'mdi-airplane',
    i18nKey: 'cargo',
    subgroups: [
      { key: 'cargo_catalogs', i18nKey: 'cargo_catalogs', icon: 'mdi-format-list-bulleted-type' },
      { key: 'cargo_charges_group', i18nKey: 'cargo_charges_group', icon: 'mdi-cash-plus' },
    ],
    items: [
      // Fase 5 / L15: catálogo de aerolíneas/carriers de cargo, CRUD sobre
      // backend ya existente (Cargo_Carrier_Controller).
      {
        key: 'cargo_carriers',
        i18nKey: 'cargo_carriers',
        icon: 'mdi-airplane',
        routeName: 'settings-cargo-carriers',
        subgroup: 'cargo_catalogs',
        aliases: ['Cargo carriers', 'cargovett'],
      },
      // Fase 5 / L16: handlers de tierra por partner, CRUD sobre backend ya
      // existente (Handler_Controller).
      {
        key: 'cargo_handlers',
        i18nKey: 'cargo_handlers',
        icon: 'mdi-account-hard-hat',
        routeName: 'settings-cargo-handlers',
        subgroup: 'cargo_catalogs',
        aliases: ['Cargo handlers', 'handl'],
      },
      // Fase 5 / L18: agencias de aduana, CRUD sobre backend ya existente
      // (Agenzie_Doganali_Controller). Gatea en vivo el dropdown de despacho.
      {
        key: 'customs_agencies',
        i18nKey: 'customs_agencies',
        icon: 'mdi-office-building-outline',
        routeName: 'settings-customs-agencies',
        subgroup: 'cargo_catalogs',
        aliases: ['Agenzie doganali', 'agenzie'],
      },
      // Fase 7 / L23: catálogo de códigos de charge de carga aérea,
      // backend ya existente (Cargo_Charge_Controller). ⚠️ Alto blast-radius.
      {
        key: 'cargo_charges',
        i18nKey: 'cargo_charges',
        icon: 'mdi-cash-plus',
        routeName: 'settings-cargo-charges',
        subgroup: 'cargo_charges_group',
        aliases: ['Cargo details charge', 'cargovoci'],
      },
      // Fase 7 / L24: catálogo de descripciones de otros cargos AWB,
      // backend NUEVO (Awb_Other_Charge_Controller).
      {
        key: 'awb_other_charges',
        i18nKey: 'awb_other_charges',
        icon: 'mdi-cash-multiple',
        routeName: 'settings-awb-other-charges',
        subgroup: 'cargo_charges_group',
        aliases: ['AWB charges', 'awb_othercrg'],
      },
    ],
  },
  // Montaje de las secciones de identidad/seguridad que quedaron sin ruta al
  // retirar admin_config (ver router/index.ts, mismo comentario).
  // `administration`/`identity` ya tenían clave i18n reservada en los 5
  // locales antes de este montaje — se usan tal cual, no son invención de
  // esta pasada. Completo con las 6 restantes en la misma pasada
  // (internal_roles, module_permissions, authz_explain, mfa_setup,
  // scheduler, client_onboarding): sus claves i18n también estaban ya
  // preparadas y completas en los 5 locales, solo sin conectar. Quedan 3
  // huérfanas MÁS, no pedidas y sin i18n preparado (air_carrier_delegation,
  // air_provider_accounts, ewb_credentials) — fuera de esta pasada.
  {
    key: 'administration',
    icon: 'mdi-shield-account-outline',
    i18nKey: 'administration',
    subgroups: [{ key: 'identity', i18nKey: 'identity', icon: 'mdi-account-key-outline' }],
    items: [
      {
        key: 'users',
        i18nKey: 'users',
        icon: 'mdi-account-key-outline',
        routeName: 'settings-users',
        subgroup: 'identity',
      },
      {
        key: 'internal_roles',
        i18nKey: 'internal_roles',
        icon: 'mdi-account-group-outline',
        routeName: 'settings-internal-roles',
        subgroup: 'identity',
      },
      {
        key: 'module_permissions',
        i18nKey: 'module_permissions',
        icon: 'mdi-key-outline',
        routeName: 'settings-module-permissions',
        subgroup: 'identity',
      },
      {
        key: 'oauth_clients',
        i18nKey: 'oauth_clients',
        icon: 'mdi-api',
        routeName: 'settings-oauth-clients',
        subgroup: 'identity',
      },
      {
        key: 'oauth_roles',
        i18nKey: 'oauth_roles',
        icon: 'mdi-shield-key-outline',
        routeName: 'settings-oauth-roles',
        subgroup: 'identity',
      },
      {
        key: 'client_onboarding',
        i18nKey: 'client_onboarding',
        icon: 'mdi-account-plus-outline',
        routeName: 'settings-client-onboarding',
        subgroup: 'identity',
      },
      {
        key: 'authz_explain',
        i18nKey: 'authz_explain',
        icon: 'mdi-magnify-scan',
        routeName: 'settings-authz-explain',
        subgroup: 'identity',
      },
      {
        key: 'permission_audit',
        i18nKey: 'permission_audit',
        icon: 'mdi-history',
        routeName: 'settings-permission-audit',
        subgroup: 'identity',
      },
      {
        key: 'mfa_setup',
        i18nKey: 'mfa_setup',
        icon: 'mdi-two-factor-authentication',
        routeName: 'settings-mfa-setup',
        subgroup: 'identity',
      },
      {
        key: 'scheduler',
        i18nKey: 'scheduler',
        icon: 'mdi-clock-outline',
        routeName: 'settings-scheduler',
        subgroup: 'identity',
      },
    ],
  },
  {
    key: 'organization',
    icon: 'mdi-domain',
    i18nKey: 'organization',
    items: [
      // Ya embebible hoy: @shared/anagrafiche + operations ya tiene su propia
      // ruta `anagrafica-detail` (ver apps/operations/src/router/index.ts).
      {
        key: 'tmwe_anagrafica',
        i18nKey: 'tmwe_anagrafica',
        icon: 'mdi-domain',
        routeName: 'anagrafica-detail',
        routeParams: { id: '1' },
        aliases: ['Company Details'],
      },
    ],
  },
];
