import { markRaw } from "vue";
import { i18n } from "@/plugins/i18n";
import type { AnagraficaExtraTab } from "@shared/anagrafiche/utils/extraTabs";
import AirCarrierCredentialsPartnerTab from "@shared/air_carrier_credentials/feature/AirCarrierCredentialsPartnerTab.vue";
import WebcargoCredentialsPartnerTab from "@shared/webcargo_key/feature/WebcargoCredentialsPartnerTab.vue";
import FornitoriAccntPartnerTab from "@shared/fornitori_accnt/feature/FornitoriAccntPartnerTab.vue";
import AiCredentialsPartnerTab from "@shared/ai_credentials/feature/AiCredentialsPartnerTab.vue";
import PartnerSmtpPartnerTab from "@shared/partner_smtp/feature/PartnerSmtpPartnerTab.vue";
import DatosFiscalesAnagraficaTab from "@/modules/invoicing/components/fiscal/DatosFiscalesAnagraficaTab.vue";

/**
 * Tabs de credenciales de proveedores API dentro de la ficha de anagrafica
 * (`/anagrafica/:id`). Usa el contrato `extraTabs` ya diseñado para esto
 * (packages/platform/anagrafiche/utils/extraTabs.ts, docblock: "por ejemplo
 * credenciales de proveedor") — nadie lo consumía hasta ahora.
 *
 * WebCargo es UNA sola entrada del rail (`webcargo`) con sub-tabs
 * horizontales internos (Published/Realtime) —
 * `WebcargoCredentialsPartnerTab.vue`. Registrarlos como dos entradas
 * separadas del rail resultó confuso en la práctica: un operador que busca
 * "las credenciales de WebCargo" no sabe de antemano si están en Published
 * o en Realtime (caso real: partner 7794 sin filas en courier genérico/KLM
 * pero con filas en AMBOS sistemas WebCargo — parecía "sin credenciales"
 * mirando solo el tab equivocado).
 *
 * El tab "courier" usa `fornitori_accnt` (paridad legacy forn_accounts.php)
 * — el modelo REAL consumido en producción para credenciales DHL/UPS/
 * FedEx/TNT W/Palletways/MRW/DTDC. NO usa `service_credentials` (tabla
 * sin filas en ningún entorno, ver package service_credentials — se deja
 * sin borrar por si en el futuro llega a usarse, pero no se registra aquí).
 *
 * `ai_credentials` (pestañas LLM y Voz) lista SOLO las filas propias de este partner
 * (id_anagrafica = registro actual) -- nunca la fila global/TMWE
 * (id_anagrafica NULL), que sigue gestionándose desde el panel admin
 * (Settings → ElevenLabs credentials). Que un partner no tenga filas aquí
 * es normal: sigue funcionando cayendo al fallback de TMWE.
 *
 * Los 5 backends detrás siguen siendo `admin_only` (TMWE) — el gate real
 * vive ahí, no aquí. `visible` se deja SIN restringir por `tipo` a
 * propósito (el propio contrato lo prohíbe: la casa TMWE, tipo 'I',
 * también tiene credenciales).
 *
 * `markRaw` evita que Vue intente hacer reactivo el propio componente
 * (innecesario y más lento para un valor que nunca cambia).
 */
export function anagraficaExtraTabs(): AnagraficaExtraTab[] {
  const t = i18n.global.t;
  return [
    {
      key: "air_carrier_credentials",
      label: t("anagrafica_tabs.air_carrier_credentials") as string,
      icon: "mdi-airplane-cog",
      component: markRaw(AirCarrierCredentialsPartnerTab),
      group: "integrations",
    },
    {
      key: "webcargo",
      label: t("anagrafica_tabs.webcargo") as string,
      icon: "mdi-key-variant",
      component: markRaw(WebcargoCredentialsPartnerTab),
      group: "integrations",
    },
    {
      key: "fornitori_accnt",
      label: t("anagrafica_tabs.fornitori_accnt") as string,
      icon: "mdi-truck-fast",
      component: markRaw(FornitoriAccntPartnerTab),
      group: "integrations",
    },
    {
      key: "ai_credentials",
      label: t("anagrafica_tabs.ai_credentials") as string,
      icon: "mdi-robot-outline",
      component: markRaw(AiCredentialsPartnerTab),
      group: "integrations",
    },
    {
      // Cuentas SMTP del partner (administración de TMWE sobre api_admin_partner_smtp). Solo partners y la casa
      // TMWE: un cliente final no envía correo con cuenta propia.
      key: "partner_smtp",
      label: t("anagrafica_tabs.partner_smtp") as string,
      icon: "mdi-email-fast-outline",
      component: markRaw(PartnerSmtpPartnerTab),
      group: "integrations",
      visible: (record) => ["P", "I"].includes(String(record.tipo ?? "").toUpperCase()),
    },
    {
      // «Datos fiscales» (DISENO §5): ajustes con vigencia y datos que exige
      // la tabla de validación del país. Clientes (C, CV), partners y la casa
      // TMWE (I); el backend (api_fisc_config) decide quién ve y quién edita.
      key: "datos_fiscales",
      label: t("anagrafica_tabs.datos_fiscales") as string,
      icon: "mdi-card-account-details-outline",
      component: markRaw(DatosFiscalesAnagraficaTab),
      group: "fiscal",
      visible: (record) =>
        ["C", "CV", "P", "I"].includes(String(record.tipo ?? "").toUpperCase()),
    },
  ];
}
