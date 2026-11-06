/**
 * URL absoluta de una pantalla de ESTA aplicación, para dársela al API cuando va a mandar un correo a un tercero
 * con un enlace a ella (cotización a una aerolínea, oferta a un cliente, enlace de un documento…).
 *
 * El API no tiene interfaz y no puede saber dónde está la aplicación: la aplicación se lo dice en cada petición
 * (`callback_url`, una URL base que se abre por GET) y el API le añade los parámetros (`id`, `otp`…). El API solo la
 * acepta si su origen es uno de los registrados para esta aplicación (`oauth_client.redirect_uris`: el mismo origen
 * que `/bff/auth/callback`), así que debe construirse con `window.location.origin`, nunca con un dominio escrito aquí.
 * Ver tmwe_api/docs/03-diseno/callback_url_correos.md.
 *
 * Pantallas a las que puede llevar un correo: se declaran en `MAIL_LANDING_PATHS`, no sueltas en cada servicio, para
 * que sea fácil ver (y mantener) qué rutas deben existir y ser alcanzables SIN sesión.
 */

/** Caminos (dentro de la SPA) a los que enlazan correos a terceros. */
export const MAIL_LANDING_PATHS = {
  /** La aerolínea abre su solicitud de cotización cargo: `?id=<oferta>&otp=<otp>`. */
  cargoCarrierOffer: '/offer',
  /** Un courier o una anagrafica partner abre su solicitud de cotización de una expedición courier: `?id=<oferta>&otp=<token>&type=courier_offer`. */
  shipmentQuoteOffer: '/offer',
} as const;

export type MailLandingKey = keyof typeof MAIL_LANDING_PATHS;

/**
 * @param path    camino dentro de la SPA (empieza por «/»)
 * @param origin  origen de la aplicación; por defecto el de la pestaña (solo se cambia en pruebas)
 * @param baseUrl base de despliegue de la SPA (`import.meta.env.BASE_URL`); «/» si cuelga de la raíz
 */
export function appPageUrl(
  path: string,
  origin: string = window.location.origin,
  baseUrl: string = import.meta.env.BASE_URL ?? '/',
): string {
  const base = baseUrl.replace(/\/+$/, '');
  const tail = path.startsWith('/') ? path : `/${path}`;
  return `${origin.replace(/\/+$/, '')}${base}${tail}`;
}

/** `callback_url` de un correo a un tercero que enlaza a una de las pantallas declaradas. */
export function mailCallbackUrl(key: MailLandingKey, origin?: string, baseUrl?: string): string {
  return appPageUrl(MAIL_LANDING_PATHS[key], origin, baseUrl);
}
