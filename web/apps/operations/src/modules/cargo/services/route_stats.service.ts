import { http } from "./http";

/**
 * Historical delivery stats per route (destination country + CAP|city).
 * Wraps ajax_route_stats → Route_Stats_Service (legacy spedy_form_ajax_stats.php).
 * Read-only informational panel shown on the destination address.
 */

export interface RouteStatsRow {
  id: number;
  id_fornitore: number;
  courier_label: string;
  id_servizio_fornitore: number;
  service_label: string;
  opz_par_doc: string;
  colli: number;
  peso: number;
  data_corriere: string;
  data_consegna_prevista: string;
  consegna_data: string;
}

export interface RouteStatsResponse {
  success: boolean;
  route: { country: string; cap: string; city: string };
  rows?: RouteStatsRow[];
  has_data?: boolean;
  message?: string;
}

export const routeStatsService = {
  get(country: string, cap: string, city: string): Promise<RouteStatsResponse> {
    return http<RouteStatsResponse>("/ajax_route_stats", {
      query: { country, cap, city },
    });
  },
};
