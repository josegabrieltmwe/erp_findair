import { ref } from 'vue';
import { apiFieldErrors } from '../utils/apiError';

/**
 * Errores por campo de un 422 del API (`error.details.fields`), para pintarlos junto al campo
 * (`:error-messages="fieldError('mail')"`). Se limpian al guardar de nuevo o al editar el campo.
 */
export function useServerFieldErrors() {
  const errors = ref<Record<string, string>>({});

  /** Registra los campos del error capturado; devuelve true si había alguno. */
  function setFrom(e: unknown): boolean {
    errors.value = apiFieldErrors(e);
    return Object.keys(errors.value).length > 0;
  }
  function clear(field?: string): void {
    if (field === undefined) {
      errors.value = {};
    } else if (field in errors.value) {
      const { [field]: _drop, ...rest } = errors.value;
      errors.value = rest;
    }
  }
  /** Para `:error-messages`: lista vacía si el campo no tiene error. */
  function fieldError(field: string): string[] {
    const m = errors.value[field];
    return m ? [m] : [];
  }
  return { errors, setFrom, clear, fieldError };
}
