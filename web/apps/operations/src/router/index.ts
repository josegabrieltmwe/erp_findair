import { h } from "vue";
import {
  createRouter,
  createWebHistory,
  RouterView,
  type RouteRecordRaw,
} from "vue-router";
import { useProfile } from "@shared/composables/useProfile";
import { buildAccess } from "@shared/composables/useAccess";
import { canEnterSettingsHub, canOpenAdminRoute } from "@/modules/settings/settingsAccess";
import { AI_LEGACY_ROUTE_TABS, canSeeAiScope, type AiScope } from "@shared/ai_admin/composables/useAiScopes";
import { anagraficaExtraTabs } from "@/modules/anagrafica/anagraficaExtraTabs";
import { can as paymentsCan } from "@/modules/payments/env";
import { can as codCan } from "@/modules/cod_assegni/env";
import { can as warehouseCan } from "@/modules/warehouse/env";
import { can as invoicingCan } from "@/modules/invoicing/services/http";

declare module "vue-router" {
  interface RouteMeta {
    /** Ruta oculta del menú para no-admin (`OperationsNav`) Y bloqueada por
     *  el guard de abajo si se navega directo por URL. Ver comentario junto
     *  a `/settings` más abajo. */
    requiresAdmin?: boolean;
    /** Scope de IA (contrato ai-admin/1) exigido para ver la ruta. Es UX: la
     *  autorización real es de la API (AI_FORBIDDEN). */
    aiScope?: AiScope;
  }
}

/** Parent passthrough: monta solo el <router-view> de sus hijos (list/detail),
 *  sin un Host dedicado por módulo. */
const passthrough = { render: () => h(RouterView) };

/**
 * Destino de "Mi organización": la ficha del PARTNER de la sesión.
 *
 * No hay pantalla propia — se reutiliza `@shared/anagrafiche`, igual que para
 * los clientes. El backend ya lo permite: `validate_anagrafica_access()` acepta
 * el registro cuando `record_id === partner_id`, así que un partner siempre
 * puede abrir su propia ficha; lo que faltaba era el camino, porque hasta ahora
 * tenía que buscarse a sí mismo en el listado de clientes.
 *
 * Sin `partnerId` resoluble se cae al listado en vez de romper la navegación.
 */
function myOrgTarget(tab?: string) {
  const pid = Number(window.__TMWE_OPERATIONS__?.partnerId ?? 0);
  if (!pid) return { name: "anagrafiche" };
  return tab
    ? { name: "anagrafica-detail-tab", params: { id: String(pid), tab } }
    : { name: "anagrafica-detail", params: { id: String(pid) } };
}

/**
 * Router único de la SPA operativa.
 *
 * Cada dominio se monta con carga **perezosa** (`import()`): Vite trocea cada
 * módulo en su propio chunk, así el usuario descarga solo el dominio que visita
 * — el mismo comportamiento que hoy dan las apps separadas, pero bajo un router
 * y un shell comunes. El menú lateral se auto-puebla de las rutas con
 * `meta.title`.
 */
