<template>
  <div class="preview-table">
    <v-alert
      v-for="(a, i) in avisos(result)"
      :key="i"
      type="warning"
      variant="tonal"
      density="compact"
      class="mb-2"
    >
      {{ a }}
    </v-alert>

    <!-- Resumen -->
    <div class="d-flex flex-wrap ga-2 mb-3" role="list">
      <v-chip role="listitem" size="small" variant="outlined">
        {{
          t("invoicing.fiscal.reglas.preview.clientes", {
            n: result.resumen.clientes,
          })
        }}
      </v-chip>
      <v-chip
        role="listitem"
        size="small"
        :color="result.resumen.cambian ? 'primary' : undefined"
        variant="flat"
      >
        {{
          t("invoicing.fiscal.reglas.preview.cambian", {
            n: result.resumen.cambian,
          })
        }}
      </v-chip>
      <v-chip role="listitem" size="small" variant="tonal">
        {{
          t("invoicing.fiscal.reglas.preview.sin_cambios", {
            n: result.resumen.sin_cambios,
          })
        }}
      </v-chip>
      <v-chip
        v-if="result.resumen.bloqueadas_con_regla"
        role="listitem"
        size="small"
        color="error"
        variant="flat"
      >
        {{
          t("invoicing.fiscal.reglas.preview.bloqueadas_con", {
            n: result.resumen.bloqueadas_con_regla,
          })
        }}
      </v-chip>
      <v-chip
        v-if="result.resumen.bloqueadas_sin_regla"
        role="listitem"
        size="small"
        color="warning"
        variant="tonal"
      >
        {{
          t("invoicing.fiscal.reglas.preview.bloqueadas_sin", {
            n: result.resumen.bloqueadas_sin_regla,
          })
        }}
      </v-chip>
      <v-chip
        v-if="result.resumen.error"
        role="listitem"
        size="small"
        color="error"
        variant="tonal"
      >
        {{
          t("invoicing.fiscal.reglas.preview.errores", {
            n: result.resumen.error,
          })
        }}
      </v-chip>
    </div>

    <v-table density="compact" class="mb-3">
      <caption class="text-caption text-medium-emphasis text-left pb-1">
        {{
          t("invoicing.fiscal.reglas.preview.totales")
        }}
        ({{
          result.periodo.desde
        }}
        →
        {{
          result.periodo.hasta
        }},
        {{
          t("invoicing.fiscal.reglas.preview.fecha_factura")
        }}
        {{
          result.periodo.fecha
        }})
      </caption>
      <thead>
        <tr>
          <th scope="col">
            {{ t("invoicing.fiscal.reglas.preview.sin_regla") }}
          </th>
          <th scope="col">
            {{ t("invoicing.fiscal.reglas.preview.con_regla") }}
          </th>
          <th scope="col">
            {{ t("invoicing.fiscal.reglas.preview.diferencia") }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>{{ money(result.resumen.totales.sin_regla) }}</td>
          <td>{{ money(result.resumen.totales.con_regla) }}</td>
          <td class="font-weight-medium">
            {{ money(result.resumen.totales.diferencia, true) }}
          </td>
        </tr>
      </tbody>
    </v-table>

    <div
      v-if="result.facturas.length === 0"
      class="text-body-2 text-medium-emphasis"
    >
      {{
        result.resumen.clientes === 0
          ? t("invoicing.fiscal.reglas.preview.nada_que_comparar")
          : t("invoicing.fiscal.reglas.preview.sin_afectadas")
      }}
    </div>

    <!-- Una fila por factura afectada, con las diferencias por línea -->
    <v-expansion-panels v-else variant="accordion" multiple>
      <v-expansion-panel
        v-for="f in result.facturas"
        :key="f.id_cliente"
        :value="f.id_cliente"
      >
        <v-expansion-panel-title>
          <div class="d-flex flex-wrap align-center ga-2 w-100">
            <span class="font-weight-medium">
              {{
                t("invoicing.fiscal.reglas.preview.cliente", {
                  id: f.id_cliente,
                })
              }}
            </span>
            <v-chip
              size="x-small"
              :color="estadoColor(f.estado)"
              variant="flat"
            >
              {{ t(`invoicing.fiscal.reglas.preview.estado.${f.estado}`) }}
            </v-chip>
            <v-spacer />
            <span
              v-if="f.totales.sin_regla && f.totales.con_regla"
              class="text-body-2"
            >
              {{ money(f.totales.sin_regla.a_pagar) }} →
              {{ money(f.totales.con_regla.a_pagar) }}
              ({{
                money(
                  f.totales.con_regla.a_pagar - f.totales.sin_regla.a_pagar,
                  true,
                )
              }})
            </span>
          </div>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <div v-if="f.motivo" class="text-body-2 mb-2">{{ f.motivo }}</div>
          <v-table v-if="f.diferencias.length" density="compact">
            <thead>
              <tr>
                <th scope="col">
                  {{ t("invoicing.fiscal.reglas.preview.donde") }}
                </th>
                <th scope="col">
                  {{ t("invoicing.fiscal.reglas.preview.campo") }}
                </th>
                <th scope="col">
                  {{ t("invoicing.fiscal.reglas.preview.sin_regla") }}
                </th>
                <th scope="col">
                  {{ t("invoicing.fiscal.reglas.preview.con_regla") }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(d, i) in f.diferencias" :key="i">
                <td>{{ d.donde }}</td>
                <td>{{ d.campo }}</td>
                <td>{{ d.sin_regla }}</td>
                <td class="font-weight-medium">{{ d.con_regla }}</td>
              </tr>
            </tbody>
          </v-table>
          <div v-if="f.reglas_factura.length" class="mt-2">
            <div class="text-caption text-medium-emphasis">
              {{ t("invoicing.fiscal.reglas.preview.reglas_factura") }}
            </div>
            <ul class="text-body-2 pl-4">
              <li v-for="(d, i) in f.reglas_factura" :key="i">
                <strong>{{ d.concepto }}</strong
                >: {{ brief(d.sin_regla) }} → {{ brief(d.con_regla) }}
              </li>
            </ul>
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script setup lang="ts">
/**
 * PreviewTable — resultado de la vista previa de una regla (`op=preview`):
 * qué facturas cambiarían si la regla estuviera activa. Muestra el resumen
 * (clientes, cuántas cambian, bloqueadas), el importe a pagar sin y con la
 * regla, y por cada factura afectada las diferencias línea a línea (código de
 * IVA, base, IVA, tipo) y las de las reglas de factura (retenciones, bollo,
 * menciones, cargos fijos, retención del envío, bloqueos).
 *
 * La vista previa se hace sobre lo pendiente de facturar del periodo: no
 * reconstruye facturas ya emitidas (para esas, el panel «Por qué»).
 *
 * Props: `result` (respuesta de `fiscReglasService.preview`). Emits: ninguno.
 *
 * Ejemplo:
 *   <PreviewTable v-if="preview" :result="preview" />
 */
import { useI18n } from "vue-i18n";
import type {
  PreviewEstado,
  PreviewResult,
} from "../../../services/fiscReglas.service";
import { money } from "./reglasModel";

defineProps<{ result: PreviewResult }>();

const { t, te } = useI18n();

/** Avisos traducidos por código; el texto del backend si el código no tiene traducción. */
function avisos(r: PreviewResult): string[] {
  return r.avisos.map((texto, i) => {
    const c = r.avisos_codigos?.[i];
    const key = `invoicing.fiscal.reglas.preview.avisos.${c?.codigo ?? ""}`;
    return c && te(key) ? t(key, c.params) : texto;
  });
}

function estadoColor(e: PreviewEstado): string {
  if (e === "CAMBIA") return "primary";
  if (e === "BLOQUEADA_CON_REGLA" || e === "ERROR") return "error";
  if (e === "BLOQUEADA_SIN_REGLA") return "warning";
  return "grey";
}

/** Resumen corto de un valor de las reglas de factura (lista de filas o vacío). */
function brief(v: unknown): string {
  if (Array.isArray(v)) {
    return v.length === 0 ? "—" : v.map(item).join("; ");
  }
  return v === null || v === undefined ? "—" : item(v);
}

/**
 * Un elemento de menciones, retenciones, bollo, cargos, retener_envio o
 * bloqueos en texto: tipo y %, concepto, motivo, texto (el primer idioma) e
 * importe, con la regla que lo produce. Si no tiene ninguno, JSON.
 */
function item(v: unknown): string {
  if (v === null || typeof v !== "object") return String(v);
  const o = v as Record<string, unknown>;
  const partes: string[] = [];
  if (o.tipo) partes.push(String(o.tipo) + (o.perc ? ` ${o.perc} %` : ""));
  if (o.concepto) partes.push(String(o.concepto));
  if (o.motivo) partes.push(String(o.motivo));
  if (o.texto && typeof o.texto === "object") {
    const textos = Object.values(o.texto as Record<string, unknown>);
    if (textos.length) partes.push(`«${String(textos[0])}»`);
  } else if (typeof o.texto === "string") {
    partes.push(`«${o.texto}»`);
  }
  if (typeof o.importe === "number") partes.push(money(o.importe));
  if (!partes.length) return JSON.stringify(v);
  return (o.id_regla ? `#${o.id_regla} ` : "") + partes.join(" · ");
}
</script>
