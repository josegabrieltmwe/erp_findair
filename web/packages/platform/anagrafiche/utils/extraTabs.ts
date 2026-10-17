import type { Component } from 'vue';

/**
 * Contrato de pestañas extra para `AnagraficaDetailPage`.
 *
 * Existe porque la ficha de anagráfica la consumen varias apps host y no puede
 * importar servicios de ninguna: sin este contrato, añadir una pestaña propia
 * de `admin_config` (por ejemplo credenciales de proveedor) obligaría a acoplar
 * el paquete compartido a la configuración administrativa.
 *
 * La lógica de composición vive aquí, y no dentro del SFC, para poder probarla
 * sin montar el componente: lo que puede romperse en silencio es el ORDEN y la
 * VISIBILIDAD, no el marcado.
 *
 * @see docs/plan-admin-partner-integrations.md §6.2
 */

/** Forma mínima que necesita el filtro de visibilidad. */
export interface TabRecordLike {
  id?: number | string;
  tipo?: string;
  [key: string]: unknown;
}

/**
 * Grupo de navegación contextual (docs/plan-admin-navigation-shared-ui-consolidation.md
 * §6.4). `integrations` es el destino por defecto de las pestañas del host:
 * hoy son casi siempre credenciales/delegaciones de proveedor, y un host que
 * no especifica grupo no debería tener que saber la taxonomía completa para
 * seguir compilando.
 */
export type TabGroup = 'overview' | 'relations' | 'commercial' | 'fiscal' | 'integrations' | 'advanced';

export interface AnagraficaExtraTab {
  /** Clave estable: es el segmento `:tab` de la URL. No traducir. */
  key: string;
  /** Etiqueta ya traducida — el host conoce sus propias claves i18n. */
  label: string;
  icon: string;
  component: Component;
  /**
   * Decide si la pestaña se muestra para este registro. Por omisión, sí.
   *
   * Nunca debe usarse como control de seguridad: el backend valida aparte. En
   * particular, filtrar por `tipo === 'P'` sería incorrecto — hay anagráficas
   * con credenciales que no son de tipo P (la propia casa, id=1, es tipo 'I').
   */
  visible?: (record: TabRecordLike) => boolean;
  /** Grupo de navegación contextual. Default: 'integrations' (ver TabGroup). */
  group?: TabGroup;
}

export interface TabDescriptor {
  key: string;
  label: string;
  icon: string;
  group: TabGroup;
}

/**
 * Pestañas del host que aplican a este registro.
 *
 * Devuelve vacío mientras no haya registro: evaluar `visible()` antes de que
 * cargue ocultaría pestañas que sí aplican, provocando un salto visible cuando
 * el registro llega.
 */
export function visibleExtraTabs(
  extraTabs: AnagraficaExtraTab[] | undefined,
  record: TabRecordLike | null,
): AnagraficaExtraTab[] {
  if (!record) return [];
  return (extraTabs ?? []).filter((tab) => (tab.visible ? tab.visible(record) : true));
}

/**
 * Compone la lista final de pestañas.
 *
 * Las propias van SIEMPRE primero: un host no puede reordenar ni sustituir las
 * pestañas del paquete, solo añadir al final. Si una clave extra colisiona con
 * una propia, gana la propia y la extra se descarta — al revés, un host podría
 * secuestrar `dati_base` y romper la ficha para todos.
 */
export function composeTabs(
  ownTabs: TabDescriptor[],
  extraTabs: AnagraficaExtraTab[],
): TabDescriptor[] {
  const ownKeys = new Set(ownTabs.map((tab) => tab.key));
  const seen = new Set<string>();

  const appended = extraTabs
    .filter((tab) => !ownKeys.has(tab.key))
    .filter((tab) => {
      // Dos extras con la misma clave romperían el `:key` del v-for.
      if (seen.has(tab.key)) return false;
      seen.add(tab.key);
      return true;
    })
    .map(({ key, label, icon, group }) => ({ key, label, icon, group: group ?? 'integrations' as const }));

  return [...ownTabs, ...appended];
}

/**
 * Pestaña activa segura.
 *
 * Una URL puede apuntar a una pestaña inexistente: un deep link a una pestaña
 * extra que no es visible para este registro, o un enlace antiguo a una clave
 * retirada. Sin este saneado, la ficha quedaría en blanco sin error visible.
 */
export function resolveActiveTab(
  tabs: TabDescriptor[],
  requested: string | undefined,
  fallback = 'dati_base',
): string {
  if (requested && tabs.some((tab) => tab.key === requested)) return requested;
  return fallback;
}