const routes: RouteRecordRaw[] = [
  { path: "/", name: "root", redirect: { name: "home" } },

  // ── Inicio (landing) — fusiona el dashboard de KPIs (antes en
  //    /home/activities) con los accesos rápidos. El fetch de KPIs del
  //    cockpit es no bloqueante (cola propia, máx. 3 en paralelo, cliente
  //    `ofetch` propio) y el router nunca lo espera, así que navegar a otra
  //    pantalla (p. ej. buscar una expedición) no se retrasa aunque los KPIs
  //    sigan cargando en segundo plano. ──────────
  {
    path: "/home",
    name: "home",
    component: () => import("@/modules/home/pages/HomeLandingPage.vue"),
    // Content-only: se muestra dentro del DashboardShell de operations (con la
    // nav de dominios). Ya no es fullscreen.
    meta: { title: "Inicio", icon: "mdi-home-outline" },
  },
  // Compatibilidad: la ruta vivía separada ("Actividades del día"); ahora es
  // la propia home. Se conserva el nombre por si queda algún enlace/favorito.
  {
    path: "/home/activities",
    name: "home-activities",
    redirect: { name: "home" },
  },
  // ── Expediciones — cargo (aéreo), integrado "tal cual" (módulo con
  //    sus propias sub-rutas bajo /cargo, sin fusionar). ──────────
  {
    path: "/cargo",
    name: "cargo",
    component: () => import("@/modules/cargo/CargoHost.vue"),
    meta: { title: "Cargo", icon: "mdi-airplane", fullscreen: true },
    // `/cargo` abre el LISTADO (antes rebotaba a cargo-home → hard-redirect al
    // servidor → 302 bajo el cutover). cargo-home queda para bookmarks.
    redirect: { name: "cargo-list" },
    children: [
      {
        path: "home",
        name: "cargo-home",
        component: () => import("@cargo/pages/CargoHomePage.vue"),
      },
      {
        path: "list",
        name: "cargo-list",
        component: () => import("@cargo/pages/CargoListPage.vue"),
      },
      {
        path: "new",
        name: "cargo-new",
        component: () => import("@cargo/pages/CargoNewPage.vue"),
      },
      {
        path: "from-express",
        name: "cargo-from-express",
        component: () => import("@cargo/pages/CargoFromExpressPage.vue"),
      },
      {
        path: ":id(\\d+)",
        name: "cargo-detail",
        component: () => import("@cargo/pages/CargoDetailPage.vue"),
        props: true,
      },
    ],
  },

  // ── Expediciones — shipment (courier), integrado "tal cual". ──────
  {
    path: "/shipment",
    name: "shipment",
    component: () => import("@/modules/shipment/ShipmentHost.vue"),
    meta: {
      title: "Express",
      icon: "mdi-truck-fast-outline",
      fullscreen: true,
    },
    // Dentro de operations, `/shipment` abre el LISTADO (no rebota a la home
    // global vía shipment-home, que hacía un hard-redirect al servidor →
    // provocaba un 302 bajo el cutover). shipment-home se conserva abajo solo
    // para bookmarks antiguos, pero ahora navega por el router (sin recarga).
    redirect: { name: "shipment-list" },
    children: [
      {
        path: "home",
        name: "shipment-home",
        component: () => import("@shipment/pages/ShipmentHomePage.vue"),
      },
      {
        path: "list",
        name: "shipment-list",
        component: () => import("@shipment/pages/ShipmentListPage.vue"),
      },
      {
        path: "new",
        name: "shipment-new",
        component: () => import("@shipment/pages/ShipmentNewPage.vue"),
      },
      {
        path: "from-cargo",
        name: "shipment-from-cargo",
        component: () => import("@shipment/pages/ShipmentFromCargoPage.vue"),
      },
      {
        path: "recharge",
        name: "recharge-list",
        component: () => import("@shipment/pages/RechargeListPage.vue"),
      },
      {
        path: ":id(\\d+)",
        name: "shipment-detail",
        // Formulario V2 (el que usa la ruta principal en la app original).
        component: () => import("@shipment/pages/ShipmentDetailPageV2.vue"),
        props: true,
      },
      {
        path: "legacy/:id(\\d+)",
        name: "shipment-detail-legacy",
        component: () => import("@shipment/pages/ShipmentDetailPage.vue"),
        props: true,
      },
    ],
  },

  // ── Operativa — soporte ───────────────────────────────────
  {
    path: "/tracking",
    name: "tracking",
    component: () => import("@/modules/tracking/pages/TrackingManagerPage.vue"),
    meta: { title: "Tracking", icon: "mdi-radar" },
  },
  {
    path: "/giacenze",
    name: "giacenze",
    component: () => import("@/modules/giacenze/pages/GiacenzeListPage.vue"),
    meta: { title: "Giacenze", icon: "mdi-package-variant-closed" },
  },
  {
    path: "/consolidata",
    name: "consolidata",
    component: () =>
      import("@/modules/consolidata/pages/ConsolidataQueuePage.vue"),
    meta: { title: "Consolidata", icon: "mdi-layers-triple-outline" },
  },
  {
    path: "/consolidata/quote",
    name: "consolidata-quote",
    component: () =>
      import("@/modules/consolidata/pages/ConsolidataQuotePage.vue"),
    meta: { title: "Consolidata", icon: "mdi-layers-triple-outline" },
  },
  {
    path: "/consolidata/:id(\\d+)",
    name: "consolidata-detail",
    component: () =>
      import("@/modules/consolidata/pages/ConsolidataDetailPage.vue"),
    meta: { title: "Consolidata", icon: "mdi-layers-triple-outline" },
  },
  {
    path: "/pickup",
    name: "pickup",
    component: () => import("@/modules/pickup/pages/OperationsPanelPage.vue"),
    meta: { title: "Pickup", icon: "mdi-truck-check-outline" },
  },
  // Paginas de prese que existian pero no tenian ruta (codigo huerfano). Sin
  // `title`: no entran en el menu hasta decidir donde se enlazan desde el panel.
  // El giro exige administrador tambien en backend (Route_Controller).
  {
    path: "/pickup/list",
    name: "pickup-list",
    component: () => import("@/modules/pickup/pages/PickupListPage.vue"),
  },
  {
    path: "/pickup/calendar",
    name: "pickup-calendar",
    component: () => import("@/modules/pickup/pages/PickupCalendarPage.vue"),
  },
  {
    path: "/pickup/routes",
    name: "pickup-routes",
    component: () => import("@/modules/pickup/pages/DriverRoutesPage.vue"),
    meta: { requiresAdmin: true },
  },
  {
    path: "/pickup/pod",
    name: "pickup-pod",
    component: () => import("@/modules/pickup/pages/DriverPodPage.vue"),
  },
  {
    path: "/crm",
    name: "crm",
    component: passthrough,
    meta: { title: "CRM", icon: "mdi-account-details-outline" },
    redirect: { name: "crm-list" },
    children: [
      {
        path: "",
        name: "crm-list",
        component: () => import("@/modules/crm/pages/CrmListPage.vue"),
      },
      {
        // Ficha de la pratica (paridad crm_form.php). La abren openDetail del
        // listado y el bloque Cross-app de la expedición.
        path: "pratiche/:id(\\d+)",
        name: "crm-detail",
        component: () => import("@/modules/crm/pages/CrmPraticaPage.vue"),
        props: true,
      },
    ],
  },
  {
    path: "/tickets",
    name: "communication",
    component: passthrough,
    meta: { title: "Tickets", icon: "mdi-ticket-outline" },
    redirect: { name: "communication-list" },
    children: [
      {
        path: "",
        name: "communication-list",
        component: () => import("@/modules/communication/pages/TicketsListPage.vue"),
      },
      {
        path: ":id(\\d+)",
        name: "communication-thread",
        component: () => import("@/modules/communication/pages/TicketThreadPage.vue"),
        props: true,
      },
    ],
  },
  {
    path: "/copilot",
    name: "copilot",
    component: () => import("@/modules/copilot/pages/CopilotPage.vue"),
    meta: { title: "Copilot", icon: "mdi-robot-outline" },
  },
  {
    path: "/bulk",
    name: "bulk",
    component: () => import("@/modules/bulk/pages/BulkImportPage.vue"),
    meta: { title: "Importación", icon: "mdi-upload-multiple" },
  },

  // ── Configuraciones (solo TMWE, is_admin) ─────────────────
  // Gate de MENÚ vía OperationsNav (adminOnly + get_my_profile.is_admin, igual
  // que el ítem "admin" existente) MÁS guard de ruta (`router.beforeEach` más
  // abajo, marcado vía `meta.requiresAdmin`): un usuario no-admin que navegue
  // directo por URL a /settings o cualquier subruta es redirigido a /home, no
  // solo "no ve el enlace". Ninguno de los dos sustituye la autorización de
  // backend — si el endpoint que consuma esta página necesita restringir por
  // anagrafica 1, debe hacerlo él mismo (is_tmwe_partner()), igual que hace
  // admin_config.
  {
    path: "/settings",
    name: "settings",
    component: () => import("@/modules/settings/pages/SettingsPage.vue"),
    meta: {
      title: "Configuraciones",
      icon: "mdi-cog-outline",
      requiresAdmin: true,
    },
  },
  // Sub-rutas del hub de Configuraciones: montan EMBEBIDAS (sin recarga) las
  // páginas ya existentes en admin_config, movidas al paquete compartido
  // (packages/platform/<feature>) para que ambas SPAs consuman la MISMA
  // implementación. Sin `meta.title` a propósito: no deben aparecer como
  // ítems propios en OperationsNav — solo se llega desde las tarjetas de
  // SettingsPage.vue (ver settingsCatalog.ts). `requiresAdmin` sí se declara
  // en cada una: el guard de abajo lee `meta` por ruta resuelta, no por
  // prefijo de path, para no depender de que nadie cambie las rutas de sitio.
  {
    path: "/settings/geographic-config",
    name: "settings-geographic-config",
    component: () =>
      import("@shared/geographic_config/feature/GeographicConfigPage.vue"),
    meta: { requiresAdmin: true },
  },
  // Fase 7 / L13: import masivo de zonas KO/RM "Freschi e Schiavoni"
  // (aree_ko_remote). Backend NUEVO, paridad exacta con freschi_files.php
  // (todo-o-nada + reemplazo transaccional por proveedor+país).
  {
    path: "/settings/freschi-import",
    name: "settings-freschi-import",
    component: () =>
      import("@shared/freschi_import/feature/FreschiImportPage.vue"),
    meta: { requiresAdmin: true },
  },
  // Fase 7 / L14: import masivo DHL — aeropuertos (dhl_airport, ~1.6M filas,
  // upload multipart) + servicios prioritarios (dhl_prioritari, ~62k filas).
  // Backend NUEVO para ambos — el backend "existente" (api_carrier_import)
  // resuelve un problema distinto (tracking de AWB), ver plan L14.
  {
    path: "/settings/dhl-import",
    name: "settings-dhl-import",
    component: () => import("@shared/dhl_import/feature/DhlImportPage.vue"),
    meta: { requiresAdmin: true },
  },
  {
    path: "/settings/carrier-services",
    name: "settings-carrier-services",
    component: () =>
      import("@shared/carrier_services/feature/CarrierServicesPage.vue"),
    meta: { requiresAdmin: true },
  },
  // Piloto de montaje de las secciones de identidad/seguridad que quedaron
  // sin ruta al retirar admin_config (portadas a packages/platform/ pero
  // nunca conectadas aquí). Guard: mismo `requiresAdmin` binario que el
  // resto de /settings/* — no hay contrato de permiso granular por sección
  // en operations todavía (ver Admin_Permissions_Controller.php, huérfano).
  {
    path: "/settings/users",
    name: "settings-users",
    component: () => import("@shared/users/feature/UsersPage.vue"),
    meta: { requiresAdmin: true },
  },
  {
    path: "/settings/users/:id(\\d+)",
    name: "user-detail",
    component: () => import("@shared/users/feature/UserDetailPage.vue"),
    props: true,
    meta: { requiresAdmin: true },
  },
  {
    path: "/settings/oauth-clients",
    name: "settings-oauth-clients",
    component: () =>
      import("@shared/oauth_clients/feature/OAuthClientsPage.vue"),
    meta: { requiresAdmin: true },
  },
  {
    path: "/settings/oauth-roles",
    name: "settings-oauth-roles",
    component: () => import("@shared/oauth_roles/feature/OAuthRolesPage.vue"),
    meta: { requiresAdmin: true },
  },
  {
    path: "/settings/permission-audit",
    name: "settings-permission-audit",
    component: () =>
      import("@shared/permission_audit/feature/PermissionAuditPage.vue"),
    meta: { requiresAdmin: true },
  },
  {
    // TMWE: credenciales de cualquier partner + voz. Administrador de partner (scope
    // ai:admin, rol partner_staff_ai_admin): SOLO su clave (modo propio). Antes `requiresAdmin`,
    // que dejaba fuera al partner; ahora lo gobierna el scope y la API sigue autorizando.
    path: "/settings/ai-credentials",
    name: "settings-ai-credentials",
    component: () =>
      import("@shared/ai_credentials/feature/AiCredentialsCenterPage.vue"),
    meta: { aiScope: "ai:admin" },
  },
  {
    // Credenciales ElevenLabs: ahora son la pestaña «Voz» de las credenciales de IA.
    path: "/settings/elevenlabs-credentials",
    redirect: { name: "settings-ai-credentials", query: { tab: "voice" } },
  },
  {
    // Agentes de voz (admin TMWE): pestañas Sincronizar y Revisión.
    path: "/settings/elevenlabs-agents",
    name: "settings-elevenlabs-agents-admin",
    component: () =>
      import("@shared/elevenlabs_agents/feature/ElevenlabsAgentsAdminPage.vue"),
    meta: { requiresAdmin: true },
  },
  {
    path: "/settings/elevenlabs-agent-sync",
    redirect: { name: "settings-elevenlabs-agents-admin", query: { tab: "sync" } },
  },
  // Administración de IA (contrato ai-admin/1, docs/06-api/agentes-ia/10-contrato-ai-admin.md). `aiScope`
  // oculta la ruta si el perfil trae scopes y no incluye el requerido; la API
  // sigue siendo quien autoriza. /settings/my-ai-usage es para cualquier usuario.
  {
    // Centro de IA: pestañas Uso, Presupuestos, Interruptores, Auditoría, Memoria,
    // Salud y Mi uso. Cada pestaña se oculta según su scope (AI_TAB_SCOPES).
    path: "/settings/ai-center",
    name: "settings-ai-center",
    component: () => import("@shared/ai_admin/feature/AiCenterPage.vue"),
  },
  // Rutas antiguas de IA -> pestaña del Centro.
  ...Object.entries(AI_LEGACY_ROUTE_TABS).map(([path, tab]) => ({
    path,
    redirect: { name: "settings-ai-center", query: { tab } },
  })),
  // Agentes de voz PROPIOS de partner (docs/02-arquitectura/agentes-ia/09-seguridad-agentes-propios-de-partner.md). La pagina del
  // partner NO es requiresAdmin: la controla el permiso RBAC
  // elevenlabs_partner_agent (rol partner_admin) y el servidor, que ademas
  // limita todo a las filas del propio partner.
  {
    path: "/settings/elevenlabs-my-agent",
    name: "settings-elevenlabs-my-agent",
    component: () =>
      import("@shared/elevenlabs_agents/feature/ElevenlabsPartnerAgentPage.vue"),
  },
  // Cuentas SMTP por partner. La del partner NO es requiresAdmin: la autoriza el servidor (scopes smtp:*
  // y administrador del partner, authx_18). La de TMWE sobre cualquier partner si lo es.
  {
    path: "/settings/smtp",
    name: "settings-partner-smtp",
    component: () => import("@shared/partner_smtp/feature/PartnerSmtpPage.vue"),
    props: { scope: "self" },
  },
  {
    path: "/settings/smtp-admin",
    name: "settings-partner-smtp-admin",
    component: () => import("@shared/partner_smtp/feature/PartnerSmtpPage.vue"),
    props: { scope: "admin" },
    meta: { requiresAdmin: true },
  },
  {
    path: "/settings/elevenlabs-agent-review",
    redirect: { name: "settings-elevenlabs-agents-admin", query: { tab: "review" } },
  },
  {
    path: "/settings/authz-explain",
    name: "settings-authz-explain",
    component: () =>
      import("@shared/authz_explain/feature/AuthzExplainPage.vue"),
    meta: { requiresAdmin: true },
  },
  // Self-service estricto: opera solo sobre el usuario de la sesión actual,
  // nunca recibe un :id de tercero (defense in depth, ver
  // Mfa_Admin_Controller.php — no hay endpoint para que un admin gestione
  // la MFA de otro usuario).
  {
    path: "/settings/mfa-setup",
    name: "settings-mfa-setup",
    component: () => import("@shared/mfa_setup/feature/MfaSetupPage.vue"),
    meta: { requiresAdmin: true },
  },
  // A diferencia del resto de /settings/*, "ejecutar ahora" tiene efectos
  // operacionales reales (encola trabajo de negocio), no solo lee/edita
  // configuración — el guard anti-avalancha vive en backend.
  {
    path: "/settings/scheduler",
    name: "settings-scheduler",
    component: () => import("@shared/scheduler/feature/SchedulerPage.vue"),
    meta: { requiresAdmin: true },
  },
  // Vive en el paquete oauth_clients (sin paquete propio): wizard que
  // orquesta contatti + oauth_clients + oauth_roles, sin :id de ruta — toda
  // la selección ocurre dentro del propio stepper.
  {
    path: "/settings/client-onboarding",
    name: "settings-client-onboarding",
    component: () =>
      import("@shared/oauth_clients/feature/ClientOnboardingPage.vue"),
    meta: { requiresAdmin: true },
  },
  {
    path: "/settings/terminals",
    name: "settings-terminals",
    component: () => import("@shared/terminals/feature/TerminalsPage.vue"),
    meta: { requiresAdmin: true },
  },
  {
    path: "/settings/good-types",
    name: "settings-good-types",
    component: () => import("@shared/good_types/feature/GoodTypesPage.vue"),
    meta: { requiresAdmin: true },
  },
  {
    path: "/settings/issuer-bank-accounts",
    name: "settings-issuer-bank-accounts",
    component: () =>
      import("@shared/issuer_bank_accounts/feature/IssuerBankAccountsPage.vue"),
    meta: { requiresAdmin: true },
  },
  {
    path: "/settings/payment-config",
    name: "settings-payment-config",
    component: () =>
      import("@shared/payment_config/feature/PaymentConfigPage.vue"),
    meta: { requiresAdmin: true },
  },
  // Fase 3 / L25: catálogo de monedas (valute). GET/PUT únicamente — el
  // legacy nunca ofreció alta/baja real desde la UI (ver
  // docs/plan-cierre-settings-moderno.md, L25).
  {
    path: "/settings/currencies",
    name: "settings-currencies",
    component: () => import("@shared/currencies/feature/CurrenciesPage.vue"),
    meta: { requiresAdmin: true },
  },
  // Fase 3 / L03: catálogo de sectores fiscales italianos (studi_settore).
  {
    path: "/settings/fiscal-settings",
    name: "settings-fiscal-settings",
    component: () =>
      import("@shared/fiscal_settings/feature/FiscalSettingsPage.vue"),
    meta: { requiresAdmin: true },
  },
  // Fase 6 / L02: sectores comerciales de cliente (settori_clienti), FK a
  // studi_settore (L03). Backend NUEVO — Settori_Clienti_Controller sigue el
  // patrón exacto de Studi_Settore_Controller.
  {
    path: "/settings/client-sectors",
    name: "settings-client-sectors",
    component: () =>
      import("@shared/client_sectors/feature/ClientSectorsPage.vue"),
    meta: { requiresAdmin: true },
  },
  // Vista administrativa de anagráficas — mismo componente compartido que
  // /clients (AnagraficaListPage.vue), pero SIN `lockTipo`: expone tabs
  // internos Todos/Partners/Clientes (`typeTab`) más un filtro por dueño
  // (`id_anagr_titolare`, `CmAnagraficaAutocomplete`). La navegación a
  // detalle/edición reutiliza las rutas ya existentes (anagrafica-detail,
  // anagrafica-create, anagrafica-detail-tab), sin duplicarlas.
  //
  // El aislamiento por partner sigue aplicando server-side igual que en
  // /clients (Anagrafica_Service::list_anagrafiche() +
  // Abstract_Anagrafica_Controller::validate_anagrafica_access()): esta
  // ruta no abre ninguna brecha, solo deja el tipo sin restringir. El
  // filtro por dueño se aplica como AND sobre ese aislamiento — un partner
  // no-TMWE nunca puede usarlo para ver algo fuera de su ámbito.
  {
    path: "/settings/anagrafiche",
    name: "settings-anagrafiche-admin",
    component: () =>
      import("@shared/anagrafiche/feature/AnagraficaListPage.vue"),
    meta: { requiresAdmin: true, title: "Anagráfica" },
  },
  // Card "Partners" en Settings > Anagráfica — mismo componente compartido,
  // pero con `lockTipo: "P"` (tipo='P' FORZADO server-side,
  // Anagrafica_Partners_Controller / api_anagrafica_partners), mismo
  // mecanismo que `/clients` usa con `lockTipo: "C"` más abajo. El
  // aislamiento por partner sigue aplicando igual: Anagrafica_Service::
  // list_anagrafiche() ya restringe a `id=partner_id OR
  // id_anagr_titolare=partner_id` para cualquier partner que no sea TMWE.
  {
    path: "/settings/partners",
    name: "settings-partners-admin",
    component: () =>
      import("@shared/anagrafiche/feature/AnagraficaListPage.vue"),
    meta: { requiresAdmin: true, title: "Partners", lockTipo: "P" },
  },
  // Fase 3 / L04: plan contable italiano (piano_conti). Lista plana, sin
  // jerarquía — verificado en BD, ver chartOfAccounts.service.ts.
  {
    path: "/settings/chart-of-accounts",
    name: "settings-chart-of-accounts",
    component: () =>
      import("@shared/chart_of_accounts/feature/ChartOfAccountsPage.vue"),
    meta: { requiresAdmin: true },
  },
  // Fase 3 / L01: catálogo global de causali IVA (fatture_causali_clienti).
  // NO es la asignación por cliente (eso vive en la ficha de cliente,
  // AnagraficaCausaliIvaSection.vue) — es la administración del catálogo.
  {
    path: "/settings/vat-causals",
    name: "settings-vat-causals",
    component: () => import("@shared/vat_causals/feature/VatCausalsPage.vue"),
    meta: { requiresAdmin: true },
  },
  // Fase 4 / L09: tipos de palé por proveedor (bancali_tipi). Alimenta
  // directamente el pricing por palé — ver palletTypes.service.ts.
  {
    path: "/settings/pallet-types",
    name: "settings-pallet-types",
    component: () => import("@shared/pallet_types/feature/PalletTypesPage.vue"),
    meta: { requiresAdmin: true },
  },
  // Fase 4 / L10: palés MPL por proveedor (bancali_mpl). Depende de L09
  // solo en dominio/UX — sin FK entre las dos tablas.
  {
    path: "/settings/pallet-mpl",
    name: "settings-pallet-mpl",
    component: () => import("@shared/pallet_mpl/feature/PalletMplPage.vue"),
    meta: { requiresAdmin: true },
  },
  // Fase 4 / L21: catálogo de presets de rentabilidad del partner de
  // sesión (profit_preset). Backend NUEVO (Profit_Preset_Controller); el
  // flujo de aplicar un preset a un cliente sigue en la ficha de cliente.
  {
    path: "/settings/profit-presets",
    name: "settings-profit-presets",
    component: () =>
      import("@shared/profit_presets/feature/ProfitPresetsPage.vue"),
    meta: { requiresAdmin: true },
  },
  // Fase 4 / L08: catálogo de suplementos/recargos (supplementi). CRUD ya
  // existía en backend; se añadió `auto_applied` a la respuesta para que la
  // UI advierta antes de editar filas que el motor de pricing aplica solo.
  {
    path: "/settings/extracharges",
    name: "settings-extracharges",
    component: () =>
      import("@shared/extracharges/feature/ExtrachargesPage.vue"),
    meta: { requiresAdmin: true },
  },
  // Fase 4 / L12: bloqueos de carrier por país/fecha (blocco_corrieri).
  // CRUD ya existía en backend con auditoría de campos.
  {
    path: "/settings/carrier-blocks",
    name: "settings-carrier-blocks",
    component: () =>
      import("@shared/carrier_blocks/feature/CarrierBlocksPage.vue"),
    meta: { requiresAdmin: true },
  },
  // L30, migrada 2026-08-15 desde admin_config (era enlace externo). CRUD
  // ya existía en backend (Web_Tracking_Descr_Controller/
  // Web_Tracking_Descr_Err_Controller), sin cambios.
  {
    path: "/settings/supplier-tracking-codes",
    name: "settings-supplier-tracking-codes",
    component: () =>
      import("@shared/supplier_tracking_codes/feature/SupplierTrackingCodesPage.vue"),
    meta: { requiresAdmin: true },
  },
  // Fase 5 / L15: catálogo de aerolíneas/carriers de cargo (cargo_vettori).
  {
    path: "/settings/cargo-carriers",
    name: "settings-cargo-carriers",
    component: () =>
      import("@shared/cargo_carriers/feature/CargoCarriersPage.vue"),
    meta: { requiresAdmin: true },
  },
  // Fase 5 / L16: handlers de tierra por partner (handlers). NO incluye
  // direcciones del handler (handlers_sedi, fuera de alcance).
  {
    path: "/settings/cargo-handlers",
    name: "settings-cargo-handlers",
    component: () =>
      import("@shared/cargo_handlers/feature/CargoHandlersPage.vue"),
    meta: { requiresAdmin: true },
  },
  // Fase 5 / L17: plantillas de documentos/mensajes (modelli). Reutiliza
  // el aislamiento anti-IDOR ya existente en Modelli_Controller (F0):
  // cada partner ve las suyas + las base TMWE (solo lectura, para clonar).
  {
    path: "/settings/document-models",
    name: "settings-document-models",
    component: () =>
      import("@shared/document_models/feature/DocumentModelsPage.vue"),
    meta: { requiresAdmin: true },
  },
  // Fase 6 / L26: editor de textos configurables del ERP legacy (testi,
  // ~10.786 filas). ⚠️ Alimenta en vivo el renderizado de texto legacy —
  // requiere lingua + (gruppo o búsqueda) antes de listar, nunca carga todo.
  {
    path: "/settings/erp-texts",
    name: "settings-erp-texts",
    component: () => import("@shared/erp_texts/feature/ErpTextsPage.vue"),
    meta: { requiresAdmin: true },
  },
  // Traducciones del sitio B2B (testi) lado a lado por grupo e idioma.
  {
    path: "/settings/b2b-texts",
    name: "settings-b2b-texts",
    component: () => import("@shared/b2b_texts/feature/B2bTextsPage.vue"),
    meta: { requiresAdmin: true },
  },
  // Avisos (banner) del sitio B2B con fecha de inicio/fin.
  {
    path: "/settings/site-notices",
    name: "settings-site-notices",
    component: () => import("@shared/site_notices/feature/SiteNoticesPage.vue"),
    meta: { requiresAdmin: true },
  },
  // Fase 6 / L27: diccionario de traducciones ERP (testi_erp, ~3.228 filas,
  // ITA/ENG). ⚠️ Backend NUEVO (Testi_Erp_Controller) — hasta ahora la única
  // escritura era upsert_label() desde scripts CLI, documentado como "no
  // exponer al runtime web". Alimenta $llberp (HTML legacy) y el diccionario
  // de solo lectura del SPA moderno (I18n_Dictionary_Controller).
  {
    path: "/settings/erp-dictionary",
    name: "settings-erp-dictionary",
    component: () =>
      import("@shared/erp_dictionary/feature/ErpDictionaryPage.vue"),
    meta: { requiresAdmin: true },
  },
  // Fase 5 / L18: agencias de aduana (agenzie_doganali). ⚠️ NO es catálogo
  // inerte: id_anagr_titolare/import_iso/export_iso/blocca gatean en vivo el
  // dropdown de agencia en la caja de aduanas de cargo (Web_Sdoganamento_Controller)
  // y `email` se usa para notificar al despachar (Notification_Service).
  {
    path: "/settings/customs-agencies",
    name: "settings-customs-agencies",
    component: () =>
      import("@shared/customs_agencies/feature/CustomsAgenciesPage.vue"),
    meta: { requiresAdmin: true },
  },
  // Fase 7 / L23: catálogo de códigos de charge de carga aérea (cargo_voci).
  // ⚠️ Alimenta en vivo qué surcharges se suman al total de cotizaciones
  // WebCargo (Xml_Surcharge_Calculator, Airline_Cache_Service con caché
  // propia). Backend ya existente, sin cambios.
  {
    path: "/settings/cargo-charges",
    name: "settings-cargo-charges",
    component: () =>
      import("@shared/cargo_charges/feature/CargoChargesPage.vue"),
    meta: { requiresAdmin: true },
  },
  // Fase 7 / L24: catálogo de descripciones de "otros cargos" AWB. Backend
  // NUEVO — el modelo previo (Awb_Other_Charge.php) apuntaba a una tabla
  // inexistente, era código muerto (ver finding_awb_other_charge_model_
  // schema_mismatch en memoria). Dominio independiente de L23 pese a que
  // el plan original los agrupaba como relacionados.
  {
    path: "/settings/awb-other-charges",
    name: "settings-awb-other-charges",
    component: () =>
      import("@shared/awb_other_charges/feature/AwbOtherChargesPage.vue"),
    meta: { requiresAdmin: true },
  },
  {
    path: "/settings/webcargo-key",
    name: "settings-webcargo-key",
    component: () => import("@shared/webcargo_key/feature/WebcargoKeyPage.vue"),
    meta: { requiresAdmin: true },
  },
  {
    path: "/settings/air-carrier-credentials",
    name: "settings-air-carrier-credentials",
    component: () =>
      import("@shared/air_carrier_credentials/feature/AirCarrierCredentialsPage.vue"),
    meta: { requiresAdmin: true },
  },
  {
    path: "/settings/forward-air-accounts",
    name: "settings-forward-air-accounts",
    component: () =>
      import("@shared/forward_air_accounts/feature/ForwardAirAccountsPage.vue"),
    meta: { requiresAdmin: true },
  },
  // Fase 6 / L20: estado del token OAuth de UPS, solo lectura. Backend NUEVO
  // (Ups_Token_Status_Controller) — lee ups_auth_token (módulo tmwe_ups)
  // directamente, sin exponer el token/refresh_token. Sin renovar/revocar,
  // ver docblock del controller para el porqué.
  {
    path: "/settings/ups-token-status",
    name: "settings-ups-token-status",
    component: () =>
      import("@shared/ups_token_status/feature/UpsTokenStatusPage.vue"),
    meta: { requiresAdmin: true },
  },
  {
    path: "/settings/b2b",
    name: "settings-b2b",
    component: () => import("@shared/b2b/feature/B2bPage.vue"),
    meta: { requiresAdmin: true },
  },
  // Fase 6 / L05: tipos de tarea/caso B2B-CRM (crm_tipi). CRUD ya existía
  // en backend (Crm_Type_Controller), solo faltaba UI.
  {
    path: "/settings/crm-types",
    name: "settings-crm-types",
    component: () => import("@shared/crm_types/feature/CrmTypesPage.vue"),
    meta: { requiresAdmin: true },
  },
  // Fase 2: enlaza una SPA ya construida pero sin ruta montada (ver
  // docs/reporte_migracion_pendiente_home_acciones_settings.md §3 — mismo
  // patrón que las 8 SPAs huérfanas ahí documentadas). Vive en
  // apps/operations/, no en packages/platform/: no la comparte admin_config.
  {
    path: "/settings/driver-zones",
    name: "settings-driver-zones",
    component: () => import("@/modules/pickup/pages/DriverZonesPage.vue"),
    meta: { requiresAdmin: true },
  },
  {
    path: "/settings/google-keys",
    name: "settings-google-keys",
    component: () => import("@shared/google_keys/feature/GoogleKeysPage.vue"),
    meta: { requiresAdmin: true },
  },
  // Fase 6 / L29: mapeo por país de qué tipo de address_component de Google
  // Places es "provincia" vs "ciudad" en el autocompletado de direcciones.
  // Backend NUEVO (Googlemaps_Address_Fields_Admin_Controller) — el modelo
  // ya existía y sigue vivo (Find_Place_Detail_Controller), sin controller
  // moderno hasta ahora.
  {
    path: "/settings/googlemaps-address-fields",
    name: "settings-googlemaps-address-fields",
    component: () =>
      import("@shared/googlemaps_address_fields/feature/GooglemapsAddressFieldsPage.vue"),
    meta: { requiresAdmin: true },
  },
  // Fase 7 / L19: motor de determinación de IVA/SDI por partner
  // (fatture_causali_new). Backend YA existía completo y protegido
  // (Invoice_Causals_Controller, is_fatturazione_admin()) — se añadió solo
  // `meta=1` en el GET para exponer natures SDI + países CEE (catálogos
  // estáticos ya calculados server-side). La UI replica las reglas
  // condicionales del legacy fatt_causali.php (filas system-fixed
  // ordine<20, iso_from/iso_to solo con tipo='IE', bloqueo de
  // aliquota/xml_natura si el art ya está en uso) en vez de exponer un
  // CRUD plano de 21 columnas.
  {
    path: "/settings/invoice-causals",
    name: "settings-invoice-causals",
    component: () =>
      import("@shared/invoice_causals/feature/InvoiceCausalsPage.vue"),
    meta: { requiresAdmin: true },
  },
  // Fase 7 / L07: textos de estados de tracking público (tracking_pubblico).
  // Backend NUEVO (Tracking_Pubblico_Controller) deliberadamente MÁS
  // restrictivo que el legacy track_pub_form.php: id/tipo/apri_giac son de
  // solo lectura (rechazados con 400 si se intenta escribirlos) y no hay
  // creación (405 en POST) — `id` es número mágico hardcodeado en ~104
  // sitios de consumo y `tipo`/`apri_giac` alimentan
  // Shipment_State_Machine_Service y la apertura automática de giacenza.
  // Editable: solo descr_*/note/stato.
  {
    path: "/settings/tracking-statuses",
    name: "settings-tracking-statuses",
    component: () =>
      import("@shared/tracking_statuses/feature/TrackingStatusesPage.vue"),
    meta: { requiresAdmin: true },
  },

  // ── Facturación / cobros ──────────────────────────────────
  {
    path: "/invoicing",
    name: "invoicing",
    component: passthrough,
    // La page trae su propio DashboardShell (con slot de filtros avanzados) →
    // fullscreen para no doblar la barra superior.
    meta: {
      title: "Facturación",
      icon: "mdi-file-document-outline",
      fullscreen: true,
    },
    redirect: { name: "invoicing-list" },
    children: [
      {
        path: "",
        name: "invoicing-list",
        component: () =>
          import("@/modules/invoicing/pages/InvoiceListPage.vue"),
        meta: { fullscreen: true },
      },
      {
        // Facturación mensual manual: vista previa por cliente y emisión.
        path: "monthly",
        name: "invoicing-monthly",
        component: () =>
          import("@/modules/invoicing/pages/MonthlyBillingPage.vue"),
        meta: { fullscreen: true },
        beforeEnter: () =>
          invoicingCan.write() ? true : { name: "invoicing-list" },
      },
      {
        // Conciliación de costes de transportistas (facturas recibidas).
        path: "carrier-reconciliation",
        name: "invoicing-carrier-reconciliation",
        component: () =>
          import("@/modules/invoicing/pages/CarrierReconciliationPage.vue"),
        meta: { fullscreen: true },
        beforeEnter: () => (invoicingCan.read() ? true : { name: "home" }),
      },
      {
        // Series de numeración del partner (enlace «Numeración» del listado).
        // Incluye la sección de rangos de validez (api_invoice_numbering_ranges).
        path: "numbering",
        name: "numbering-settings",
        component: () =>
          import("@/modules/invoicing/pages/NumberingSettingsPage.vue"),
        meta: { fullscreen: true },
      },
      {
        // Envíos al Estado (rediseño R7-R8, DISENO §10): cola por pestañas,
        // plazos con semáforo, envío manual y carga de acuses.
        path: "envios",
        name: "invoicing-envios",
        component: () =>
          import("@/modules/invoicing/pages/EnviosEstadoPage.vue"),
        meta: { fullscreen: true },
      },
      {
        // Configuración fiscal con vigencias (DISENO §3.2): conceptos y
        // valores, parámetros, requisitos, canales, plazos, revisión y alertas.
        path: "configuracion-fiscal",
        name: "invoicing-fiscal-config",
        component: () => import("@/modules/invoicing/pages/FiscConfigPage.vue"),
        meta: { fullscreen: true },
      },
      {
        // «Datos fiscales» de una entidad fuera de la ficha (usuarios y
        // enlaces directos). En la ficha de anagrafica es una pestaña.
        path: "datos-fiscales/:tipo(cliente|partner|usuario)/:id(\\d+)",
        name: "invoicing-datos-fiscales",
        component: () =>
          import("@/modules/invoicing/pages/DatosFiscalesPage.vue"),
        props: true,
        meta: { fullscreen: true },
      },
      {
        // Ficha de la factura (activa o pasiva). La abren el listado y el
        // bloque Cross-app de la expedición (courier/cargo). Nombre con prefijo
        // `invoicing-` para que el shell resalte el dominio (match name+"-").
        path: ":id(\\d+)",
        name: "invoicing-detail",
        component: () =>
          import("@/modules/invoicing/pages/InvoiceDetailPage.vue"),
        props: true,
        meta: { fullscreen: true },
      },
    ],
  },
  // ── Cobros y pagos (scadenzario, antigüedad de saldos, conciliación) ──
  {
    path: "/payments",
    name: "payments",
    component: () => import("@/modules/payments/pages/PaymentListPage.vue"),
    meta: { title: "Cobros y pagos", icon: "mdi-cash-multiple" },
    beforeEnter: () => (paymentsCan.read() ? true : { name: "home" }),
  },
  {
    path: "/payments/aging",
    name: "payments-aging",
    component: () => import("@/modules/payments/pages/AgingPage.vue"),
    meta: { title: "Antigüedad de saldos", icon: "mdi-chart-bar" },
    beforeEnter: () => (paymentsCan.read() ? true : { name: "home" }),
  },
  {
    path: "/payments/reminders",
    name: "payments-reminders",
    component: () => import("@/modules/payments/pages/ReminderPage.vue"),
    meta: { title: "Recordatorios de cobro", icon: "mdi-email-alert-outline" },
    beforeEnter: () => (paymentsCan.read() ? true : { name: "home" }),
  },
  {
    // Solo quien puede conciliar (el partner es de solo lectura).
    path: "/payments/reconciliation",
    name: "payments-reconciliation",
    component: () =>
      import("@/modules/payments/pages/BankReconciliationPage.vue"),
    meta: { title: "Conciliación bancaria", icon: "mdi-bank-transfer" },
    beforeEnter: () => (paymentsCan.reconcile() ? true : { name: "payments" }),
  },
  // ── Almacén (pesaje, Doctor Pack, carga del autista, entregas, manifiestos) ──
  {
    path: "/warehouse",
    redirect: { name: "warehouse-weighing" },
  },
  {
    path: "/warehouse/weighing",
    name: "warehouse-weighing",
    component: () => import("@/modules/warehouse/pages/WeighingPage.vue"),
    meta: { title: "Pesaje manual", icon: "mdi-scale" },
    beforeEnter: () => (warehouseCan.read() ? true : { name: "home" }),
  },
  {
    path: "/warehouse/docpack",
    name: "warehouse-docpack",
    component: () => import("@/modules/warehouse/pages/DocpackPage.vue"),
    meta: { title: "Doctor Pack", icon: "mdi-package-variant-closed-check" },
    beforeEnter: () => (warehouseCan.read() ? true : { name: "home" }),
  },
  {
    path: "/warehouse/driver-load",
    name: "warehouse-driver-load",
    component: () => import("@/modules/warehouse/pages/DriverLoadPage.vue"),
    meta: { title: "Giro del autista", icon: "mdi-truck-delivery-outline" },
    beforeEnter: () => (warehouseCan.read() ? true : { name: "home" }),
  },
  {
    path: "/warehouse/deliveries",
    name: "warehouse-deliveries",
    component: () => import("@/modules/warehouse/pages/DeliveriesPage.vue"),
    meta: { title: "Firmas de entrega", icon: "mdi-draw-pen" },
    beforeEnter: () => (warehouseCan.read() ? true : { name: "home" }),
  },
  {
    path: "/warehouse/manifests",
    name: "warehouse-manifests",
    component: () => import("@/modules/warehouse/pages/ManifestsPage.vue"),
    meta: { title: "Manifiestos", icon: "mdi-file-document-multiple-outline" },
    beforeEnter: () => (warehouseCan.read() ? true : { name: "home" }),
  },
  {
    path: "/proforma",
    name: "proforma",
    component: () => import("@/modules/proforma/pages/ProformaListPage.vue"),
    meta: { title: "Proforma", icon: "mdi-file-percent-outline" },
  },
  {
    path: "/cod",
    name: "cod",
    component: () => import("@/modules/cod_assegni/pages/CodAssegniPage.vue"),
    meta: { title: "COD / Assegni", icon: "mdi-cash-multiple" },
  },
  {
    path: "/cod/reconciliation",
    name: "cod-reconciliation",
    component: () =>
      import("@/modules/cod_assegni/pages/CodReconciliationPage.vue"),
    meta: { title: "COD reconciliation", icon: "mdi-cash-check" },
    beforeEnter: () => (codCan.read() ? true : { name: "home" }),
  },
  {
    path: "/email-templates",
    name: "email_templates",
    component: () =>
      import("@/modules/email_templates/pages/EmailTemplatesPage.vue"),
    meta: { title: "Email templates", icon: "mdi-email-multiple-outline" },
  },

  // ── Clientes (100% @shared/anagrafiche) ───────────────────
  // Los NOMBRES de ruta son parte del contrato de @shared/anagrafiche: las
  // páginas compartidas navegan con router.push({ name: 'anagrafica-*' }).
  // Con los nombres antiguos ('clients-*') el botón de editar no hacía nada
  // (Vue Router no resuelve un nombre inexistente). partner_clients y
  // admin_config ya usaban 'anagrafica-*'; operations era la excepción.
  // El path público (#/clients) no cambia.
  {
    path: "/clients",
    name: "anagrafiche",
    component: () =>
      import("@shared/anagrafiche/feature/AnagraficaListPage.vue"),
    // `lockTipo: "C"` FUERZA tipo='C' server-side (Anagrafica_Clients_Controller,
    // api_anagrafica_clients) — no es una preselección editable. Este item de
    // menu promete "Clientes"; sin el bloqueo, el listado mezclaba partners,
    // proveedores, corrieri e internos en cuanto el operario tocaba el selector
    // de tipo (en una muestra de 100 registros, 25 no eran clientes). El
    // aislamiento por partner sigue aplicando igual: cada partner ve solo sus
    // propios clientes, TMWE los ve todos. Ver AnagraficaListPage.vue
    // (`lockedTipo`) para el detalle de cómo se oculta el selector.
    meta: { title: "Clientes", icon: "mdi-account-multiple", lockTipo: "C" },
  },
  // El detalle vive en /anagrafica/*, NO en /clients/*: esta misma pantalla
  // la abren tanto "/clients" (listado bloqueado a tipo=Cliente) como
  // "Anagráfica" en Settings (partners Y clientes) — /clients/:id sugería
  // que la ficha era exclusiva de clientes, lo cual nunca fue cierto. El
  // LISTADO de "/clients" no cambia de path, solo el detalle al que navega.
  {
    path: "/anagrafica/new",
    name: "anagrafica-create",
    component: () =>
      import("@shared/anagrafiche/feature/AnagraficaDetailPage.vue"),
    props: true,
  },
  // `props` inyecta `extraTabs` además de `id` (route.params): gestión de
  // credenciales de proveedores API (KLM/AF, WebCargo, courier genérico)
  // dentro de la propia ficha — ver anagraficaExtraTabs.ts. El contrato
  // `extraTabs` ya existía para esto (packages/platform/anagrafiche/utils/
  // extraTabs.ts), simplemente nadie lo conectaba todavía.
  {
    path: "/anagrafica/:id(\\d+)",
    name: "anagrafica-detail",
    component: () =>
      import("@shared/anagrafiche/feature/AnagraficaDetailPage.vue"),
    props: (route) => ({
      id: route.params.id,
      extraTabs: anagraficaExtraTabs(),
    }),
  },
  {
    path: "/anagrafica/:id(\\d+)/:tab",
    name: "anagrafica-detail-tab",
    component: () =>
      import("@shared/anagrafiche/feature/AnagraficaDetailPage.vue"),
    props: (route) => ({
      id: route.params.id,
      tab: route.params.tab,
      extraTabs: anagraficaExtraTabs(),
    }),
  },
  // Redirects desde los paths viejos (/clients/new, /clients/:id, /clients/:id/:tab)
  // para no romper enlaces o favoritos guardados con la URL anterior.
  {
    path: "/clients/new",
    redirect: { name: "anagrafica-create" },
  },
  {
    path: "/clients/:id(\\d+)",
    redirect: (to) => ({ name: "anagrafica-detail", params: to.params }),
  },
  {
    path: "/clients/:id(\\d+)/:tab",
    redirect: (to) => ({ name: "anagrafica-detail-tab", params: to.params }),
  },

  // ── Mi organización (autogestión del PROPIO partner) ──────────────────
  // No es una pantalla nueva: redirige a la ficha del partner de la sesión,
  // reutilizando @shared/anagrafiche. El backend ya lo permite —
  // Abstract_Anagrafica_Controller::validate_anagrafica_access() acepta el
  // registro cuando `record_id === partner_id`— pero hasta ahora el partner
  // tenía que buscarse a sí mismo en el listado de clientes.
  //
  // `:tab?` deja enlazar directo a "contatti" (usuarios) o "sedi".
  // Tarifas (listinos). Misma feature que admin_config — vive en
  // `packages/platform/listini` para servirse desde ambas SPAs sin duplicar las
  // ~2.650 líneas. El aislamiento por partner lo hace el BACKEND
  // (Abstract_Listini_Controller): un partner ve sus listinos + los globales en
  // lectura, y solo puede clonar estos últimos para personalizarlos.
  {
    path: "/price-lists",
    name: "price-lists",
    component: () => import("@shared/listini/feature/PriceListsPage.vue"),
    meta: { title: "Tarifas", icon: "mdi-cash-register" },
  },
  {
    path: "/my-org",
    name: "my-org",
    redirect: () => myOrgTarget(),
  },
  {
    path: "/my-org/users",
    name: "my-org-users",
    redirect: () => myOrgTarget("contatti"),
  },
  {
    path: "/my-org/sites",
    name: "my-org-sites",
    redirect: () => myOrgTarget("sedi"),
  },

  { path: "/:pathMatch(.*)*", redirect: { name: "home" } },
];

