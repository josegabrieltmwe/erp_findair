/**
 * Catálogo ESTÁTICO del menú de operations: secciones y accesos, con sus claves
 * i18n (`platform.opsnav.<key>`) y el rol que los ve.
 *
 * Fuente ÚNICA: la comparten el menú lateral (OperationsNav) y los accesos
 * rápidos de la home. Los `routeName` deben existir en el router. El orden y la
 * agrupación son deliberados.
 *
 * Es lógica pura (sin Vue) para poder probarla con vitest.
 */
export interface NavEntryDef {
  key: string;
  icon: string;
  /** Ruta interna del router (dominio migrado) — mutuamente excluyente con href. */
  routeName?: string;
  /** URL externa (herramienta/admin legacy) — mutuamente excluyente con routeName. */
  href?: string;
  adminOnly?: boolean;
  partnerOnly?: boolean;
  /**
   * Acceso del trabajo diario. El usuario de un partner ve solo estos (más el de la pantalla
   * actual) hasta que pulsa «Ver más»; el personal TMWE ve siempre todo.
   */
  daily?: boolean;
}

export interface NavSectionDef {
  sectionKey: string;
  items: NavEntryDef[];
}

export const NAV_SECTION_DEFS: NavSectionDef[] = [
  {
    sectionKey: "operativa",
    items: [
      { key: "home",     icon: "mdi-home-outline",           routeName: "home", daily: true },
      { key: "cargo",    icon: "mdi-airplane",               routeName: "cargo-list", daily: true },
      { key: "shipment", icon: "mdi-truck-fast-outline",     routeName: "shipment-list", daily: true },
      { key: "tracking", icon: "mdi-radar",                  routeName: "tracking", daily: true },
    ],
  },
  {
    sectionKey: "gestion",
    items: [
      { key: "giacenze", icon: "mdi-package-variant-closed",  routeName: "giacenze" },
      { key: "consolidata", icon: "mdi-layers-triple-outline", routeName: "consolidata", adminOnly: true },
      { key: "pickup",   icon: "mdi-truck-check-outline",     routeName: "pickup", daily: true },
      { key: "crm",      icon: "mdi-account-details-outline", routeName: "crm" },
      { key: "tickets",  icon: "mdi-ticket-outline",           routeName: "communication" },
      // OJO con el nombre: la ruta se llama `anagrafiche`, NO `clients`. El
      // path publico si es /clients, pero los NOMBRES de ruta son el contrato
      // de @shared/anagrafiche (navega con router.push({name:'anagrafica-*'})),
      // por eso operations los renombro `clients-*` → `anagrafiche`/`anagrafica-*`.
      // Poner routeName:"clients" hacia que el <RouterLink> resolviese un nombre
      // inexistente al RENDERIZAR el sidebar → "No match for clients", excepcion
      // en el arranque y pagina EN BLANCO en toda la SPA (no solo en este enlace).
      { key: "clients",  icon: "mdi-account-multiple",        routeName: "anagrafiche" },
      { key: "copilot",  icon: "mdi-robot-outline",           routeName: "copilot" },
    ],
  },
  {
    sectionKey: "facturacion",
    items: [
      { key: "invoicing", icon: "mdi-file-document-outline", routeName: "invoicing", daily: true },
      { key: "payments",  icon: "mdi-cash-multiple",         routeName: "payments" },
      { key: "warehouse", icon: "mdi-warehouse",             routeName: "warehouse-weighing" },
      { key: "proforma",  icon: "mdi-file-percent-outline",  routeName: "proforma" },
      { key: "cod",       icon: "mdi-cash-multiple",         routeName: "cod" },
    ],
  },
  {
    sectionKey: "herramientas",
    items: [
      { key: "bulk",         icon: "mdi-upload-multiple", routeName: "bulk" },
      { key: "import",       icon: "mdi-upload",          href: "/erp/winbody.php?pp=spedy_import&ti=new" },
      { key: "import_v2",    icon: "mdi-upload-outline",  href: "/erp/winbody.php?pp=spedy_import2&ti=new" },
      // Tarifas: ruta INTERNA (la feature vive en @shared/listini). Antes
      // apuntaba al legacy `winbody.php?pp=listy`, que además rechaza a los
      // partners — justo el público de este item (`partnerOnly`).
      { key: "price_lists",  icon: "mdi-cash-register",   routeName: "price-lists", partnerOnly: true, daily: true },
      { key: "send_message", icon: "mdi-message-plus",    href: "/erp/winbody.php?pp=docsstory&ti=new" },
      { key: "email_templates", icon: "mdi-email-multiple-outline", routeName: "email_templates" },
      { key: "api_portal",   icon: "mdi-api",             href: "/erp/tmwe_json/api_doc", adminOnly: true },
    ],
  },
  {
    // Autogestión del PROPIO partner.
    // Las rutas `my-org*` redirigen a la ficha del partner de la sesión
    // reutilizando @shared/anagrafiche — no son pantallas nuevas.
    sectionKey: "mi_organizacion",
    items: [
      { key: "my_org_users", icon: "mdi-account-key-outline", routeName: "my-org-users", partnerOnly: true },
      { key: "my_org_sites", icon: "mdi-office-building-marker-outline", routeName: "my-org-sites", partnerOnly: true },
      // Plantillas de correo del partner: el controlador PHP ya tiene gate de
      // partner (master_data:read), solo faltaba el acceso desde el menú.
      { key: "my_org_email", icon: "mdi-email-edit-outline", routeName: "email_templates", partnerOnly: true },
    ],
  },
  {
    sectionKey: "admin",
    items: [
      // Ruta INTERNA de operations: navega por el router de la SPA.
      { key: "settings", icon: "mdi-tune", routeName: "settings", adminOnly: true },
    ],
  },
];

