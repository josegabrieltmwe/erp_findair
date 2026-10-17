import { http } from '../../anagrafiche/services/http';

/**
 * Mapeo por país de qué `address_components[].types` de Google Places se
 * interpreta como "provincia" y cuál como "ciudad" al autocompletar un
 * formulario de dirección (`googlemaps_address_detail_field_meta`). Réplica
 * moderna de la parte "GoogleMap Address" de `home_box_8.php`.
 *
 * ⚠️ No es texto libre: los valores deben ser un tipo real de
 * `address_components` de Google — la API devuelve `valid_selectors` con la
 * lista exacta usada por `Dynamic_Direct_Response_Handler`. Un valor
 * incorrecto no rompe nada (cae al fallback genérico), pero deja de
 * autocompletar esa columna para ese país en silencio.
 *
 * Backend NUEVO (Fase 6/L29): /api_admin_googlemaps_address_fields
 * (Googlemaps_Address_Fields_Admin_Controller). GET lista / PUT upsert, sin
 * DELETE — borrar la fila no tiene sentido distinto de "nunca configurado"
 * (mismo comportamiento por defecto).
 */

export interface AddressFieldMapping {
  id: number;
  iso: string;
  name: string;
  city_selector: string | null;
  province_selector: string | null;
}

export interface AddressFieldMappingPayload {
  id_country: number;
  province_selector: string | null;
  city_selector: string | null;
}

const BASE = '/api_admin_googlemaps_address_fields';

interface ListResponse {
  success?: boolean;
  data?: AddressFieldMapping[];
  total?: number;
  valid_selectors?: string[];
}

interface WriteResponse {
  success?: boolean;
  error?: string;
  data?: AddressFieldMapping;
}

export const googlemapsAddressFieldsService = {
  async list(): Promise<{ items: AddressFieldMapping[]; validSelectors: string[] }> {
    const raw = await http<ListResponse>(BASE);
    return {
      items: Array.isArray(raw.data) ? raw.data : [],
      validSelectors: Array.isArray(raw.valid_selectors) ? raw.valid_selectors : [],
    };
  },

  async save(payload: AddressFieldMappingPayload): Promise<void> {
    const raw = await http<WriteResponse>(BASE, { method: 'PUT', body: payload });
    if (raw.success === false) throw new Error(raw.error || 'Save failed');
  },
};