/**
 * History API under a single prefix, so the address bar shows
 * `/cargo/5023639` instead of `…/operations#/cargo/5023639`.
 *
 * ONE prefix for every domain of this SPA (cargo, shipment, giacenze, crm…):
 * a per-domain prefix would mean a different `base` per route, which a Vue
 * router cannot express — `base` is a single value for the whole app.
 *
 * The server side is a two-line .htaccess rule (`^ops$` and `^ops/`) that hands
 * any depth to app.php, which serves the SPA shell and lets the router resolve
 * client-side. Same pattern already proven by the `home` SPA — no vhost change
 * involved, since AllowOverride All is in effect.
 */
export const router = createRouter({
  history: createWebHistory("/"),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

/**
 * Guard de ruta para `meta.requiresAdmin` (hoy: todo `/settings` y
 * subrutas). Complementa — no sustituye — el gate de menú de
 * `OperationsNav` (que oculta el enlace) y la autorización real del
 * backend: un usuario no-admin que entre por URL directa a una ruta
 * marcada nunca llega a montar el componente, ni siquiera un instante.
 *
 * Falla cerrado: mientras el perfil no se ha resuelto (`isLoaded === false`)
 * o si `is_admin` no puede confirmarse (red caída, sesión caducada), se
 * redirige — nunca se asume admin por defecto, a diferencia de
 * `OperationsNav` donde ese default es una decisión de UX deliberada, no de
 * seguridad.
 */
router.beforeEach(async (to) => {
  if (!to.meta.requiresAdmin && !to.meta.aiScope) return true;

  const { isAdmin, profile, ensureProfile } = useProfile();
  await ensureProfile();

  // TMWE entra como siempre; el resto solo a las rutas con scope de personal (settingsAccess.ts).
  if (to.meta.requiresAdmin) {
    const ctx = { isAdmin: isAdmin.value, access: buildAccess(profile.value) };
    const allowed =
      to.name === "settings" ? canEnterSettingsHub(ctx) : canOpenAdminRoute(String(to.name ?? ""), ctx);
    if (!allowed) return { name: "home" };
  }
  if (to.meta.aiScope && !canSeeAiScope(profile.value, isAdmin.value, to.meta.aiScope)) {
    return { name: "home" };
  }
  return true;
});
