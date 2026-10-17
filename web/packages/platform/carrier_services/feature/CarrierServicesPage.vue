<template>
  <div>
    <CmSectionHeader
      :title="t('sections.carrier_services')"
      :subtitle="t('carrier_services.subtitle')"
    />

    <!-- ═══ LANDING ═══ -->
    <div v-if="viewState === 'landing'">
      <div class="cm-actions-right mb-3">
        <v-btn color="primary" :prepend-icon="mdiPlus" @click="openCreate">
          {{ t('carrier_services.new_service') }}
        </v-btn>
      </div>

      <v-card class="pa-4 mb-4" variant="outlined">
        <div class="cm-filters">
          <v-text-field
            v-model="search"
            :prepend-inner-icon="mdiMagnify"
            :label="t('common.search')"
            density="compact"
            hide-details
            clearable
            style="max-width: 240px"
          />
          <CmAnagraficaAutocomplete
            v-model="filterFornitore"
            :label="t('carrier_services.filter_carrier')"
            style="max-width: 280px"
            @update:model-value="onFornitoreChange"
          />
          <v-select
            v-model="filterTipo"
            :items="tipoFilterItems"
            item-title="title"
            item-value="value"
            :label="t('carrier_services.filter_type')"
            density="compact"
            hide-details
            style="max-width: 170px"
          />
          <v-select
            v-model="filterGeozona"
            :items="geozonaFilterItems"
            item-title="title"
            item-value="value"
            :label="t('carrier_services.filter_geozone')"
            density="compact"
            hide-details
            style="max-width: 160px"
          />
          <v-spacer />
          <span class="cm-cell-hint">{{ t('carrier_services.n_services', { n: filteredServices.length }) }}</span>
        </div>
      </v-card>

      <CmEmptyState
        v-if="!servicesLoading && !servicesError && filteredServices.length === 0"
        :icon="mdiTruck"
        :title="hasFilters ? t('carrier_services.empty_filtered') : t('carrier_services.empty_pick_carrier')"
      />
      <ListingDataView
        v-else
        :source="servicesListSource"
        :headers="servicesHeaders"
        :selected="selectedServices"
        :sort-key-map="servicesSortKeyMap"
        mode="infinite"
        :selectable="false"
        @update:selected="selectedServices = $event"
      >
        <template #cell.descr="{ item }">
          <a class="cm-link" href="#" @click.prevent="selectService(item as CarrierService)">{{ (item as CarrierService).descr }}</a>
          <v-chip
            v-if="(item as CarrierService).prioritario === 'S'"
            size="x-small"
            color="warning"
            variant="flat"
            class="ml-2"
          >
            {{ t('carrier_services.priority') }}
          </v-chip>
        </template>
        <template #cell.tipo="{ item }">
          <v-chip size="x-small" :color="tipoColor[(item as CarrierService).tipo ?? ''] || undefined" variant="tonal">
            {{ (item as CarrierService).tipo }}
          </v-chip>
        </template>
        <template #cell.geozona="{ item }">
          <v-chip size="x-small" :color="geozonaColor[(item as CarrierService).geozona ?? ''] || undefined" variant="tonal">
            {{ (item as CarrierService).geozona }}
          </v-chip>
        </template>
        <template #cell.from_paese_iso="{ item }">
          <span class="cm-mono">{{ (item as CarrierService).from_paese_iso }}</span>
        </template>
        <template #cell.tempi="{ item }">
          {{ (item as CarrierService).tempi }}d
        </template>
        <template #cell.actions="{ item }">
          <div class="cm-actions-right">
            <v-btn size="small" variant="text" :prepend-icon="mdiPencil" @click="selectService(item as CarrierService)">
              {{ t('common.edit') }}
            </v-btn>
            <v-btn size="small" variant="text" :prepend-icon="mdiContentCopy" @click="openClone(item as CarrierService)">
              {{ t('carrier_services.clone') }}
            </v-btn>
            <v-btn size="small" variant="text" color="error" :prepend-icon="mdiDelete" @click="openDelete(item as CarrierService)">
              {{ t('common.delete') }}
            </v-btn>
          </div>
        </template>
      </ListingDataView>
      <v-alert v-if="servicesError" type="error" variant="tonal" density="compact" class="mt-2" closable @click:close="servicesError = null">
        {{ servicesError }}
      </v-alert>
    </div>

    <!-- ═══ DETAIL ═══ -->
    <div v-else-if="viewState === 'detail' && selected">
      <div class="d-flex align-center ga-2 mb-4">
        <v-btn :icon="mdiArrowLeft" variant="text" size="small" @click="backToLanding" />
        <div class="text-h6 flex-grow-1">{{ selected.descr }}</div>
        <template v-if="!editMode">
          <v-btn variant="text" size="small" :prepend-icon="mdiPencil" @click="startEdit">
            {{ t('common.edit') }}
          </v-btn>
        </template>
        <template v-else>
          <v-btn variant="text" size="small" :disabled="savingService" @click="editMode = false">
            {{ t('common.cancel') }}
          </v-btn>
          <v-btn color="primary" size="small" :loading="savingService" @click="saveService">
            {{ t('common.save') }}
          </v-btn>
        </template>
      </div>

      <v-tabs v-model="detailTab" density="compact" class="mb-4">
        <v-tab value="info">{{ t('carrier_services.tab_info') }}</v-tab>
        <v-tab value="supplements">{{ t('carrier_services.tab_supplements', { n: supplements.length }) }}</v-tab>
        <v-tab value="zones">{{ t('carrier_services.tab_zones', { n: zonePage.total }) }}</v-tab>
      </v-tabs>

      <!-- INFO -->
      <div v-show="detailTab === 'info'">
        <v-card variant="outlined" class="pa-4">
          <div v-if="!editMode" class="cm-info-grid">
            <div><span class="cm-cell-hint">{{ t('carrier_services.f_description') }}:</span> {{ selected.descr }}</div>
            <div><span class="cm-cell-hint">{{ t('carrier_services.f_type') }}:</span> {{ selected.tipo }}</div>
            <div><span class="cm-cell-hint">{{ t('carrier_services.f_way') }}:</span> {{ wayLabel(selected.way) }}</div>
            <div><span class="cm-cell-hint">{{ t('carrier_services.f_origin') }}:</span> {{ selected.from_paese_iso }}</div>
            <div><span class="cm-cell-hint">{{ t('carrier_services.f_geozone') }}:</span> {{ selected.geozona }}</div>
            <div><span class="cm-cell-hint">{{ t('carrier_services.f_zone_type') }}:</span> {{ selected.zone_subzone }}</div>
            <div><span class="cm-cell-hint">{{ t('carrier_services.f_priority') }}:</span> {{ selected.prioritario }}</div>
            <div><span class="cm-cell-hint">{{ t('carrier_services.f_transit_days') }}:</span> {{ selected.tempi }}</div>
            <div><span class="cm-cell-hint">{{ t('carrier_services.f_cutoff_hour') }}:</span> {{ selected.ore }}:00</div>
            <div><span class="cm-cell-hint">{{ t('carrier_services.f_fuel_surcharge') }}:</span> {{ selected.fuel_surc }}%</div>
            <div><span class="cm-cell-hint">{{ t('carrier_services.f_coefficient') }}:</span> {{ selected.coefficiente }}</div>
            <div><span class="cm-cell-hint">{{ t('carrier_services.f_master') }}:</span> {{ selected.master }}</div>
            <div><span class="cm-cell-hint">{{ t('carrier_services.f_manual') }}:</span> {{ selected.manuale }}</div>
          </div>
          <div v-else class="cm-grid">
            <v-text-field v-model="editForm.descr" :label="t('carrier_services.f_description')" density="compact" />
            <v-select
              v-model="editForm.tipo"
              :items="tipoItems"
              item-title="title"
              item-value="value"
              :label="t('carrier_services.f_type')"
              density="compact"
            />
            <v-select
              v-model="editForm.way"
              :items="wayItems"
              item-title="title"
              item-value="value"
              :label="t('carrier_services.f_way')"
              density="compact"
            />
            <CmPaesiSelect
              :model-value="isoToPaeseId(editForm.from_paese_iso)"
              :label="t('carrier_services.f_origin')"
              @select="(p) => (editForm.from_paese_iso = paeseToIso(p, editForm.from_paese_iso))"
            />
            <v-select
              v-model="editForm.geozona"
              :items="geozonaItems"
              item-title="title"
              item-value="value"
              :label="t('carrier_services.f_geozone')"
              density="compact"
            />
            <v-select
              v-model="editForm.prioritario"
              :items="priorityItems"
              item-title="title"
              item-value="value"
              :label="t('carrier_services.f_priority')"
              density="compact"
            />
            <v-text-field v-model.number="editForm.tempi" :label="t('carrier_services.f_transit_days')" type="number" density="compact" />
            <v-text-field v-model.number="editForm.ore" :label="t('carrier_services.f_cutoff_hour')" type="number" density="compact" />
            <v-text-field v-model.number="editForm.fuel_surc" :label="t('carrier_services.f_fuel_surcharge')" type="number" step="0.01" density="compact" />
            <v-text-field v-model.number="editForm.coefficiente" :label="t('carrier_services.f_coefficient')" type="number" step="0.01" density="compact" />
          </div>
          <!-- Tarificación por distancia (zona KM) -->
          <div v-if="editMode" class="mt-4 pt-3" style="border-top: 1px solid rgba(0,0,0,0.08)">
            <div class="d-flex align-center mb-2">
              <v-switch
                v-model="kmEnabled"
                :label="t('carrier_services.km_enable')"
                color="primary"
                density="compact"
                hide-details
                inset
              />
            </div>
            <div v-if="kmEnabled">
              <v-text-field
                v-model="editForm.zone_km_fasce"
                :label="t('carrier_services.km_fasce')"
                :hint="t('carrier_services.km_fasce_hint')"
                persistent-hint
                density="compact"
                class="mb-3"
              />
              <div class="cm-grid mb-2">
                <v-switch v-model="kmMoltipl" :label="t('carrier_services.km_moltipl')" color="primary" density="compact" hide-details inset />
                <v-switch v-model="kmDuplica" :label="t('carrier_services.km_duplica')" color="primary" density="compact" hide-details inset />
              </div>
              <v-text-field
                v-model="editForm.zone_km_daqui"
                :label="t('carrier_services.km_daqui')"
                :hint="t('carrier_services.km_daqui_hint')"
                persistent-hint
                density="compact"
              />
            </div>
          </div>
        </v-card>
      </div>

      <!-- SUPPLEMENTS -->
      <div v-show="detailTab === 'supplements'">
        <div class="cm-actions-right mb-3 d-flex ga-2 justify-end">
          <v-btn color="primary" size="small" variant="tonal" :prepend-icon="mdiContentCopy" @click="openCloneSupplements">
            {{ t('carrier_services.clone_suppl_from') }}
          </v-btn>
          <v-btn color="primary" size="small" :prepend-icon="mdiPlus" @click="openSupplCreate">
            {{ t('carrier_services.add_supplement') }}
          </v-btn>
        </div>
        <CmEmptyState
          v-if="!supplLoading && supplements.length === 0"
          :icon="mdiPlaylistPlus"
          :title="t('carrier_services.empty_supplements')"
        />
        <ListingDataView
          v-else
          :source="supplementsListSource"
          :headers="supplementsHeaders"
          :selected="selectedSupplements"
          :sort-key-map="supplementsSortKeyMap"
          mode="infinite"
          :selectable="false"
          @update:selected="selectedSupplements = $event"
        >
          <template #cell.id_suppl="{ item }">
            <span class="cm-mono">#{{ (item as IndexedSupplement).id_suppl }}</span>
          </template>
          <template #cell.weight_range="{ item }">
            <span v-if="(item as IndexedSupplement).peso_min || (item as IndexedSupplement).peso_max">
              {{ (item as IndexedSupplement).peso_min ?? 0 }}–{{ (item as IndexedSupplement).peso_max ?? 0 }} kg
            </span>
            <span v-else class="cm-cell-hint">—</span>
          </template>
          <template #cell.orderby="{ item }">
            {{ (item as IndexedSupplement).orderby }}
          </template>
          <template #cell.actions="{ item }">
            <div class="cm-actions-right">
              <v-btn size="small" variant="text" :prepend-icon="mdiPencil" @click="openSupplEdit(item as ServiceSupplement)">
                {{ t('common.edit') }}
              </v-btn>
            </div>
          </template>
        </ListingDataView>
      </div>

      <!-- ZONES: solo-lectura para zonas normales; subzonas (SUB) editables fila a fila (L11) -->
      <div v-show="detailTab === 'zones'">
        <div class="cm-actions-right mb-3">
          <v-btn color="primary" size="small" variant="tonal" :prepend-icon="mdiContentCopy" @click="openCloneZones">
            {{ t('carrier_services.clone_zones_from') }}
          </v-btn>
        </div>
        <CmEmptyState
          v-if="!zonesLoading && zonePage.items.length === 0"
          :icon="mdiMapMarkerPath"
          :title="t('carrier_services.empty_zones')"
        />
        <template v-else>
          <v-alert v-if="isSubService" type="info" variant="tonal" density="compact" class="mb-2">
            {{ t('carrier_services.zones_sub_hint') }}
          </v-alert>
          <ListingDataView
            :source="zonesListSource"
            :headers="zonesHeaders"
            :selected="selectedZones"
            :sort-key-map="zonesSortKeyMap"
            mode="paginated"
            :selectable="false"
            @update:selected="selectedZones = $event"
          >
            <template #cell.zona="{ item }">
              <span class="cm-mono text-info">Z{{ (item as ServiceZone).zona }}</span>
            </template>
            <template #cell.route="{ item }">
              {{ (item as ServiceZone).from_paese_iso }} → {{ (item as ServiceZone).id_paese_iso }}
            </template>
            <template #cell.bidirez="{ item }">
              <v-chip size="x-small" :color="(item as ServiceZone).bidirez === 'S' ? 'success' : 'default'" variant="tonal">
                {{ (item as ServiceZone).bidirez === 'S' ? t('common.yes') : t('common.no') }}
              </v-chip>
            </template>
            <template #cell.tempi="{ item }">
              {{ (item as ServiceZone).tempi }}d
            </template>
            <template #cell.nota_zona="{ item }">
              <span class="cm-cell-hint">{{ (item as ServiceZone).nota_zona || '—' }}</span>
            </template>
            <template v-if="isSubService" #cell.actions="{ item }">
              <div class="cm-actions-right">
                <v-btn size="small" variant="text" :prepend-icon="mdiPencil" @click="openSubzoneEdit(item as ServiceZone)">
                  {{ t('common.edit') }}
                </v-btn>
              </div>
            </template>
          </ListingDataView>
        </template>
      </div>

      <div class="d-flex ga-2 mt-6 pt-4" style="border-top: 1px solid rgba(0,0,0,0.08)">
        <v-btn variant="outlined" size="small" :prepend-icon="mdiContentCopy" @click="openClone(selected)">
          {{ t('carrier_services.clone') }}
        </v-btn>
        <v-btn variant="outlined" size="small" color="error" :prepend-icon="mdiDelete" @click="openDelete(selected)">
          {{ t('common.delete') }}
        </v-btn>
      </div>
    </div>

    <!-- ═══ CLONE ZONES DIALOG ═══ -->
    <v-dialog v-model="cloneZonesDialog" max-width="520" persistent>
      <v-card>
        <v-card-title>{{ t('carrier_services.clone_zones_from') }}</v-card-title>
        <v-card-text>
          <v-alert type="warning" variant="tonal" density="compact" class="mb-3">
            {{ t('carrier_services.clone_zones_warning', { name: selected?.descr }) }}
          </v-alert>
          <v-autocomplete
            v-model="cloneSourceId"
            :items="cloneSourceItems"
            :loading="cloneSourceLoading"
            :search="cloneSourceSearch"
            item-title="descr"
            item-value="id"
            :label="t('carrier_services.clone_zones_source')"
            :no-data-text="t('carrier_services.clone_zones_search_hint')"
            density="compact"
            hide-details
            clearable
            @update:search="onCloneSourceSearch"
          />
          <p class="cm-cell-hint mt-2">
            {{ isSubService ? t('carrier_services.zones_sub_hint') : '' }}
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="cloningZones" @click="cloneZonesDialog = false">
            {{ t('common.cancel') }}
          </v-btn>
          <v-btn color="primary" :loading="cloningZones" :disabled="!cloneSourceId" @click="confirmCloneZones">
            {{ t('carrier_services.clone_zones_confirm') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ═══ EDIT SUBZONE DIALOG (L11) ═══ -->
    <v-dialog v-model="subzoneDialog" max-width="640" persistent scrollable>
      <v-card>
        <v-card-title>{{ t('carrier_services.dialog_edit_subzone') }}</v-card-title>
        <v-card-text>
          <v-alert type="warning" variant="tonal" density="compact" class="mb-3">
            {{ t('carrier_services.subzone_live_warning') }}
          </v-alert>
          <div class="cm-grid mb-3">
            <v-text-field v-model.number="subzoneForm.zona" :label="t('carrier_services.col_zone')" type="number" density="compact" />
            <v-text-field v-model.number="subzoneForm.tempi" :label="t('carrier_services.col_days')" type="number" density="compact" />
          </div>
          <v-text-field v-model="subzoneForm.nota_zona" :label="t('carrier_services.col_note')" density="compact" maxlength="5" class="mb-3" />
          <v-textarea
            v-model="subzoneForm.prov"
            :label="t('carrier_services.f_subzone_prov')"
            :hint="t('carrier_services.f_subzone_prov_hint')"
            persistent-hint
            rows="2" density="compact" class="mb-3"
          />
          <v-textarea
            v-model="subzoneForm.cap_show"
            :label="t('carrier_services.f_subzone_cap')"
            :hint="t('carrier_services.f_subzone_cap_hint')"
            persistent-hint
            rows="2" density="compact" class="mb-3"
          />
          <v-textarea
            v-model="subzoneForm.cap_ko"
            :label="t('carrier_services.f_subzone_capko')"
            :hint="t('carrier_services.f_subzone_capko_hint')"
            persistent-hint
            rows="2" density="compact"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="savingSubzone" @click="subzoneDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" :loading="savingSubzone" @click="saveSubzone">{{ t('common.save') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ═══ CLONE SUPPLEMENTS DIALOG (G5) ═══ -->
    <v-dialog v-model="cloneSupplDialog" max-width="520" persistent>
      <v-card>
        <v-card-title>{{ t('carrier_services.clone_suppl_from') }}</v-card-title>
        <v-card-text>
          <v-alert type="warning" variant="tonal" density="compact" class="mb-3">
            {{ t('carrier_services.clone_suppl_warning', { name: selected?.descr }) }}
          </v-alert>
          <v-autocomplete
            v-model="cloneSupplSourceId"
            :items="cloneSupplSourceItems"
            :loading="cloneSupplSourceLoading"
            :search="cloneSupplSourceSearch"
            item-title="descr"
            item-value="id"
            :label="t('carrier_services.clone_suppl_source')"
            :no-data-text="t('carrier_services.clone_zones_search_hint')"
            density="compact"
            hide-details
            clearable
            @update:search="onCloneSupplSourceSearch"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="cloningSuppl" @click="cloneSupplDialog = false">
            {{ t('common.cancel') }}
          </v-btn>
          <v-btn color="primary" :loading="cloningSuppl" :disabled="!cloneSupplSourceId" @click="confirmCloneSupplements">
            {{ t('carrier_services.clone_zones_confirm') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ═══ CREATE DIALOG ═══ -->
    <v-dialog v-model="createDialog" max-width="540" persistent>
      <v-card>
        <v-card-title>{{ t('carrier_services.dialog_create') }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="createForm.descr"
            :label="t('carrier_services.f_description')"
            density="compact"
            class="mb-3"
          />
          <CmAnagraficaAutocomplete
            v-model="createForm.id_fornitore"
            :label="t('carrier_services.f_carrier')"
            :clearable="false"
            class="mb-3"
          />
          <div class="cm-grid mb-3">
            <v-select
              v-model="createForm.tipo"
              :items="tipoItems"
              item-title="title"
              item-value="value"
              :label="t('carrier_services.f_type')"
              density="compact"
            />
            <v-select
              v-model="createForm.way"
              :items="wayItems"
              item-title="title"
              item-value="value"
              :label="t('carrier_services.f_way')"
              density="compact"
            />
          </div>
          <div class="cm-grid">
            <CmPaesiSelect
              :model-value="isoToPaeseId(createForm.from_paese_iso)"
              :label="t('carrier_services.f_origin')"
              @select="(p) => (createForm.from_paese_iso = paeseToIso(p, createForm.from_paese_iso))"
            />
            <v-select
              v-model="createForm.geozona"
              :items="geozonaItems"
              item-title="title"
              item-value="value"
              :label="t('carrier_services.f_geozone')"
              density="compact"
            />
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="creating" @click="createDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn
            color="primary"
            :loading="creating"
            :disabled="!createForm.descr || !createForm.id_fornitore"
            @click="createService"
          >
            {{ t('common.create') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ═══ SUPPLEMENT DIALOG ═══ -->
    <v-dialog v-model="supplDialog" max-width="640" persistent scrollable>
      <v-card>
        <v-card-title>
          {{ supplMode === 'create' ? t('carrier_services.dialog_add_supplement') : t('carrier_services.dialog_edit_supplement') }}
        </v-card-title>
        <v-card-text>
          <CmSupplementAutocomplete
            :model-value="supplForm.id_suppl ? Number(supplForm.id_suppl) : null"
            :label="t('carrier_services.f_supplement_id')"
            class="mb-3"
            @update:model-value="(v: number | null) => (supplForm.id_suppl = v ?? '')"
          />
          <div class="cm-grid mb-3">
            <v-text-field v-model.number="supplForm.peso_min" :label="t('carrier_services.f_min_weight')" type="number" step="0.01" density="compact" />
            <v-text-field v-model.number="supplForm.peso_max" :label="t('carrier_services.f_max_weight')" type="number" step="0.01" density="compact" />
          </div>

          <!-- ── Auto-detect rule conditions (servizi_fornitori_suppl) ── -->
          <div class="text-subtitle-2 mb-2 mt-1">{{ t('carrier_services.autodetect_title') }}</div>
          <p class="text-caption text-medium-emphasis mb-3">{{ t('carrier_services.autodetect_hint') }}</p>

          <div class="cm-grid mb-3">
            <v-select
              v-model="supplForm.peso_quale"
              :items="pesoQualeItems"
              :label="t('carrier_services.f_peso_quale')"
              density="compact"
            />
            <v-select
              v-model="supplForm.colli_pall"
              :items="colliPallItems"
              :label="t('carrier_services.f_colli_pall')"
              density="compact"
            />
          </div>

          <div class="cm-grid mb-3">
            <v-text-field v-model.number="supplForm.lato_sup" :label="t('carrier_services.f_lato_sup')" type="number" step="0.1" density="compact" />
            <v-text-field v-model.number="supplForm.num_colli_min" :label="t('carrier_services.f_num_colli_min')" type="number" density="compact" />
          </div>

          <div class="cm-grid cm-grid--3 mb-3">
            <v-text-field v-model.number="supplForm.lato_a" :label="t('carrier_services.f_lato_a')" type="number" step="0.1" density="compact" />
            <v-text-field v-model.number="supplForm.lato_b" :label="t('carrier_services.f_lato_b')" type="number" step="0.1" density="compact" />
            <v-text-field v-model.number="supplForm.lato_h" :label="t('carrier_services.f_lato_h')" type="number" step="0.1" density="compact" />
          </div>

          <div class="cm-grid mb-3">
            <v-text-field v-model.number="supplForm.perimetro_min" :label="t('carrier_services.f_perimetro_min')" type="number" step="0.1" density="compact" />
            <v-text-field v-model.number="supplForm.perimetro_max" :label="t('carrier_services.f_perimetro_max')" type="number" step="0.1" density="compact" />
          </div>

          <div class="cm-grid mb-3">
            <v-select
              v-model="supplForm.and_or"
              :items="andOrItems"
              :label="t('carrier_services.f_and_or')"
              density="compact"
            />
            <v-select
              v-model="supplForm.onlyone"
              :items="onlyoneItems"
              :label="t('carrier_services.f_onlyone')"
              density="compact"
            />
          </div>

          <div class="cm-grid mb-3">
            <v-text-field v-model.number="supplForm.orderby" :label="t('carrier_services.f_sort_order')" type="number" density="compact" />
            <v-checkbox
              :model-value="supplForm.peso_a_steps === 'S'"
              :label="t('carrier_services.f_peso_a_steps')"
              density="compact"
              hide-details
              @update:model-value="supplForm.peso_a_steps = $event ? 'S' : 'N'"
            />
          </div>

          <v-text-field v-model="supplForm.note" :label="t('carrier_services.f_note')" density="compact" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="savingSuppl" @click="supplDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" :loading="savingSuppl" @click="saveSuppl">{{ t('common.save') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  mdiPlus,
  mdiPencil,
  mdiDelete,
  mdiMagnify,
  mdiTruck,
  mdiContentCopy,
  mdiArrowLeft,
  mdiPlaylistPlus,
  mdiMapMarkerPath,
} from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import CmAnagraficaAutocomplete from '../../listini/components/CmAnagraficaAutocomplete.vue';
import CmSupplementAutocomplete from '../components/CmSupplementAutocomplete.vue';
import CmPaesiSelect from '../../geographic_config/components/CmPaesiSelect.vue';
import ListingDataView from '../../listing/ListingDataView.vue';
import { useClientSideListSource } from '../../listing/useClientSideListSource';
import type { DataTableHeader, ListSource } from '../../listing/types';
import { paesiService, type PaeseLite } from '../../geographic_config/services/paesi.service';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import type { Paginated } from '../../anagrafiche/services/api.types';
import {
  supplierServiceService,
  type CarrierService,
  type CarrierServicePayload,
  type ServiceSupplement,
  type ServiceZone,
  type SubzonePayload,
  type ServiceTipo,
  type ServiceWay,
  type ServiceGeozona,
  type ServicePriority,
} from '../services/supplierService.service';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const viewState = ref<'landing' | 'detail'>('landing');

// ── Landing ──
const services = ref<CarrierService[]>([]);
const servicesLoading = ref(false);
const servicesError = ref<string | null>(null);
const search = ref('');
const filterFornitore = ref<number | null>(null);
const filterTipo = ref<'' | ServiceTipo>('');
const filterGeozona = ref<'' | ServiceGeozona>('');

const tipoColor: Record<string, string> = { EXP: 'info', AIR: 'purple', SEA: 'teal' };
const geozonaColor: Record<string, string> = { IT: 'success', CE: 'info', EX: 'warning', NA: 'grey' };

const tipoItems = computed(() => [
  { title: t('carrier_services.type_exp'), value: 'EXP' },
  { title: t('carrier_services.type_air'), value: 'AIR' },
  { title: t('carrier_services.type_sea'), value: 'SEA' },
]);
const geozonaItems = computed(() => [
  { title: t('carrier_services.geo_it'), value: 'IT' },
  { title: t('carrier_services.geo_ce'), value: 'CE' },
  { title: t('carrier_services.geo_ex'), value: 'EX' },
  { title: t('carrier_services.geo_na'), value: 'NA' },
]);
const wayItems = computed(() => [
  { title: t('carrier_services.way_air'), value: 'A' },
  { title: t('carrier_services.way_ground'), value: 'T' },
]);
const priorityItems = computed(() => [
  { title: t('carrier_services.prio_normal'), value: 'N' },
  { title: t('carrier_services.prio_priority'), value: 'S' },
  { title: t('carrier_services.prio_economy'), value: 'E' },
  { title: t('carrier_services.prio_charter'), value: 'C' },
]);
const tipoFilterItems = computed(() => [{ title: t('common.all'), value: '' }, ...tipoItems.value]);
const geozonaFilterItems = computed(() => [{ title: t('common.all'), value: '' }, ...geozonaItems.value]);

// Auto-detect rule selectors (servizi_fornitori_suppl)
const pesoQualeItems = computed(() => [
  { title: t('carrier_services.peso_quale_real'), value: 'R' },
  { title: t('carrier_services.peso_quale_vol'), value: 'V' },
]);
const colliPallItems = computed(() => [
  { title: t('carrier_services.colli_pall_both'), value: 'E' },
  { title: t('carrier_services.colli_pall_colli'), value: 'C' },
  { title: t('carrier_services.colli_pall_pallet'), value: 'P' },
]);
const andOrItems = computed(() => [
  { title: t('carrier_services.and_or_any'), value: 'O' },
  { title: t('carrier_services.and_or_all'), value: 'A' },
]);
const onlyoneItems = computed(() => [
  { title: t('carrier_services.onlyone_all'), value: 'N' },
  { title: t('carrier_services.onlyone_first'), value: 'S' },
  { title: t('carrier_services.onlyone_s1'), value: 'S1' },
  { title: t('carrier_services.onlyone_s2'), value: 'S2' },
  { title: t('carrier_services.onlyone_s3'), value: 'S3' },
]);

function wayLabel(way: string | undefined): string {
  return way === 'T' ? t('carrier_services.way_ground') : t('carrier_services.way_air');
}

const hasFilters = computed(() => !!(search.value || filterTipo.value || filterGeozona.value));

const filteredServices = computed(() => {
  let list = services.value;
  if (search.value) {
    const s = search.value.toLowerCase();
    list = list.filter((sv) => (sv.descr || '').toLowerCase().includes(s));
  }
  if (filterTipo.value) list = list.filter((sv) => sv.tipo === filterTipo.value);
  if (filterGeozona.value) list = list.filter((sv) => sv.geozona === filterGeozona.value);
  return list;
});

const selectedServices = ref<{ id: number }[]>([]);
const servicesListSource = useClientSideListSource(filteredServices, { loading: servicesLoading });
const servicesHeaders: DataTableHeader[] = [
  { title: t('carrier_services.col_description') as string, key: 'descr' },
  { title: t('carrier_services.col_type') as string, key: 'tipo', width: 80 },
  { title: t('carrier_services.col_geozone') as string, key: 'geozona', width: 80 },
  { title: t('carrier_services.col_origin') as string, key: 'from_paese_iso', width: 70 },
  { title: t('carrier_services.col_days') as string, key: 'tempi', width: 60 },
  { title: t('common.actions') as string, key: 'actions', width: 200, align: 'end', sortable: false },
];
const servicesSortKeyMap: Record<string, string> = {
  descr: 'descr', tipo: 'tipo', geozona: 'geozona', from_paese_iso: 'from_paese_iso', tempi: 'tempi',
};

async function loadServices(): Promise<void> {
  if (!filterFornitore.value) {
    services.value = [];
    return;
  }
  servicesLoading.value = true;
  servicesError.value = null;
  try {
    services.value = await supplierServiceService.listByFornitore(filterFornitore.value);
  } catch (e) {
    servicesError.value = e instanceof Error ? e.message : String(e);
  } finally {
    servicesLoading.value = false;
  }
}

function onFornitoreChange(): void {
  void loadServices();
}

// ── Detail ──
const selected = ref<CarrierService | null>(null);
const detailTab = ref<'info' | 'supplements' | 'zones'>('info');
const editMode = ref(false);
const savingService = ref(false);

interface ServiceFormState {
  descr: string;
  tipo: ServiceTipo;
  way: ServiceWay;
  from_paese_iso: string;
  geozona: ServiceGeozona;
  prioritario: ServicePriority;
  tempi: number;
  ore: number;
  fuel_surc: number;
  coefficiente: number;
  // Tarificación por distancia (zona KM)
  zone_dist_km: string;
  zone_km_fasce: string;
  zone_km_moltipl: string;
  zone_km_duplica: string;
  zone_km_daqui: string;
}
const editForm = reactive<ServiceFormState>({
  descr: '',
  tipo: 'EXP',
  way: 'A',
  from_paese_iso: 'IT',
  geozona: 'NA',
  prioritario: 'N',
  tempi: 0,
  ore: 19,
  fuel_surc: 0,
  coefficiente: 0,
  zone_dist_km: 'N',
  zone_km_fasce: '',
  zone_km_moltipl: 'N',
  zone_km_duplica: 'N',
  zone_km_daqui: '',
});

/** El form expone la zona KM con switches booleanos; el backend espera 'S'/'N'. */
const kmEnabled = computed({
  get: () => editForm.zone_dist_km === 'S',
  set: (v: boolean) => { editForm.zone_dist_km = v ? 'S' : 'N'; },
});
const kmMoltipl = computed({
  get: () => editForm.zone_km_moltipl === 'S',
  set: (v: boolean) => { editForm.zone_km_moltipl = v ? 'S' : 'N'; },
});
const kmDuplica = computed({
  get: () => editForm.zone_km_duplica === 'S',
  set: (v: boolean) => { editForm.zone_km_duplica = v ? 'S' : 'N'; },
});

function selectService(sv: CarrierService): void {
  selected.value = sv;
  editMode.value = false;
  detailTab.value = 'info';
  viewState.value = 'detail';
  void loadSupplements(sv.id);
  void loadZones(1);
}

function backToLanding(): void {
  viewState.value = 'landing';
  selected.value = null;
  void loadServices();
}

function startEdit(): void {
  if (!selected.value) return;
  const s = selected.value;
  editForm.descr = s.descr || '';
  editForm.tipo = s.tipo || 'EXP';
  editForm.way = s.way || 'A';
  editForm.from_paese_iso = s.from_paese_iso || 'IT';
  editForm.geozona = s.geozona || 'NA';
  editForm.prioritario = s.prioritario || 'N';
  editForm.tempi = s.tempi ?? 0;
  editForm.ore = s.ore ?? 19;
  editForm.fuel_surc = s.fuel_surc ?? 0;
  editForm.coefficiente = s.coefficiente ?? 0;
  editForm.zone_dist_km = (s.zone_dist_km as string) || 'N';
  editForm.zone_km_fasce = (s.zone_km_fasce as string) || '';
  editForm.zone_km_moltipl = (s.zone_km_moltipl as string) || 'N';
  editForm.zone_km_duplica = (s.zone_km_duplica as string) || 'N';
  editForm.zone_km_daqui = (s.zone_km_daqui as string) || '';
  editMode.value = true;
}

async function saveService(): Promise<void> {
  if (!selected.value) return;
  savingService.value = true;
  try {
    await supplierServiceService.update({ id: selected.value.id, ...editForm });
    Object.assign(selected.value, editForm);
    toast.success(t('carrier_services.service_updated'));
    editMode.value = false;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    savingService.value = false;
  }
}

// ── Supplements ──
const supplements = ref<ServiceSupplement[]>([]);
const supplLoading = ref(false);

// ServiceSupplement.id es opcional en el tipo (el mismo shape sirve de
// payload al crear, sin id todavía), pero toda fila YA CARGADA del backend
// siempre trae uno — listSupplements() nunca devuelve filas sin persistir.
// IndexedSupplement lo hace explícito para ListingDataView sin ampliar el
// tipo compartido.
type IndexedSupplement = ServiceSupplement & { id: number };
const indexedSupplements = computed<IndexedSupplement[]>(
  () => supplements.value.filter((s): s is IndexedSupplement => s.id !== undefined),
);
const selectedSupplements = ref<{ id: number }[]>([]);
const supplementsListSource = useClientSideListSource(indexedSupplements, { loading: supplLoading });
const supplementsHeaders: DataTableHeader[] = [
  { title: t('carrier_services.col_supplement') as string, key: 'id_suppl' },
  { title: t('carrier_services.col_weight_range') as string, key: 'weight_range', sortable: false },
  { title: t('carrier_services.col_order') as string, key: 'orderby', width: 80 },
  { title: t('common.actions') as string, key: 'actions', width: 90, align: 'end', sortable: false },
];
const supplementsSortKeyMap: Record<string, string> = { id_suppl: 'id_suppl', orderby: 'orderby' };
const supplDialog = ref(false);
const supplMode = ref<'create' | 'edit'>('create');
const savingSuppl = ref(false);

interface SupplFormState {
  id?: number;
  id_servizio: number;
  id_suppl: number | string;
  peso_min: number;
  peso_max: number;
  orderby: number;
  stato: string;
  // Auto-detect rule fields (servizi_fornitori_suppl)
  peso_quale: string;     // R = real, V = volumetric
  peso_a_steps: string;   // S/N apply per weight step
  lato_a: number;
  lato_b: number;
  lato_h: number;
  lato_sup: number;       // any side > this (cm)
  num_colli_min: number;  // multicollo if pieces > this
  perimetro_min: number;
  perimetro_max: number;
  colli_pall: string;     // C colli / P pallets / E both
  and_or: string;         // A all / O any condition
  onlyone: string;        // N all, S/S1/S2/S3 only one
  note: string;
}
const SUPPL_DEFAULTS: Omit<SupplFormState, 'id' | 'id_servizio'> = {
  id_suppl: '',
  peso_min: 0,
  peso_max: 0,
  orderby: 0,
  stato: 'A',
  peso_quale: 'R',
  peso_a_steps: 'N',
  lato_a: 0,
  lato_b: 0,
  lato_h: 0,
  lato_sup: 0,
  num_colli_min: 0,
  perimetro_min: 0,
  perimetro_max: 0,
  colli_pall: 'E',
  and_or: 'O',
  onlyone: 'N',
  note: '',
};
const supplForm = reactive<SupplFormState>({
  id_servizio: 0,
  ...SUPPL_DEFAULTS,
});

async function loadSupplements(serviceId: number): Promise<void> {
  supplLoading.value = true;
  try {
    supplements.value = await supplierServiceService.listSupplements(serviceId);
  } catch {
    supplements.value = [];
  } finally {
    supplLoading.value = false;
  }
}

function openSupplCreate(): void {
  if (!selected.value) return;
  supplMode.value = 'create';
  supplForm.id = undefined;
  supplForm.id_servizio = selected.value.id;
  Object.assign(supplForm, SUPPL_DEFAULTS);
  supplDialog.value = true;
}

function num(v: unknown, def = 0): number {
  if (v === '' || v === null || v === undefined) return def;
  const n = Number(v);
  return Number.isNaN(n) ? def : n;
}

function openSupplEdit(s: ServiceSupplement): void {
  supplMode.value = 'edit';
  supplForm.id = s.id;
  supplForm.id_servizio = s.id_servizio;
  supplForm.id_suppl = s.id_suppl ?? '';
  supplForm.peso_min = num(s.peso_min);
  supplForm.peso_max = num(s.peso_max);
  supplForm.orderby = num(s.orderby);
  supplForm.stato = (s.stato as string) ?? 'A';
  supplForm.peso_quale = (s.peso_quale as string) ?? 'R';
  supplForm.peso_a_steps = (s.peso_a_steps as string) ?? 'N';
  supplForm.lato_a = num(s.lato_a);
  supplForm.lato_b = num(s.lato_b);
  supplForm.lato_h = num(s.lato_h);
  supplForm.lato_sup = num(s.lato_sup);
  supplForm.num_colli_min = num(s.num_colli_min);
  supplForm.perimetro_min = num(s.perimetro_min);
  supplForm.perimetro_max = num(s.perimetro_max);
  supplForm.colli_pall = (s.colli_pall as string) ?? 'E';
  supplForm.and_or = (s.and_or as string) ?? 'O';
  supplForm.onlyone = (s.onlyone as string) ?? 'N';
  supplForm.note = (s.note as string) ?? '';
  supplDialog.value = true;
}

async function saveSuppl(): Promise<void> {
  savingSuppl.value = true;
  try {
    await supplierServiceService.saveSupplement({ ...supplForm });
    toast.success(
      supplMode.value === 'create'
        ? t('carrier_services.supplement_added')
        : t('carrier_services.supplement_updated'),
    );
    supplDialog.value = false;
    if (selected.value) await loadSupplements(selected.value.id);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    savingSuppl.value = false;
  }
}

// ── Zones (read-only) ──
function emptyZonePage(): Paginated<ServiceZone> {
  return { items: [], total: 0, page: 1, perPage: 20, pages: 0 };
}
const zonePage = ref<Paginated<ServiceZone>>(emptyZonePage());
const zonesLoading = ref(false);

// Servizio de tipo SUB → sus zonas viven en paesi_zone_sub (ruta país→país),
// no en paesi_zone. Cargar del endpoint correcto según el tipo.
const isSubService = computed(() => selected.value?.zone_subzone === 'SUB');

const selectedZones = ref<{ id: number }[]>([]);
const zonesHeaders = computed<DataTableHeader[]>(() => {
  const cols: DataTableHeader[] = [
    { title: t('carrier_services.col_zone') as string, key: 'zona', width: 70, sortable: false },
    { title: t('carrier_services.col_route') as string, key: 'route', sortable: false },
  ];
  if (isSubService.value) {
    cols.push({ title: t('carrier_services.col_bidirez') as string, key: 'bidirez', width: 80, sortable: false });
  }
  cols.push(
    { title: t('carrier_services.col_days') as string, key: 'tempi', width: 70, sortable: false },
    { title: t('carrier_services.col_note') as string, key: 'nota_zona', sortable: false },
  );
  if (isSubService.value) {
    cols.push({ title: t('common.actions') as string, key: 'actions', width: 90, sortable: false });
  }
  return cols;
});
const zonesSortKeyMap: Record<string, string> = {};

/** Adaptador ListSource server-side sobre `zonePage` (paginación real vía loadZones). */
const zonesListSource: ListSource<ServiceZone> = reactive({
  get total() { return zonePage.value.total; },
  get rows() { return zonePage.value.items; },
  get loading() { return zonesLoading.value; },
  error: null,
  get page() { return zonePage.value.page; },
  get perPage() { return zonePage.value.perPage; },
  sort: '',
  sortDir: 'ASC',
  async loadPage(p: number) { await loadZones(p); },
  async loadMore() { /* solo modo paginado */ },
  async refresh() { await loadZones(1); },
  setSort() { /* sin orden hoy */ },
  setPerPage() { /* tamaño fijo del backend */ },
}) as ListSource<ServiceZone>;

async function loadZones(page = 1): Promise<void> {
  if (!selected.value) return;
  zonesLoading.value = true;
  try {
    zonePage.value = isSubService.value
      ? await supplierServiceService.listSubzones(selected.value.id, page)
      : await supplierServiceService.listZones(selected.value.id, page);
  } catch {
    zonePage.value = emptyZonePage();
  } finally {
    zonesLoading.value = false;
  }
}

// ── Editar fila de subzona (L11) ──
// prov/cap_show/cap_ko se editan y muestran en formato "humano" (lista
// separada por coma, rangos "da>a" en CAP) — el backend deriva cap_list
// (el campo que realmente consume el matching de pricing). Nunca se edita
// cap_list directamente desde aquí. Ver Sub_Zone_Format_Service (backend).
const subzoneDialog = ref(false);
const savingSubzone = ref(false);
const subzoneForm = reactive<SubzonePayload>({});

function openSubzoneEdit(z: ServiceZone): void {
  Object.assign(subzoneForm, {
    id: z.id,
    zona: z.zona,
    tempi: z.tempi,
    nota_zona: z.nota_zona ?? '',
    prov: z.prov ?? '',
    cap_show: z.cap_show ?? '',
    cap_ko: z.cap_ko ?? '',
  });
  subzoneDialog.value = true;
}

async function saveSubzone(): Promise<void> {
  savingSubzone.value = true;
  try {
    await supplierServiceService.updateSubzone({ ...subzoneForm });
    toast.success(t('common.saved'));
    subzoneDialog.value = false;
    await loadZones(zonePage.value.page);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    savingSubzone.value = false;
  }
}

// ── Clonar zonas desde otro servizio (paridad legacy paesi_zone_clona) ──
const cloneZonesDialog = ref(false);
const cloningZones = ref(false);
const cloneSourceId = ref<number | null>(null);
const cloneSourceItems = ref<CarrierService[]>([]);
const cloneSourceSearch = ref('');
const cloneSourceLoading = ref(false);

function openCloneZones(): void {
  cloneSourceId.value = null;
  cloneSourceItems.value = [];
  cloneSourceSearch.value = '';
  cloneZonesDialog.value = true;
}

let cloneSearchTimer: ReturnType<typeof setTimeout> | undefined;
function onCloneSourceSearch(q: string): void {
  cloneSourceSearch.value = q;
  if (cloneSearchTimer) clearTimeout(cloneSearchTimer);
  if (!q || q.length < 2) return;
  cloneSearchTimer = setTimeout(async () => {
    cloneSourceLoading.value = true;
    try {
      // Solo servicios del mismo tipo de zona (SUB con SUB, normal con normal),
      // y nunca el propio servizio destino.
      const found = await supplierServiceService.search(q, 25);
      cloneSourceItems.value = found.filter(
        (s) => s.id !== selected.value?.id
          && (s.zone_subzone === 'SUB') === isSubService.value,
      );
    } catch {
      cloneSourceItems.value = [];
    } finally {
      cloneSourceLoading.value = false;
    }
  }, 300);
}

async function confirmCloneZones(): Promise<void> {
  if (!selected.value || !cloneSourceId.value) return;
  cloningZones.value = true;
  try {
    const n = await supplierServiceService.cloneZones(
      cloneSourceId.value,
      selected.value.id,
      isSubService.value,
    );
    toast.success(t('carrier_services.clone_zones_done', { n }));
    cloneZonesDialog.value = false;
    await loadZones(1);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    cloningZones.value = false;
  }
}

// ── Clone supplements (G5) ──
const cloneSupplDialog = ref(false);
const cloningSuppl = ref(false);
const cloneSupplSourceId = ref<number | null>(null);
const cloneSupplSourceItems = ref<CarrierService[]>([]);
const cloneSupplSourceSearch = ref('');
const cloneSupplSourceLoading = ref(false);

function openCloneSupplements(): void {
  cloneSupplSourceId.value = null;
  cloneSupplSourceItems.value = [];
  cloneSupplSourceSearch.value = '';
  cloneSupplDialog.value = true;
}

let cloneSupplSearchTimer: ReturnType<typeof setTimeout> | undefined;
function onCloneSupplSourceSearch(q: string): void {
  cloneSupplSourceSearch.value = q;
  if (cloneSupplSearchTimer) clearTimeout(cloneSupplSearchTimer);
  if (!q || q.length < 2) return;
  cloneSupplSearchTimer = setTimeout(async () => {
    cloneSupplSourceLoading.value = true;
    try {
      // Cualquier servizio puede donar sus reglas de suplemento; solo
      // excluimos el propio servizio destino.
      const found = await supplierServiceService.search(q, 25);
      cloneSupplSourceItems.value = found.filter((s) => s.id !== selected.value?.id);
    } catch {
      cloneSupplSourceItems.value = [];
    } finally {
      cloneSupplSourceLoading.value = false;
    }
  }, 300);
}

async function confirmCloneSupplements(): Promise<void> {
  if (!selected.value || !cloneSupplSourceId.value) return;
  cloningSuppl.value = true;
  try {
    const n = await supplierServiceService.cloneSupplements(
      cloneSupplSourceId.value,
      selected.value.id,
      true,
    );
    toast.success(t('carrier_services.clone_suppl_done', { n }));
    cloneSupplDialog.value = false;
    await loadSupplements(selected.value.id);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    cloningSuppl.value = false;
  }
}

// ── Create ──
const createDialog = ref(false);
const creating = ref(false);

interface CreateFormState {
  descr: string;
  id_fornitore: number | null;
  tipo: ServiceTipo;
  way: ServiceWay;
  from_paese_iso: string;
  geozona: ServiceGeozona;
}
const createForm = reactive<CreateFormState>({
  descr: '',
  id_fornitore: null,
  tipo: 'EXP',
  way: 'A',
  from_paese_iso: 'IT',
  geozona: 'NA',
});

function openCreate(): void {
  createForm.descr = '';
  createForm.id_fornitore = filterFornitore.value;
  createForm.tipo = 'EXP';
  createForm.way = 'A';
  createForm.from_paese_iso = 'IT';
  createForm.geozona = 'NA';
  createDialog.value = true;
}

async function createService(): Promise<void> {
  if (!createForm.id_fornitore) return;
  creating.value = true;
  try {
    const payload: CarrierServicePayload = {
      descr: createForm.descr,
      id_fornitore: createForm.id_fornitore,
      tipo: createForm.tipo,
      way: createForm.way,
      from_paese_iso: createForm.from_paese_iso,
      geozona: createForm.geozona,
    };
    await supplierServiceService.create(payload);
    toast.success(t('carrier_services.service_created'));
    createDialog.value = false;
    if (filterFornitore.value === createForm.id_fornitore) {
      await loadServices();
    } else {
      filterFornitore.value = createForm.id_fornitore;
      await loadServices();
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    creating.value = false;
  }
}

// ── Clone ──
async function openClone(sv: CarrierService): Promise<void> {
  const ok = await confirm.ask({
    message: t('carrier_services.confirm_clone', { name: sv.descr || '#' + sv.id }),
    title: t('carrier_services.confirm_clone_title'),
  });
  if (!ok) return;
  try {
    await supplierServiceService.clone(sv.id);
    toast.success(t('carrier_services.service_cloned'));
    await loadServices();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

// ── Delete ──
async function openDelete(sv: CarrierService): Promise<void> {
  const ok = await confirm.askDanger(
    t('carrier_services.confirm_delete', { name: sv.descr || '#' + sv.id }),
    t('carrier_services.confirm_delete_title'),
  );
  if (!ok) return;
  try {
    await supplierServiceService.remove(sv.id);
    toast.success(t('carrier_services.service_deleted'));
    if (viewState.value === 'detail') backToLanding();
    else await loadServices();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

// ── Country ISO ↔ paesi id bridge ──
// editForm/createForm persist `from_paese_iso` as an ISO code STRING (default
// 'IT'), while CmPaesiSelect works with the paesi row id (number). Map ISO → id
// for :model-value and write the picked ISO back on @select, keeping the save
// payload untouched. A value not in the catalog is preserved verbatim.
const paesiList = ref<PaeseLite[]>([]);

function normIso(iso: unknown): string {
  return String(iso ?? '').trim().toUpperCase();
}

function isoToPaeseId(iso: string): number | null {
  const v = normIso(iso);
  if (!v) return null;
  const hit = paesiList.value.find((p) => normIso(p.ISO2) === v || normIso(p.ISO) === v);
  return hit ? hit.id : null;
}

function paeseToIso(p: PaeseLite | null, current: string): string {
  if (!p) return current;
  const prev = normIso(current);
  if (prev && prev.length === 3 && p.ISO) return p.ISO;
  return p.ISO2 || p.ISO || current;
}

onMounted(() => {
  // Landing starts empty until a carrier is selected (parity with V1).
  void paesiService
    .list()
    .then((list) => {
      paesiList.value = list;
    })
    .catch(() => {
      paesiList.value = [];
    });
});
</script>

<style scoped>
.cm-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 24px;
  font-size: 13px;
}
</style>
