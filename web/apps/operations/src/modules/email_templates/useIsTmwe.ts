/**
 * En operations no existe el permissions.store de admin_config. La distinción
 * TMWE (admin de plantillas, id_anagrafica=1) vs partner se resuelve del
 * bootstrap inyectado por el wrapper PHP (`window.__TMWE_OPERATIONS__.isTmwe`),
 * mismo patrón que otros módulos (GiacenzeListPage). El aislamiento REAL lo
 * fuerza el backend (Modelli_Controller tenant scope); este flag solo controla
 * la UI (mostrar filtro owner, permitir elegir dueño al crear).
 */
export function useIsTmwe(): boolean {
  return Boolean(window.__TMWE_OPERATIONS__?.isTmwe);
}