/** ¿Ve este acceso un usuario con ese rol? (`isAdmin` = anagrafica TMWE, id 1). */
export function isNavEntryVisible(
  it: { adminOnly?: boolean; partnerOnly?: boolean },
  isAdmin: boolean,
): boolean {
  if (it.adminOnly && !isAdmin) return false;
  if (it.partnerOnly && isAdmin) return false;
  return true;
}

/** Secciones con sus accesos filtrados por rol; se omiten las secciones vacías. */
export function visibleNavSections(
  defs: readonly NavSectionDef[],
  isAdmin: boolean,
): NavSectionDef[] {
  return defs
    .map((s) => ({ sectionKey: s.sectionKey, items: s.items.filter((it) => isNavEntryVisible(it, isAdmin)) }))
    .filter((s) => s.items.length > 0);
}

/**
 * Vista reducida del menú de un partner: deja los accesos `daily` y el de la pantalla actual
 * (`activeKeys`), y descarta las secciones que quedan vacías. Con `expanded` devuelve todo.
 */
export function reduceNavSections<T extends { items: { key: string; daily?: boolean }[] }>(
  sections: readonly T[],
  expanded: boolean,
  activeKeys: ReadonlySet<string> = new Set(),
): T[] {
  if (expanded) return [...sections];
  return sections
    .map((s) => ({ ...s, items: s.items.filter((it) => it.daily === true || activeKeys.has(it.key)) }))
    .filter((s) => s.items.length > 0);
}

/** ¿Hay accesos que la vista reducida oculta? Decide si se muestra «Ver más». */
export function hasHiddenNavEntries<T extends { items: { key: string; daily?: boolean }[] }>(
  sections: readonly T[],
  activeKeys: ReadonlySet<string> = new Set(),
): boolean {
  return reduceNavSections(sections, false, activeKeys).reduce((n, s) => n + s.items.length, 0)
    < sections.reduce((n, s) => n + s.items.length, 0);
}
