import { http } from '../../anagrafiche/services/http';

/**
 * Customs agency admin (agenzie_doganali). Réplica moderna de `agenzie_list.php`
 * / `agenzie_exe.php`.
 *
 * ⚠️ NO es un catálogo inerte: `id_anagr_titolare` + `import_iso`/`export_iso`
 * + `blocca`/`stato` son leídos en vivo por el dropdown de agencia de aduana
 * en la caja de aduanas de cargo (Web_Sdoganamento_Controller::list_agencies_for_country,
 * filtra por partner dueño de la expedición + substring del país ISO) y por
 * Customs_Shipment_Service::assign_agency al vincular la agencia a la
 * expedición. `mail` se usa para notificar a la agencia cuando la expedición
 * despacha (Notification_Service, plantilla CRGOFF). Editar estos campos
 * cambia qué agencias aparecen como seleccionables para un partner/país, no
 * solo metadata descriptiva.
 *
 * `okpartners` no tiene ningún consumidor en el código (solo aparece en
 * comentarios) — se mantiene editable por si acaso pero sin advertencia.
 *
 * Backend: /api_master_agencies (Agenzie_Doganali_Controller) — CRUD REST
 * completo, sin scoping de partner en el propio controller (a diferencia del
 * dropdown en vivo, que sí filtra); la UI debe permitir filtrar/asignar
 * `id_anagr_titolare` con criterio, dado el efecto real del campo.
 */

export type SN = 'S' | 'N';

export interface CustomsAgency {
  id: number;
  id_anagr_titolare: number;
  nome: string | null;
  import_iso: string | null;
  export_iso: string | null;
  note_open: string | null;
  note_interne: string | null;
  email: string | null;
  email2: string | null;
  email3: string | null;
  email4: string | null;
  email5: string | null;
  okpartners: SN;
  blocca: SN;
  stato: 'A' | 'O';
}

export interface CustomsAgencyPayload {
  id_anagr_titolare: number;
  nome: string;
  import_iso: string;
  export_iso: string;
  note_open: string;
  note_interne: string;
  email: string;
  email2: string;
  email3: string;
  email4: string;
  email5: string;
  okpartners: SN;
  blocca: SN;
}

const BASE = '/api_master_agencies';

interface RawWrite {
  success?: boolean;
  error?: string;
  data?: unknown;
}

function assertOk(raw: RawWrite | undefined, fallback: string): void {
  if (raw?.success === false) throw new Error(raw.error || fallback);
}

function listOf<T>(raw: unknown): T[] {
  const r = raw as { data?: T[] } | null;
  return Array.isArray(r?.data) ? (r!.data as T[]) : [];
}

export const customsAgenciesService = {
  async list(): Promise<CustomsAgency[]> {
    const raw = await http<unknown>(BASE);
    return listOf<CustomsAgency>(raw);
  },

  async create(payload: CustomsAgencyPayload): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'POST', body: payload });
    assertOk(raw, 'Create failed');
  },

  async update(id: number, payload: CustomsAgencyPayload): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'PUT', body: { id, ...payload } });
    assertOk(raw, 'Update failed');
  },

  async remove(id: number): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'DELETE', body: { id } });
    assertOk(raw, 'Delete failed');
  },
};
