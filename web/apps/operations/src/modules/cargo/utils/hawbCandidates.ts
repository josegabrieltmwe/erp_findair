/**
 * Opciones del selector «Nuevo HAWB» (HawbListModal): candidatos que devuelve el API más el número tecleado.
 *
 * La búsqueda de candidatos (`unified_cargo_consolidation?attachable=1`) tarda 13-18 s en el sandbox y a veces responde
 * 504 (P130). Si fallaba, el selector se quedaba vacío y ni siquiera ofrecía el número tecleado, así que no se podía dar
 * de alta la casa aunque la expedición existiera. Aquí un fallo de la búsqueda NO impide ofrecer el número: el API valida
 * el acceso al crear la casa (P59).
 */
export interface PickItem {
  id: number;
  label: string;
}

/** Candidato tal como lo devuelve el API (solo lo que usa el selector). */
export interface CandidateRow {
  id: number | string;
  RIF_cliente?: string | null;
  peso?: number | string | null;
  colli?: number | string | null;
}

export function candidateLabel(sh: CandidateRow): string {
  const rif = sh.RIF_cliente ? ` · ${sh.RIF_cliente}` : "";
  return `#${sh.id}${rif} · ${Number(sh.peso).toFixed(1)}kg · ${sh.colli}c`;
}

/** Número de expedición que el usuario ha tecleado (solo dígitos) o 0. */
export function typedShipmentNumber(q: string): number {
  return /^\d+$/.test(q.trim()) ? Number(q.trim()) : 0;
}

export interface PickResult {
  items: PickItem[];
  /** La búsqueda de candidatos falló (504, red…): la lista del API no se pudo cargar. */
  failed: boolean;
}

/**
 * Carga los candidatos y añade el número tecleado si no está entre ellos. Nunca lanza: si `search` falla devuelve
 * `failed: true` y, si había un número tecleado, la opción de usarlo.
 */
export async function loadPickItems(
  search: () => Promise<CandidateRow[]>,
  q: string,
  useNumberLabel: (id: number) => string,
): Promise<PickResult> {
  let items: PickItem[] = [];
  let failed = false;
  try {
    items = (await search()).map((sh) => ({
      id: Number(sh.id),
      label: candidateLabel(sh),
    }));
  } catch {
    failed = true;
  }
  const typed = typedShipmentNumber(q);
  if (typed > 0 && !items.some((f) => f.id === typed)) {
    items.push({ id: typed, label: useNumberLabel(typed) });
  }
  return { items, failed };
}
