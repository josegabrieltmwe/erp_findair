/**
 * Lectura del bootstrap de sesión (`window.__TMWE_OPERATIONS__`, lo fija
 * `bootstrapBff` a partir de `/bff/auth/session`).
 *
 * `isTmwe` es el del usuario REAL: el BFF guarda el contexto del login y no lo
 * cambia al suplantar (AuthController::session / ImpersonationController), así
 * que sigue siendo true mientras el personal TMWE trabaja como otro partner.
 */
interface OpsBootstrapLike {
  isTmwe?: boolean;
  impersonating?: boolean;
}

function bootstrap(): OpsBootstrapLike | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { __TMWE_OPERATIONS__?: OpsBootstrapLike }).__TMWE_OPERATIONS__;
}

/** El usuario autenticado (no el suplantado) es personal TMWE. */
export function isRealTmweUser(): boolean {
  return bootstrap()?.isTmwe === true;
}

/**
 * `view_mode` de los listados (api_courier_shipments / api_cargo_shipments).
 * `erp` = el personal TMWE ve toda su red; sin él el API filtra por la
 * anagrafica del usuario (b2b). Suplantando NO se envía: el operador quiere
 * ver lo que ve el partner suplantado.
 */
export function listViewMode(): 'erp' | undefined {
  const b = bootstrap();
  return b?.isTmwe === true && b.impersonating !== true ? 'erp' : undefined;
}
