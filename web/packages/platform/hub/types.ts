/**
 * Contrato del hub de funcionalidades ("Administration overview" y sucesores).
 *
 * El hub es agnóstico del host: no importa rutas, servicios ni i18n de
 * `admin_config` ni de ninguna otra app. El host arma `FeatureHubGroup[]` ya
 * resueltos (título traducido, ruta nombrada) y decide qué se ve pasando su
 * propio predicado de permisos — el componente solo agrupa, filtra y busca.
 *
 * @see docs/plan-admin-navigation-shared-ui-consolidation.md §6.3
 */

export interface FeatureHubItem {
  /** Clave estable. No es la `key` de Vue del `v-for` del host (`group.key + item.key`
   *  la hace única entre grupos), pero sí debe ser única dentro de su grupo. */
  key: string;
  /** Título ya traducido — el hub no conoce namespaces i18n del host. */
  title: string;
  /** Descripción corta ya traducida, opcional. */
  description?: string;
  /** Icono mdi (string de `@mdi/js` o clase `mdi-*`). */
  icon: string;
  /** Nombre de ruta vue-router. El hub navega por nombre, nunca por path
   *  literal — un `href` a mano rompería si la ruta cambia de path. */
  routeName: string;
  /** Términos adicionales de búsqueda (sinónimos, claves legacy). El título
   *  y la descripción ya se buscan sin necesidad de repetirlos aquí. */
  keywords?: string[];
  /** Contador u otra insignia corta (p. ej. "3" en un badge). */
  badge?: string | number;
  /** Resalta el item como advertencia (p. ej. configuración pendiente). */
  warning?: boolean;
}

export interface FeatureHubGroup {
  /** Clave estable, única entre grupos. */
  key: string;
  /** Título del grupo ya traducido. */
  title: string;
  items: FeatureHubItem[];
}

/**
 * Predicado de permisos que decide si un item es visible. El hub llama
 * `allowed(item)` — nunca decide autorización por sí mismo: la visibilidad es
 * política de navegación, no un control de seguridad (la autorización real
 * vive en el guard de ruta y en el backend).
 */
export type FeatureHubPermissionCheck = (item: FeatureHubItem) => boolean;
