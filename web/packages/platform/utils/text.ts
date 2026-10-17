/**
 * Utilidades de texto compartidas — fuente ÚNICA para limpiar texto que viene de
 * la BD legacy con marcado HTML embebido.
 *
 * Contexto: muchas tablas legacy guardan el "nombre visible" con tags de formato
 * (`<B>FR - Cargo Dedicated`, `<b>2Promo`, `&nbsp;`) porque el ERP viejo los
 * renderizaba como HTML. En el modern esos campos se muestran como texto plano
 * (interpolación `{{ }}`, que NO interpreta HTML por seguridad), así que los tags
 * aparecen literales al usuario. Campos afectados conocidos: servizio_nome,
 * listino_nome, service_label, descrizione…
 *
 * Esta es la capa DEFENSIVA del frontend. El backend también limpia en origen
 * (strip_tags al serializar), pero datos cacheados, otros endpoints o respuestas
 * legacy podrían seguir trayendo marcado: por eso limpiamos también aquí, en el
 * punto de display. Una sola implementación evita las 4+ copias sueltas de
 * `stripTags` que había repartidas por los componentes.
 */

/** Entidades HTML mínimas que aparecen en los datos legacy. */
const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
};

/**
 * Quita tags HTML, decodifica entidades comunes y colapsa espacios.
 * Defensivo: acepta string | null | undefined y nunca lanza.
 *
 * @example stripTags('<B>FR - Cargo Dedicated')  // 'FR - Cargo Dedicated'
 * @example stripTags('<b>2Promo&nbsp;')          // '2Promo'
 */
export function stripTags(value: unknown): string {
  if (value == null) return '';
  let s = String(value);
  // 1) eliminar cualquier tag <...>
  s = s.replace(/<[^>]*>/g, '');
  // 2) decodificar las entidades conocidas
  s = s.replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);
  // 3) colapsar espacios y recortar
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Igual que stripTags pero devuelve un fallback si el resultado queda vacío.
 * Útil para celdas de tabla donde un '—' es mejor que una celda en blanco.
 */
export function stripTagsOr(value: unknown, fallback = '—'): string {
  const out = stripTags(value);
  return out === '' ? fallback : out;
}
