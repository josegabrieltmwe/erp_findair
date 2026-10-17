import { useI18n } from 'vue-i18n';

/**
 * Reglas de validación estándar para selectores de entidad.
 *
 * Uso:
 *   const { ruleRequiredId } = useSelectorRules();
 *   <CmAnagraficaAutocomplete :rules="[ruleRequiredId]" />
 *
 * Todas las reglas devuelven el formato compatible con Vuetify (boolean | string).
 */
export function useSelectorRules() {
  const { t } = useI18n();

  /** Campo requerido, debe ser un id positivo válido (number o string no vacío). */
  function ruleRequiredId(v: unknown): boolean | string {
    if (typeof v === 'number') return v > 0 || (t('selectors.required') as string);
    if (typeof v === 'string') return v.trim() !== '' || (t('selectors.required') as string);
    return t('selectors.required') as string;
  }

  /** Campo requerido para multi-select (el array debe tener al menos un elemento). */
  function ruleRequiredArray(v: unknown): boolean | string {
    return (Array.isArray(v) && v.length > 0) || (t('selectors.required') as string);
  }

  return {
    ruleRequiredId,
    ruleRequiredArray,
  };
}
