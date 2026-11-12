/**
 * Contadores de «Da fare oggi» que no tienen KPI propio en el backend.
 *
 * La home solo muestra totales, así que NO pide listados: cada contador es una petición de conteo
 * (`per_page=1` o `count_only=1`, ver `countRequests`) cuyo `pagination.total` es el número. Un fallo
 * se propaga: el store lo traduce en «n/d», nunca en 0.
 */
import { http } from "../anagrafiche/services/http";
import { chatService } from "../services/chat.service";
import { countRequests, type CountRequest } from "./today_catalog";

interface Paged {
  data?: Array<Record<string, unknown>>;
  pagination?: { total?: number | string };
}

/** Total del listado; falla si el servidor no lo informa (mejor «n/d» que un 0 inventado). */
export function totalOf(res: Paged | null | undefined): number {
  const n = Number(res?.pagination?.total);
  if (res?.pagination?.total == null || !Number.isFinite(n))
    throw new Error("total no informado");
  return n;
}

export type Fetcher = (signal?: AbortSignal) => Promise<Record<string, number>>;

async function count(req: CountRequest, signal?: AbortSignal): Promise<Paged> {
  return http<Paged>(req.path, { query: req.query, signal });
}

/** Una fuente por tarjeta: si una falla, las demás siguen. */
function countSource(key: string, check?: (res: Paged) => void): Fetcher {
  return async (signal) => {
    const res = await count(countRequests()[key], signal);
    check?.(res);
    return { [key]: totalOf(res) };
  };
}

const chat: Fetcher = async () => {
  const res = await chatService.unreadCounter();
  const express = Number(res.data?.express);
  const cargo = Number(res.data?.cargo);
  if (!Number.isFinite(express) || !Number.isFinite(cargo))
    throw new Error("contador de chat no válido");
  return { chat_express: express, chat_cargo: cargo };
};

/** Las claves de cada fuente son las tarjetas que alimenta. */
export const SPECIAL_SOURCES: Readonly<
  Record<string, { keys: readonly string[]; fetch: Fetcher }>
> = {
  resi: { keys: ["resi"], fetch: countSource("resi") },
  // Un servidor que ignorase el filtro devolvería prese ya asignadas: mejor «n/d» que un número equivocado.
  prese_daaff: {
    keys: ["prese_daaff"],
    fetch: countSource("prese_daaff", (res) => {
      if ((res.data ?? []).some((p) => String(p.affidata) === "S"))
        throw new Error("filtro affidata ignorado");
    }),
  },
  pratiche_lav: { keys: ["pratiche_lav"], fetch: countSource("pratiche_lav") },
  chat: { keys: ["chat_express", "chat_cargo"], fetch: chat },
};
