<template>
  <v-text-field
    v-bind="$attrs"
    :model-value="displayText"
    :label="label"
    :placeholder="placeholder"
    :density="density"
    :readonly="readonly"
    :error-messages="errorMessage ? [errorMessage] : []"
    @update:model-value="onTyped"
    @blur="onBlur"
  >
    <template #append-inner>
      <v-menu
        v-model="menuOpen"
        :disabled="readonly"
        :close-on-content-click="false"
        location="bottom end"
      >
        <template #activator="{ props: activatorProps }">
          <v-icon v-bind="activatorProps" icon="mdi-clock-outline" style="cursor: pointer" />
        </template>
        <v-card min-width="260">
          <v-card-text class="d-flex align-center ga-2 pb-2">
            <v-select
              v-model="pickHour"
              :items="hourItems"
              :label="hourLabel"
              density="compact"
              hide-details
              style="max-width: 92px"
            />
            <span class="text-medium-emphasis">:</span>
            <v-select
              v-model="pickMinute"
              :items="minuteItems"
              :label="minuteLabel"
              density="compact"
              hide-details
              style="max-width: 92px"
            />
            <v-btn-toggle
              v-if="use12h"
              v-model="pickPeriod"
              density="compact"
              mandatory
              divided
              class="ms-1"
            >
              <v-btn value="AM" size="small">AM</v-btn>
              <v-btn value="PM" size="small">PM</v-btn>
            </v-btn-toggle>
          </v-card-text>
          <v-divider />
          <v-card-actions class="px-3 py-2">
            <v-btn size="small" variant="text" @click="toggleMode">
              {{ use12h ? toggle24hLabel : toggleAmpmLabel }}
            </v-btn>
            <v-spacer />
            <v-btn size="small" variant="text" @click="clear">{{ clearLabel }}</v-btn>
            <v-btn size="small" color="primary" variant="flat" @click="applyPicker">
              {{ applyLabel }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-menu>
    </template>
  </v-text-field>
</template>

<script setup lang="ts">
/**
 * TimeOfDayField — friendlier replacement for a plain v-text-field on
 * HH:mm(:ss) values (pickup windows, etc.): never shows/requires seconds,
 * accepts typed input in 24h ("14:00", "1400") or 12h ("2:00 pm", "2pm")
 * form, and offers a dropdown picker (hour/minute + a 24h/AM-PM toggle) for
 * anyone who'd rather click than type. No external time-picker dependency —
 * the installed Vuetify (3.12.6) dropped labs/VTimePicker.
 *
 * v-model always carries "HH:mm" (24h, zero-padded, no seconds); a value
 * with seconds (legacy DB "HH:mm:ss") is accepted and displayed without them.
 */
import { ref, computed, watch } from "vue";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    modelValue: string;
    label?: string;
    placeholder?: string;
    readonly?: boolean;
    density?: "default" | "comfortable" | "compact";
    hourLabel?: string;
    minuteLabel?: string;
    clearLabel?: string;
    applyLabel?: string;
    toggle24hLabel?: string;
    toggleAmpmLabel?: string;
    invalidFormatMessage?: string;
  }>(),
  {
    label: "",
    placeholder: "08:00",
    readonly: false,
    density: "default",
    hourLabel: "Hour",
    minuteLabel: "Min",
    clearLabel: "Clear",
    applyLabel: "OK",
    toggle24hLabel: "24h",
    toggleAmpmLabel: "AM/PM",
    invalidFormatMessage: "Invalid time",
  },
);

const emit = defineEmits<{
  "update:modelValue": [string];
  blur: [FocusEvent];
}>();

/** "HH:mm:ss" or "HH:mm" -> "HH:mm" for display; anything else passes through raw. */
function toDisplay(v: string): string {
  const m = (v ?? "").match(/^(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : (v ?? "");
}

/**
 * Accepts "HH:mm"/"HH:mm:ss" (24h), "H:mm am/pm"/"H am/pm" (12h), or "HHmm"/
 * "Hmm" (no separator). Returns normalised 24h "HH:mm", "" for a cleared
 * field, or null when unparseable.
 */
function parseTimeInput(raw: string): string | null {
  const s = raw.trim();
  if (s === "") return "";

  let m = s.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;

  m = s.match(/^(\d{1,2})(?::([0-5]\d))?\s*(am|pm)$/i);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = m[2] ?? "00";
    if (h < 1 || h > 12) return null;
    const isPm = m[3].toLowerCase() === "pm";
    h = isPm ? (h === 12 ? 12 : h + 12) : h === 12 ? 0 : h;
    return `${String(h).padStart(2, "0")}:${min}`;
  }

  m = s.match(/^(\d{1,2})(\d{2})$/);
  if (m) {
    const h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (h > 23 || min > 59) return null;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }

  return null;
}

const displayText = ref(toDisplay(props.modelValue));
const errorMessage = ref("");

watch(
  () => props.modelValue,
  (v) => {
    displayText.value = toDisplay(v);
  },
);

function onTyped(v: string): void {
  displayText.value = v;
  if (errorMessage.value) errorMessage.value = "";
}

function onBlur(e: FocusEvent): void {
  const parsed = parseTimeInput(displayText.value);
  if (parsed === null) {
    errorMessage.value = props.invalidFormatMessage;
    emit("blur", e);
    return;
  }
  errorMessage.value = "";
  displayText.value = parsed;
  if (parsed !== toDisplay(props.modelValue)) {
    emit("update:modelValue", parsed);
  }
  emit("blur", e);
}

function clear(): void {
  displayText.value = "";
  errorMessage.value = "";
  emit("update:modelValue", "");
  menuOpen.value = false;
}

// ─── Dropdown picker ────────────────────────────────────────────────
const menuOpen = ref(false);
const use12h = ref(false);
const pickHour = ref("08");
const pickMinute = ref("00");
const pickPeriod = ref<"AM" | "PM">("AM");

const hourItems = computed(() =>
  use12h.value
    ? Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"))
    : Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")),
);
const minuteItems = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

function seedPickerFrom(value: string): void {
  const parsed = parseTimeInput(value) || "08:00";
  const [hh, mm] = parsed.split(":").map(Number);
  pickMinute.value = String(mm).padStart(2, "0");
  if (use12h.value) {
    const period: "AM" | "PM" = hh >= 12 ? "PM" : "AM";
    let h12 = hh % 12;
    if (h12 === 0) h12 = 12;
    pickHour.value = String(h12).padStart(2, "0");
    pickPeriod.value = period;
  } else {
    pickHour.value = String(hh).padStart(2, "0");
  }
}

watch(menuOpen, (open) => {
  if (open) seedPickerFrom(displayText.value);
});

function toggleMode(): void {
  use12h.value = !use12h.value;
  seedPickerFrom(displayText.value);
}

function applyPicker(): void {
  let hh = parseInt(pickHour.value, 10);
  if (use12h.value) {
    hh = hh % 12;
    if (pickPeriod.value === "PM") hh += 12;
  }
  const value = `${String(hh).padStart(2, "0")}:${pickMinute.value}`;
  displayText.value = value;
  errorMessage.value = "";
  emit("update:modelValue", value);
  menuOpen.value = false;
  emit("blur", new FocusEvent("blur"));
}
</script>
