/**
 * Bloque ESLint compartido del gate i18n (anti-recaída de textos hardcodeados).
 *
 * Cada app lo importa en su `eslint.config.js` y elige la severidad:
 *   import { i18nGate } from '../../packages/platform/eslint/i18n-no-raw-text.js';
 *   ...i18nGate('error', './src/locales/*.json')   // apps ya limpias
 *   ...i18nGate('warn',  './src/locales/*.json')    // apps en migración
 *
 * Devuelve un array de bloques flat-config para hacer spread directo.
 */
import vueI18n from '@intlify/eslint-plugin-vue-i18n';

/**
 * @param {'error'|'warn'} severity
 * @param {string} localeDir  glob a los locales de la app (relativo a la app).
 */
export function i18nGate(severity = 'warn', localeDir = './src/locales/*.json') {
  return [
    {
      plugins: { '@intlify/vue-i18n': vueI18n },
      settings: {
        'vue-i18n': {
          localeDir,
          messageSyntaxVersion: '^10.0.0',
        },
      },
      rules: {
        '@intlify/vue-i18n/no-raw-text': [
          severity,
          {
            /*
             * Se ignora lo que NO es traducible. Dos familias:
             *
             *  1. Solo símbolos/números/puntuación (ya estaba).
             *  2. Unidades y magnitudes, solas o pegadas a un separador:
             *     "kg", "m³ ·", "kg /", "% / min", "1 EUR =". Son simbolos SI
             *     o notacion: identicos en los cinco idiomas. Meterlos en los
             *     bundles obliga a mantener la misma cadena en cinco ficheros
             *     para siempre y, peor, invita a que alguien los "traduzca"
             *     ("kg" -> "kg." o similar).
             *
             * `kg` por si solo aparecia 14 veces en operations: era el literal
             * mas repetido del proyecto y ninguna de esas 14 era texto real.
             */
            ignorePattern:
              '^(?:[\\s\\d\\p{P}\\p{S}]*|' +
              '[\\s\\d\\p{P}\\p{S}]*(?:kg|g|lb|Lb|t|m³|m2|m3|cm|mm|m|km|h|min|s|ms|d|%|€|\\$|Σ|CO2e|°C)' +
              '[\\s\\d\\p{P}\\p{S}]*(?:\\s*(?:min|max|kg|h)\\b[\\s\\d\\p{P}\\p{S}]*)?)$',
            ignoreText: [
              'EUR', 'USD', 'GBP',
              'AWB', 'MAWB', 'HAWB', 'IATA', 'COD', 'LDV', 'IVA', 'VAT',
              // Códigos de party de la spec de WebCargo: identifican el rol en
              // el mensaje (agente / delegado), no son etiquetas traducibles.
              'AV', 'DQ',
              'TMWE', 'WebCargo', 'TACT', 'UPS', 'DHL', 'KLM', 'FedEx',
              '—', '·', '→', '/', '|', '#', '@', '%',
              // Formatos de fichero y acronimos: iguales en todos los idiomas.
              'CSV', 'XLSX', 'PDF', 'XML', 'JSON', 'ZIP', 'CRM', 'API',
              'B2B', 'GEO', 'AIR', 'SEA', 'NA', 'OK', 'SYSTEM', 'IP:',
              // Unidades con etiqueta de sistema metrico/imperial.
              'M (kg)', 'I (Lb)',
              // Nomenclatura de la casa que no se traduce.
              'CO2e', '1 EUR =',
              // Mas transportistas (marca, igual en todos los idiomas).
              'BRT',
              // Prefijo de mercancia peligrosa (UN number), igual en todos los idiomas.
              'UN',
              // Glifo decorativo junto a un :title traducido (ver 🖷/✆ al lado, sin marcar).
              '✉︎',
              // Pistas de depuracion con el nombre literal de la columna/campo de BD, a
              // proposito sin traducir: son identificadores, no prosa (mismo criterio que
              // check_i18n.ts al descartar nombres de BD como texto visible traducible).
              'debug_valori', 'controllo_fatt =',
              'spedizioni_colli.id', 'segnac_cliente', 'RIF_cliente',
              '(data_sped0)', '(data_sped1)', '(data_consegna_prevista)', '(data_corriere)',
              // Formula con nombres de columna literales (tooltip de CargoProfitCard).
              'previsto = carico_volo − costo_volo_previsto',
              'reale = carico_volo − costo_volo_reale',
            ],
          },
        ],
      },
    },
  ];
}
