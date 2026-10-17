<template>
  <div>
    <CmSectionHeader
      :title="t('sections.geographic_config')"
      :subtitle="t('geographic_config.subtitle')"
    />

    <v-tabs v-model="activeTab" density="compact" class="mb-4">
      <v-tab value="countries">{{ t('geographic_config.tab_countries') }}</v-tab>
      <v-tab value="zones">{{ t('geographic_config.tab_zones') }}</v-tab>
      <v-tab value="subzones">{{ t('geographic_config.tab_subzones') }}</v-tab>
      <v-tab value="groups">{{ t('geographic_config.tab_groups') }}</v-tab>
      <v-tab value="remote">{{ t('geographic_config.tab_remote') }}</v-tab>
    </v-tabs>

    <!-- ═══ COUNTRIES ═══ -->
    <div v-show="activeTab === 'countries'">
      <v-card class="pa-4 mb-4" variant="outlined">
        <div class="cm-filters">
          <v-text-field
            v-model="countrySearch"
            :prepend-inner-icon="mdiMagnify"
            :label="t('common.search')"
            density="compact"
            hide-details
            clearable
            style="max-width: 280px"
          />
          <v-select
            v-model="countryFilter"
            :items="countryFilterItems"
            item-title="title"
            item-value="value"
            :label="t('geographic_config.filter_eu')"
            density="compact"
            hide-details
            style="max-width: 160px"
          />
          <v-spacer />
          <span class="cm-cell-hint">{{ t('geographic_config.n_countries', { n: filteredCountries.length }) }}</span>
        </div>
      </v-card>

      <CmEmptyState
        v-if="!countriesLoading && !countriesError && filteredCountries.length === 0"
        :icon="mdiEarth"
        :title="t('geographic_config.empty_countries')"
      />
      <ListingDataView
        v-else
        :source="countryListSource"
        :headers="countryHeaders"
        :selected="selectedCountries"
        :sort-key-map="countrySortKeyMap"
        mode="paginated"
        :selectable="false"
        @update:selected="selectedCountries = $event"
      >
        <template #cell.ISO="{ item }">
          <span class="cm-mono">{{ (item as Country).ISO }}</span>
        </template>
        <template #cell.nome="{ item }">
          {{ (item as Country).nome }}
          <span v-if="(item as Country).nomeEN" class="cm-cell-hint">({{ (item as Country).nomeEN }})</span>
        </template>
        <template #cell.CEE="{ item }">
          <v-chip size="x-small" :color="(item as Country).CEE === 'S' ? 'info' : undefined" variant="tonal">
            {{ (item as Country).CEE === 'S' ? t('geographic_config.eu') : t('geographic_config.non_eu') }}
          </v-chip>
        </template>
        <template #cell.add_days="{ item }">
          <span v-if="((item as Country).add_days ?? 0) > 0" class="text-warning">+{{ (item as Country).add_days }}</span>
          <span v-else class="cm-cell-hint">—</span>
        </template>
        <template #cell.actions="{ item }">
          <div class="cm-actions-right">
            <v-btn size="small" variant="text" :prepend-icon="mdiPencil" @click="openCountryEdit(item as Country)">
              {{ t('common.edit') }}
            </v-btn>
          </div>
        </template>
      </ListingDataView>
      <v-alert v-if="countriesError" type="error" variant="tonal" density="compact" class="mt-2" closable @click:close="countriesError = null">
        {{ countriesError }}
      </v-alert>
    </div>

    <!-- ═══ ZONES ═══ -->
    <div v-show="activeTab === 'zones'">
      <v-card class="pa-4 mb-4" variant="outlined">
        <div class="cm-filters">
          <v-text-field
            v-model="zoneFilterOrigin"
            :label="t('geographic_config.filter_origin')"
            maxlength="2"
            density="compact"
            hide-details
            clearable
            style="max-width: 140px"
            @update:model-value="onZoneFilterChange"
          />
          <v-text-field
            v-model="zoneFilterService"
            :label="t('geographic_config.filter_service')"
            density="compact"
            hide-details
            clearable
            style="max-width: 160px"
            @update:model-value="onZoneFilterChange"
          />
          <v-spacer />
          <span class="cm-cell-hint">{{ t('geographic_config.n_zones', { n: zonePage.total }) }}</span>
          <v-btn color="primary" size="small" :prepend-icon="mdiPlus" @click="openZoneCreate">
            {{ t('geographic_config.assign_zone') }}
          </v-btn>
        </div>
      </v-card>

      <CmEmptyState
        v-if="!zonesLoading && !zonesError && zonePage.items.length === 0"
        :icon="mdiMapMarkerPath"
        :title="t('geographic_config.empty_zones')"
      />
      <ListingDataView
        v-else
        :source="zoneListSource"
        :headers="zoneHeaders"
        :selected="selectedZones"
        :sort-key-map="zoneSortKeyMap"
        mode="paginated"
        :selectable="false"
        @update:selected="selectedZones = $event"
      >
        <template #cell.zona="{ item }">
          <span class="cm-mono text-info">Z{{ (item as CountryZone).zona }}</span>
        </template>
        <template #cell.route="{ item }">
          {{ (item as CountryZone).from_paese_iso }} → {{ (item as CountryZone).id_paese_iso }}
        </template>
        <template #cell.tempi="{ item }">
          {{ (item as CountryZone).tempi }}d
        </template>
        <template #cell.nota_zona="{ item }">
          <span class="cm-cell-hint">{{ (item as CountryZone).nota_zona || '—' }}</span>
        </template>
        <template #cell.id_servizi_forn="{ item }">
          <span class="cm-cell-hint">#{{ (item as CountryZone).id_servizi_forn }}</span>
        </template>
        <template #cell.actions="{ item }">
          <div class="cm-actions-right">
            <v-btn size="small" variant="text" :prepend-icon="mdiPencil" @click="openZoneEdit(item as CountryZone)">
              {{ t('common.edit') }}
            </v-btn>
            <v-btn
              size="small"
              variant="text"
              color="error"
              :prepend-icon="mdiDelete"
              @click="confirmDeleteZone(item as CountryZone)"
            >
              {{ t('common.delete') }}
            </v-btn>
          </div>
        </template>
      </ListingDataView>
      <v-alert v-if="zonesError" type="error" variant="tonal" density="compact" class="mt-2" closable @click:close="zonesError = null">
        {{ zonesError }}
      </v-alert>
    </div>

    <!-- ═══ ROUTE SUBZONES (paesi_zone_sub) ═══ -->
    <div v-show="activeTab === 'subzones'">
      <v-card class="pa-4 mb-4" variant="outlined">
        <div class="cm-filters">
          <v-text-field
            v-model="subzoneFilterOrigin"
            :label="t('geographic_config.filter_origin')"
            maxlength="2" density="compact" hide-details clearable
            style="max-width: 140px"
            @update:model-value="onSubzoneFilterChange"
          />
          <v-text-field
            v-model="subzoneFilterService"
            :label="t('geographic_config.filter_service')"
            density="compact" hide-details clearable
            style="max-width: 160px"
            @update:model-value="onSubzoneFilterChange"
          />
          <v-spacer />
          <span class="cm-cell-hint">{{ t('geographic_config.n_subzones', { n: subzonePage.total }) }}</span>
          <v-btn color="primary" size="small" :prepend-icon="mdiPlus" @click="openSubzoneCreate">
            {{ t('geographic_config.assign_subzone') }}
          </v-btn>
        </div>
      </v-card>

      <CmEmptyState
        v-if="!subzonesLoading && !subzonesError && subzonePage.items.length === 0"
        :icon="mdiMapMarkerPath"
        :title="t('geographic_config.empty_subzones')"
      />
      <ListingDataView
        v-else
        :source="subzoneListSource"
        :headers="subzoneHeaders"
        :selected="selectedSubzones"
        :sort-key-map="subzoneSortKeyMap"
        mode="paginated"
        :selectable="false"
        @update:selected="selectedSubzones = $event"
      >
        <template #cell.zona="{ item }">
          <span class="cm-mono text-info">Z{{ (item as CountrySubzone).zona }}</span>
        </template>
        <template #cell.route="{ item }">
          {{ (item as CountrySubzone).from_paese_iso }} → {{ (item as CountrySubzone).id_paese_iso }}
        </template>
        <template #cell.bidirez="{ item }">
          <v-chip size="x-small" :color="(item as CountrySubzone).bidirez === 'S' ? 'success' : 'default'" variant="tonal">
            {{ (item as CountrySubzone).bidirez === 'S' ? t('common.yes') : t('common.no') }}
          </v-chip>
        </template>
        <template #cell.nota_zona="{ item }">
          <span class="cm-cell-hint">
            {{ (item as CountrySubzone).nota_zona || '—' }}
            <v-chip v-if="capCount((item as CountrySubzone).cap_list)" size="x-small" color="info" variant="tonal" class="ml-1">
              {{ t('geographic_config.cap_badge', { n: capCount((item as CountrySubzone).cap_list) }) }}
            </v-chip>
            <v-chip v-if="capCount((item as CountrySubzone).cap_ko)" size="x-small" color="error" variant="tonal" class="ml-1">
              −{{ capCount((item as CountrySubzone).cap_ko) }}
            </v-chip>
          </span>
        </template>
        <template #cell.id_servizi_forn="{ item }">
          <span class="cm-cell-hint">#{{ (item as CountrySubzone).id_servizi_forn }}</span>
        </template>
        <template #cell.actions="{ item }">
          <div class="cm-actions-right">
            <v-btn size="small" variant="text" :prepend-icon="mdiPencil" @click="openSubzoneEdit(item as CountrySubzone)">
              {{ t('common.edit') }}
            </v-btn>
            <v-btn size="small" variant="text" color="error" :prepend-icon="mdiDelete" @click="confirmDeleteSubzone(item as CountrySubzone)">
              {{ t('common.delete') }}
            </v-btn>
          </div>
        </template>
      </ListingDataView>
      <v-alert v-if="subzonesError" type="error" variant="tonal" density="compact" class="mt-2" closable @click:close="subzonesError = null">
        {{ subzonesError }}
      </v-alert>
    </div>

    <!-- ═══ COUNTRY GROUPS ═══ -->
    <div v-show="activeTab === 'groups'">
      <div class="cm-actions-right mb-3">
        <v-btn color="primary" size="small" :prepend-icon="mdiPlus" @click="openGroupCreate">
          {{ t('geographic_config.new_group') }}
        </v-btn>
      </div>

      <CmAsyncSection
        :loading="groupsLoading"
        :error="groupsError"
        :empty="!groupsLoading && !groupsError && groups.length === 0"
        :data="groups"
        loading-type="skeleton"
        :skeleton-rows="4"
        :skeleton-cols="2"
        @clear-error="groupsError = null"
      >
        <template #empty>
          <CmEmptyState :icon="mdiSelectGroup" :title="t('geographic_config.empty_groups')" />
        </template>

        <template #default>
          <v-card v-for="g in groups" :key="g.id" variant="outlined" class="pa-3 mb-2">
            <div class="d-flex align-center ga-3">
              <div class="flex-grow-1">
                <div>
                  {{ g.nome }}
                  <span v-if="g.nome_EN" class="cm-cell-hint">({{ g.nome_EN }})</span>
                </div>
                <div class="cm-cell-hint">
                  {{ t('geographic_config.n_members', { n: g.member_count || 0 }) }} · {{ t('geographic_config.order') }}: {{ g.orderby }}
                </div>
              </div>
              <v-btn size="small" variant="text" @click="toggleGroupMembers(g)">
                {{ t('geographic_config.members') }}
              </v-btn>
              <v-btn size="small" variant="text" :prepend-icon="mdiPencil" @click="openGroupEdit(g)">
                {{ t('common.edit') }}
              </v-btn>
              <v-btn size="small" variant="text" color="error" :prepend-icon="mdiDelete" @click="confirmDeleteGroup(g)">
                {{ t('common.delete') }}
              </v-btn>
            </div>
            <div v-if="expandedGroupId === g.id && groupMembers.length" class="cm-chip-row mt-2">
              <v-chip v-for="m in groupMembers" :key="m.id" size="x-small" variant="tonal">
                {{ m.ISO }} {{ m.nome }}
              </v-chip>
            </div>
          </v-card>
        </template>
      </CmAsyncSection>
    </div>

    <!-- ═══ REMOTE / KO AREAS (aree_ko_remote) ═══ -->
    <div v-show="activeTab === 'remote'">
      <v-card class="pa-4 mb-4" variant="outlined">
        <div class="cm-filters">
          <v-text-field
            v-model="remoteFilterFornitore"
            :label="t('geographic_config.filter_fornitore')"
            density="compact"
            hide-details
            clearable
            style="max-width: 160px"
            @update:model-value="onRemoteFilterChange"
          />
          <v-text-field
            v-model="remoteFilterIso"
            :label="t('geographic_config.filter_origin')"
            maxlength="2"
            density="compact"
            hide-details
            clearable
            style="max-width: 120px"
            @update:model-value="onRemoteFilterChange"
          />
          <v-select
            v-model="remoteFilterTipo"
            :items="remoteTipoFilterItems"
            item-title="title"
            item-value="value"
            :label="t('geographic_config.col_type')"
            density="compact"
            hide-details
            style="max-width: 150px"
            @update:model-value="onRemoteFilterChange"
          />
          <v-spacer />
          <span class="cm-cell-hint">{{ t('geographic_config.n_remote', { n: remotePage.total }) }}</span>
          <v-btn color="primary" size="small" :prepend-icon="mdiPlus" @click="openRemoteCreate">
            {{ t('geographic_config.new_remote') }}
          </v-btn>
        </div>
      </v-card>

      <CmEmptyState
        v-if="!remoteLoading && !remoteError && remotePage.items.length === 0"
        :icon="mdiMapMarkerOff"
        :title="t('geographic_config.empty_remote')"
      />
      <ListingDataView
        v-else
        :source="remoteListSource"
        :headers="remoteHeaders"
        :selected="selectedRemote"
        :sort-key-map="remoteSortKeyMap"
        mode="paginated"
        :selectable="false"
        @update:selected="selectedRemote = $event"
      >
        <template #cell.tipo="{ item }">
          <v-chip
            size="x-small"
            :color="(item as RemoteArea).tipo === 'KO' ? 'error' : 'warning'"
            variant="tonal"
          >{{ (item as RemoteArea).tipo }}</v-chip>
        </template>
        <template #cell.id_fornitore="{ item }">
          <span class="cm-cell-hint">#{{ (item as RemoteArea).id_fornitore }}</span>
        </template>
        <template #cell.iso="{ item }">
          <span class="cm-mono">{{ (item as RemoteArea).iso }}</span>
        </template>
        <template #cell.citta="{ item }">
          {{ (item as RemoteArea).citta || '—' }}
        </template>
        <template #cell.cap="{ item }">
          <span class="cm-mono">{{ (item as RemoteArea).cap || '—' }}</span>
        </template>
        <template #cell.actions="{ item }">
          <div class="cm-actions-right">
            <v-btn size="small" variant="text" :prepend-icon="mdiPencil" @click="openRemoteEdit(item as RemoteArea)">
              {{ t('common.edit') }}
            </v-btn>
            <v-btn
              size="small"
              variant="text"
              color="error"
              :prepend-icon="mdiDelete"
              @click="confirmDeleteRemote(item as RemoteArea)"
            >
              {{ t('common.delete') }}
            </v-btn>
          </div>
        </template>
      </ListingDataView>
      <v-alert v-if="remoteError" type="error" variant="tonal" density="compact" class="mt-2" closable @click:close="remoteError = null">
        {{ remoteError }}
      </v-alert>
    </div>

    <!-- ═══ COUNTRY DIALOG ═══ -->
    <v-dialog v-model="countryDialog" max-width="500" persistent>
      <v-card>
        <v-card-title>{{ t('geographic_config.dialog_edit_country') }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="countryForm.nome" :label="t('geographic_config.form_name_it')" density="compact" class="mb-3" />
          <v-text-field v-model="countryForm.nomeEN" :label="t('geographic_config.form_name_en')" density="compact" class="mb-3" />
          <div class="cm-grid mb-3">
            <v-select
              v-model="countryForm.CEE"
              :items="euItems"
              item-title="title"
              item-value="value"
              :label="t('geographic_config.form_eu_member')"
              density="compact"
            />
            <v-select
              v-model="countryForm.mostra"
              :items="visibleItems"
              item-title="title"
              item-value="value"
              :label="t('geographic_config.form_visible')"
              density="compact"
            />
          </div>
          <div class="cm-grid">
            <v-text-field
              v-model.number="countryForm.add_days"
              :label="t('geographic_config.form_extra_days')"
              type="number"
              density="compact"
            />
            <v-text-field
              v-model.number="countryForm.add_days_par"
              :label="t('geographic_config.form_extra_days_partner')"
              type="number"
              density="compact"
            />
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="savingCountry" @click="countryDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" :loading="savingCountry" @click="saveCountry">{{ t('common.save') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ═══ ZONE DIALOG ═══ -->
    <v-dialog v-model="zoneDialog" max-width="500" persistent>
      <v-card>
        <v-card-title>
          {{ zoneMode === 'create' ? t('geographic_config.dialog_assign_zone') : t('geographic_config.dialog_edit_zone') }}
        </v-card-title>
        <v-card-text>
          <div class="cm-grid mb-3">
            <CmPaesiSelect
              :model-value="isoToPaeseId(zoneForm.from_paese_iso)"
              :label="t('geographic_config.form_origin')"
              :clearable="false"
              @select="(p) => (zoneForm.from_paese_iso = paeseToIso(p, zoneForm.from_paese_iso))"
            />
            <CmPaesiSelect
              :model-value="isoToPaeseId(zoneForm.id_paese_iso)"
              :label="t('geographic_config.form_destination')"
              :clearable="false"
              @select="(p) => (zoneForm.id_paese_iso = paeseToIso(p, zoneForm.id_paese_iso))"
            />
          </div>
          <div class="cm-grid mb-3">
            <v-text-field v-model.number="zoneForm.zona" :label="t('geographic_config.form_zone_number')" type="number" density="compact" />
            <v-text-field v-model.number="zoneForm.tempi" :label="t('geographic_config.form_transit_days')" type="number" density="compact" />
          </div>
          <CmSupplierServiceAutocomplete
            :model-value="zoneForm.id_servizi_forn ? Number(zoneForm.id_servizi_forn) : null"
            :label="t('geographic_config.form_service_id')"
            :clearable="false"
            class="mb-3"
            @update:model-value="(v) => (zoneForm.id_servizi_forn = v ?? '')"
          />
          <v-text-field v-model="zoneForm.nota_zona" :label="t('geographic_config.form_zone_note')" density="compact" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="savingZone" @click="zoneDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn
            color="primary"
            :loading="savingZone"
            :disabled="!zoneForm.from_paese_iso || !zoneForm.id_paese_iso || !zoneForm.id_servizi_forn"
            @click="saveZone"
          >
            {{ t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ═══ SUBZONE DIALOG ═══ -->
    <v-dialog v-model="subzoneDialog" max-width="520" persistent>
      <v-card>
        <v-card-title>
          {{ subzoneMode === 'create' ? t('geographic_config.dialog_assign_subzone') : t('geographic_config.dialog_edit_subzone') }}
        </v-card-title>
        <v-card-text>
          <div class="cm-grid mb-3">
            <CmPaesiSelect
              :model-value="isoToPaeseId(subzoneForm.from_paese_iso)"
              :label="t('geographic_config.form_origin')"
              :clearable="false"
              @select="(p) => (subzoneForm.from_paese_iso = paeseToIso(p, subzoneForm.from_paese_iso))"
            />
            <CmPaesiSelect
              :model-value="isoToPaeseId(subzoneForm.id_paese_iso)"
              :label="t('geographic_config.form_destination')"
              :clearable="false"
              @select="(p) => (subzoneForm.id_paese_iso = paeseToIso(p, subzoneForm.id_paese_iso))"
            />
          </div>
          <div class="cm-grid mb-3">
            <v-text-field v-model.number="subzoneForm.zona" :label="t('geographic_config.form_zone_number')" type="number" density="compact" />
            <v-text-field v-model.number="subzoneForm.tempi" :label="t('geographic_config.form_transit_days')" type="number" density="compact" />
          </div>
          <div class="cm-grid mb-3">
            <CmSupplierServiceAutocomplete
              :model-value="subzoneForm.id_servizi_forn ? Number(subzoneForm.id_servizi_forn) : null"
              :label="t('geographic_config.form_service_id')"
              :clearable="false"
              @update:model-value="(v) => (subzoneForm.id_servizi_forn = v ?? '')"
            />
            <v-text-field v-model.number="subzoneForm.gruppo" :label="t('geographic_config.form_group')" type="number" density="compact" />
          </div>
          <v-text-field v-model="subzoneForm.nota_zona" :label="t('geographic_config.form_zone_note')" density="compact" class="mb-3" />
          <!-- Matching avanzado: provincia + CAP incluidos/excluidos (paesi_zone_sub) -->
          <v-text-field
            v-model="subzoneForm.prov"
            :label="t('geographic_config.form_prov')"
            :hint="t('geographic_config.form_prov_hint')"
            persistent-hint density="compact" class="mb-3"
          />
          <v-combobox
            v-model="capListChips"
            :label="t('geographic_config.form_cap_list')"
            :hint="t('geographic_config.form_cap_chip_hint')"
            persistent-hint multiple chips closable-chips clearable
            density="compact" class="mb-3"
            @update:model-value="capListChips = sanitizeCapChips($event)"
          />
          <v-combobox
            v-model="capKoChips"
            :label="t('geographic_config.form_cap_ko')"
            :hint="t('geographic_config.form_cap_chip_hint')"
            persistent-hint multiple chips closable-chips clearable
            density="compact" class="mb-3"
            @update:model-value="capKoChips = sanitizeCapChips($event)"
          />
          <div class="cm-grid">
            <v-switch v-model="subzoneForm.bidirezBool" :label="t('geographic_config.form_bidirez')" color="primary" density="compact" hide-details inset />
            <v-switch v-model="subzoneForm.invpresaBool" :label="t('geographic_config.form_invpresa')" color="primary" density="compact" hide-details inset />
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="savingSubzone" @click="subzoneDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn
            color="primary"
            :loading="savingSubzone"
            :disabled="!subzoneForm.from_paese_iso || !subzoneForm.id_paese_iso || !subzoneForm.id_servizi_forn"
            @click="saveSubzone"
          >
            {{ t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ═══ GROUP DIALOG ═══ -->
    <v-dialog v-model="groupDialog" max-width="540" persistent>
      <v-card>
        <v-card-title>
          {{ groupMode === 'create' ? t('geographic_config.dialog_create_group') : t('geographic_config.dialog_edit_group') }}
        </v-card-title>
        <v-card-text>
          <div class="cm-grid mb-3">
            <v-text-field v-model="groupForm.nome" :label="t('geographic_config.form_name_it')" density="compact" />
            <v-text-field v-model="groupForm.nome_EN" :label="t('geographic_config.form_name_en')" density="compact" />
          </div>
          <v-text-field v-model="groupForm.help" :label="t('geographic_config.form_desc_it')" density="compact" class="mb-3" />
          <v-text-field v-model="groupForm.help_EN" :label="t('geographic_config.form_desc_en')" density="compact" class="mb-3" />
          <v-text-field v-model.number="groupForm.orderby" :label="t('geographic_config.form_order')" type="number" density="compact" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="savingGroup" @click="groupDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" :loading="savingGroup" :disabled="!groupForm.nome" @click="saveGroup">
            {{ t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ═══ REMOTE AREA DIALOG ═══ -->
    <v-dialog v-model="remoteDialog" max-width="500" persistent>
      <v-card>
        <v-card-title>
          {{ remoteMode === 'create' ? t('geographic_config.dialog_new_remote') : t('geographic_config.dialog_edit_remote') }}
        </v-card-title>
        <v-card-text>
          <div class="cm-grid mb-3">
            <CmAnagraficaAutocomplete
              :model-value="toNumOrNull(remoteForm.id_fornitore)"
              :label="t('geographic_config.form_fornitore_id')"
              @update:model-value="(v) => (remoteForm.id_fornitore = v ?? '')"
            />
            <v-select
              v-model="remoteForm.tipo"
              :items="remoteTipoItems"
              item-title="title"
              item-value="value"
              :label="t('geographic_config.col_type')"
              density="compact"
            />
          </div>
          <CmPaesiSelect
            :model-value="isoToPaeseId(remoteForm.iso)"
            :label="t('geographic_config.form_origin')"
            :clearable="false"
            class="mb-3"
            @select="(p) => (remoteForm.iso = paeseToIso(p, remoteForm.iso))"
          />
          <v-text-field
            v-model="remoteForm.citta"
            :label="t('geographic_config.form_city')"
            :hint="t('geographic_config.form_city_hint')"
            persistent-hint
            density="compact"
            class="mb-3"
          />
          <v-text-field
            v-model="remoteForm.cap"
            :label="t('geographic_config.form_cap')"
            density="compact"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="savingRemote" @click="remoteDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn
            color="primary"
            :loading="savingRemote"
            :disabled="!remoteForm.id_fornitore || !remoteForm.iso || (!remoteForm.cap && !remoteForm.citta)"
            @click="saveRemote"
          >
            {{ t('common.save') }}
          </v-btn>
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
  mdiEarth,
  mdiMapMarkerPath,
  mdiMapMarkerOff,
  mdiSelectGroup,
} from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import CmPaesiSelect from '../components/CmPaesiSelect.vue';
import CmAnagraficaAutocomplete from '../../listini/components/CmAnagraficaAutocomplete.vue';
import CmSupplierServiceAutocomplete from '../../carrier_services/components/CmSupplierServiceAutocomplete.vue';
import { paesiService, type PaeseLite } from '../services/paesi.service';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import type { Paginated } from '../../anagrafiche/services/api.types';
import ListingDataView from '../../listing/ListingDataView.vue';
import { useClientSideListSource } from '../../listing/useClientSideListSource';
import type { DataTableHeader, ListSource } from '../../listing/types';
import {
  geographicConfigService,
  type Country,
  type CountryZone,
  type CountrySubzone,
  type CountryGroup,
  type CountryGroupMember,
  type RemoteArea,
} from '../services/geographicConfig.service';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const activeTab = ref<'countries' | 'zones' | 'subzones' | 'groups' | 'remote'>('countries');

// ── Country ISO ↔ paesi id bridge ────────────────────────────────────────────
// The form fields (from_paese_iso / id_paese_iso / iso) persist a country ISO
// code STRING (default 'IT'), while CmPaesiSelect works with the paesi row id
// (number). We keep the save payload untouched by mapping ISO → id for
// :model-value and writing the picked country's ISO code back on @select.
// A persisted value that isn't in the catalog is preserved verbatim (the
// selector simply shows empty until the user picks).
const paesiList = ref<PaeseLite[]>([]);

function normIso(iso: unknown): string {
  return String(iso ?? '').trim().toUpperCase();
}

/** Resolve a stored ISO code (2- or 3-letter) to its paesi row id. */
function isoToPaeseId(iso: string): number | null {
  const v = normIso(iso);
  if (!v) return null;
  const hit = paesiList.value.find((p) => normIso(p.ISO2) === v || normIso(p.ISO) === v);
  return hit ? hit.id : null;
}

/**
 * Map a picked country back to the ISO code string to persist. Matches the
 * length of the previously stored value (2-letter default) to avoid changing
 * the payload semantics; falls back to the current value if nothing picked.
 */
function paeseToIso(p: PaeseLite | null, current: string): string {
  if (!p) return current;
  const prev = normIso(current);
  // If the field previously held a 3-letter ISO, keep that variant; else ISO2.
  if (prev && prev.length === 3 && p.ISO) return p.ISO;
  return p.ISO2 || p.ISO || current;
}

function toNumOrNull(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}

// ── Countries ──
const countries = ref<Country[]>([]);
const countriesLoading = ref(false);
const countriesError = ref<string | null>(null);
const countrySearch = ref('');
const countryFilter = ref<'' | 'CEE' | 'nonCEE'>('');
const countryDialog = ref(false);
const savingCountry = ref(false);

const countryFilterItems = computed(() => [
  { title: t('common.all'), value: '' },
  { title: t('geographic_config.eu_only'), value: 'CEE' },
  { title: t('geographic_config.non_eu_only'), value: 'nonCEE' },
]);
const euItems = computed(() => [
  { title: t('geographic_config.eu'), value: 'S' },
  { title: t('geographic_config.non_eu'), value: 'N' },
]);
const visibleItems = computed(() => [
  { title: t('geographic_config.show'), value: 'S' },
  { title: t('geographic_config.hide'), value: 'N' },
]);

interface CountryFormState {
  id: number;
  nome: string;
  nomeEN: string;
  CEE: 'S' | 'N';
  add_days: number;
  add_days_par: number;
  mostra: 'S' | 'N';
  usa_cap: string;
  usa_prov: string;
}
const countryForm = reactive<CountryFormState>({
  id: 0,
  nome: '',
  nomeEN: '',
  CEE: 'N',
  add_days: 0,
  add_days_par: 0,
  mostra: 'S',
  usa_cap: 'S',
  usa_prov: 'F',
});

const filteredCountries = computed(() => {
  let list = countries.value;
  if (countrySearch.value) {
    const s = countrySearch.value.toLowerCase();
    list = list.filter(
      (c) =>
        (c.nome || '').toLowerCase().includes(s) ||
        (c.nomeEN || '').toLowerCase().includes(s) ||
        (c.ISO || '').toLowerCase().includes(s),
    );
  }
  if (countryFilter.value === 'CEE') list = list.filter((c) => c.CEE === 'S');
  else if (countryFilter.value === 'nonCEE') list = list.filter((c) => c.CEE !== 'S');
  return list;
});

const selectedCountries = ref<{ id: number }[]>([]);
const countryListSource = useClientSideListSource(filteredCountries, { loading: countriesLoading });
const countryHeaders: DataTableHeader[] = [
  { title: t('geographic_config.col_iso') as string, key: 'ISO', width: 60, sortable: false },
  { title: t('geographic_config.col_name') as string, key: 'nome', sortable: false },
  { title: t('geographic_config.col_eu') as string, key: 'CEE', width: 80, sortable: false },
  { title: t('geographic_config.col_extra_days') as string, key: 'add_days', width: 80, sortable: false },
  { title: '', key: 'actions', width: 80, align: 'end', sortable: false },
];
const countrySortKeyMap: Record<string, string> = {};

async function loadCountries(): Promise<void> {
  countriesLoading.value = true;
  countriesError.value = null;
  try {
    countries.value = await geographicConfigService.listCountries();
  } catch (e) {
    countriesError.value = e instanceof Error ? e.message : String(e);
  } finally {
    countriesLoading.value = false;
  }
}

function openCountryEdit(c: Country): void {
  countryForm.id = c.id;
  countryForm.nome = c.nome || '';
  countryForm.nomeEN = c.nomeEN || '';
  countryForm.CEE = (c.CEE as 'S' | 'N') || 'N';
  countryForm.add_days = c.add_days || 0;
  countryForm.add_days_par = c.add_days_par || 0;
  countryForm.mostra = (c.mostra as 'S' | 'N') || 'S';
  countryForm.usa_cap = (c.usa_cap as string) || 'S';
  countryForm.usa_prov = (c.usa_prov as string) || 'F';
  countryDialog.value = true;
}

async function saveCountry(): Promise<void> {
  savingCountry.value = true;
  try {
    await geographicConfigService.updateCountry({ ...countryForm });
    toast.success(t('geographic_config.country_updated'));
    countryDialog.value = false;
    await loadCountries();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    savingCountry.value = false;
  }
}

// ── Zones ──
function emptyZonePage(): Paginated<CountryZone> {
  return { items: [], total: 0, page: 1, perPage: 30, pages: 0 };
}
const zonePage = ref<Paginated<CountryZone>>(emptyZonePage());
const zonesLoading = ref(false);
const zonesError = ref<string | null>(null);
const zoneFilterOrigin = ref('');
const zoneFilterService = ref('');
const zoneDialog = ref(false);
const zoneMode = ref<'create' | 'edit'>('create');
const savingZone = ref(false);

interface ZoneFormState {
  id?: number;
  from_paese_iso: string;
  id_paese_iso: string;
  id_fornitore: string | number;
  id_servizi_forn: string | number;
  zona: number;
  tempi: number;
  nota_zona: string;
}
const zoneForm = reactive<ZoneFormState>({
  from_paese_iso: 'IT',
  id_paese_iso: '',
  id_fornitore: '',
  id_servizi_forn: '',
  zona: 0,
  tempi: 0,
  nota_zona: '',
});

async function loadZones(page = 1): Promise<void> {
  zonesLoading.value = true;
  zonesError.value = null;
  try {
    zonePage.value = await geographicConfigService.listZones(page, {
      from_paese_iso: zoneFilterOrigin.value || undefined,
      id_servizi_forn: zoneFilterService.value || undefined,
    });
  } catch (e) {
    zonesError.value = e instanceof Error ? e.message : String(e);
  } finally {
    zonesLoading.value = false;
  }
}

function onZoneFilterChange(): void {
  void loadZones(1);
}

const selectedZones = ref<{ id: number }[]>([]);
const zoneHeaders: DataTableHeader[] = [
  { title: t('geographic_config.col_zone') as string, key: 'zona', width: 70, sortable: false },
  { title: t('geographic_config.col_route') as string, key: 'route', sortable: false },
  { title: t('geographic_config.col_days') as string, key: 'tempi', width: 70, sortable: false },
  { title: t('geographic_config.col_note') as string, key: 'nota_zona', sortable: false },
  { title: t('geographic_config.col_service') as string, key: 'id_servizi_forn', width: 90, sortable: false },
  { title: t('common.actions') as string, key: 'actions', width: 120, align: 'end', sortable: false },
];
const zoneSortKeyMap: Record<string, string> = {};

/** Adaptador ListSource server-side sobre el estado paginado ya existente (`zonePage`, `loadZones`). */
const zoneListSource: ListSource<CountryZone> = reactive({
  get total() { return zonePage.value.total; },
  get rows() { return zonePage.value.items; },
  get loading() { return zonesLoading.value; },
  get error() { return zonesError.value; },
  get page() { return zonePage.value.page; },
  get perPage() { return zonePage.value.perPage; },
  sort: '',
  sortDir: 'ASC',
  async loadPage(p: number) { await loadZones(p); },
  async loadMore() { /* solo modo paginado */ },
  async refresh() { await loadZones(1); },
  setSort() { /* columnas no ordenables hoy */ },
  setPerPage() { /* tamaño de página fijo por ahora */ },
}) as ListSource<CountryZone>;

function openZoneCreate(): void {
  zoneMode.value = 'create';
  zoneForm.id = undefined;
  zoneForm.from_paese_iso = 'IT';
  zoneForm.id_paese_iso = '';
  zoneForm.id_fornitore = '';
  zoneForm.id_servizi_forn = '';
  zoneForm.zona = 0;
  zoneForm.tempi = 0;
  zoneForm.nota_zona = '';
  zoneDialog.value = true;
}

function openZoneEdit(z: CountryZone): void {
  zoneMode.value = 'edit';
  zoneForm.id = z.id;
  zoneForm.from_paese_iso = z.from_paese_iso || '';
  zoneForm.id_paese_iso = z.id_paese_iso || '';
  zoneForm.id_fornitore = z.id_fornitore ?? '';
  zoneForm.id_servizi_forn = z.id_servizi_forn ?? '';
  zoneForm.zona = z.zona ?? 0;
  zoneForm.tempi = z.tempi ?? 0;
  zoneForm.nota_zona = z.nota_zona || '';
  zoneDialog.value = true;
}

async function saveZone(): Promise<void> {
  savingZone.value = true;
  try {
    const payload = {
      id: zoneForm.id,
      from_paese_iso: zoneForm.from_paese_iso,
      id_paese_iso: zoneForm.id_paese_iso,
      id_fornitore: zoneForm.id_fornitore,
      id_servizi_forn: zoneForm.id_servizi_forn,
      zona: zoneForm.zona,
      tempi: zoneForm.tempi,
      nota_zona: zoneForm.nota_zona,
    };
    if (zoneMode.value === 'create') {
      await geographicConfigService.createZone(payload);
      toast.success(t('geographic_config.zone_created'));
    } else {
      await geographicConfigService.updateZone(payload);
      toast.success(t('geographic_config.zone_updated'));
    }
    zoneDialog.value = false;
    await loadZones(zonePage.value.page);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    savingZone.value = false;
  }
}

async function confirmDeleteZone(z: CountryZone): Promise<void> {
  const ok = await confirm.askDanger(
    t('geographic_config.confirm_delete_zone', { route: `${z.from_paese_iso} → ${z.id_paese_iso}` }),
    t('geographic_config.confirm_delete_title'),
  );
  if (!ok) return;
  try {
    await geographicConfigService.removeZone(z.id);
    toast.success(t('geographic_config.zone_deleted'));
    await loadZones(zonePage.value.page);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

// ── Subzones (paesi_zone_sub) ──
function emptySubzonePage(): Paginated<CountrySubzone> {
  return { items: [], total: 0, page: 1, perPage: 30, pages: 0 };
}
const subzonePage = ref<Paginated<CountrySubzone>>(emptySubzonePage());
const subzonesLoading = ref(false);
const subzonesError = ref<string | null>(null);
const subzoneFilterOrigin = ref('');
const subzoneFilterService = ref('');
const subzoneDialog = ref(false);
const subzoneMode = ref<'create' | 'edit'>('create');
const savingSubzone = ref(false);

interface SubzoneFormState {
  id?: number;
  from_paese_iso: string;
  id_paese_iso: string;
  id_servizi_forn: string | number;
  zona: number;
  tempi: number;
  nota_zona: string;
  prov: string;
  gruppo: number;
  capList: string;
  capKo: string;
  bidirezBool: boolean;
  invpresaBool: boolean;
}
const subzoneForm = reactive<SubzoneFormState>({
  from_paese_iso: 'IT',
  id_paese_iso: '',
  id_servizi_forn: '',
  zona: 0,
  tempi: 0,
  nota_zona: '',
  prov: '',
  gruppo: 0,
  capList: '',
  capKo: '',
  bidirezBool: false,
  invpresaBool: false,
});

/**
 * Normaliza una lista (CAP o provincias) al formato legacy `,X,Y,` (comas
 * envolventes) que el matching del rating espera (Sub_Zone_Resolver hace
 * strpos(",$val,", lista)). Acepta entrada con o sin comas/espacios.
 */
function normalizeCsvList(raw: string): string {
  const items = (raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
  return items.length ? `,${items.join(',')},` : '';
}

/** Nº de elementos de una lista CSV `,X,Y,` (para el badge de CAP en la tabla). */
function capCount(raw: unknown): number {
  return String(raw ?? '').split(',').map((s) => s.trim()).filter((s) => s !== '').length;
}

// ── Editor de CAP por chips (Fase 4) ──
// Formato legacy: CAP exacto ("20100", "SY16 4LE") o prefijo comodín ("201?"
// = todos los 201xx). El rating hace cap_list LIKE '%,201?,%'.
const capListChips = ref<string[]>([]);
const capKoChips = ref<string[]>([]);

const CAP_EXACT_RE = /^[A-Za-z0-9][A-Za-z0-9 ]{0,9}$/;   // CAP exacto (incl. UK con espacio)
const CAP_PREFIX_RE = /^[0-9]{1,4}\?$/;                  // prefijo comodín NNN?

/** Filtra chips inválidos y normaliza (trim, mayúsculas para CAP alfanuméricos UK). */
function sanitizeCapChips(chips: unknown): string[] {
  if (!Array.isArray(chips)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of chips) {
    const v = String(raw ?? '').trim().toUpperCase();
    if (!v || seen.has(v)) continue;
    if (CAP_EXACT_RE.test(v) || CAP_PREFIX_RE.test(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

/** Parsea una lista legacy `,X,Y,` a array de chips. */
function capStringToChips(raw: unknown): string[] {
  return String(raw ?? '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s !== '');
}

async function loadSubzones(page = 1): Promise<void> {
  subzonesLoading.value = true;
  subzonesError.value = null;
  try {
    subzonePage.value = await geographicConfigService.listSubzones(page, {
      from_paese_iso: subzoneFilterOrigin.value || undefined,
      id_servizi_forn: subzoneFilterService.value || undefined,
    });
  } catch (e) {
    subzonesError.value = e instanceof Error ? e.message : String(e);
  } finally {
    subzonesLoading.value = false;
  }
}

function onSubzoneFilterChange(): void {
  void loadSubzones(1);
}

const selectedSubzones = ref<{ id: number }[]>([]);
const subzoneHeaders: DataTableHeader[] = [
  { title: t('geographic_config.col_zone') as string, key: 'zona', width: 70, sortable: false },
  { title: t('geographic_config.col_route') as string, key: 'route', sortable: false },
  { title: t('geographic_config.col_bidirez') as string, key: 'bidirez', width: 80, sortable: false },
  { title: t('geographic_config.col_note') as string, key: 'nota_zona', sortable: false },
  { title: t('geographic_config.col_service') as string, key: 'id_servizi_forn', width: 90, sortable: false },
  { title: t('common.actions') as string, key: 'actions', width: 120, align: 'end', sortable: false },
];
const subzoneSortKeyMap: Record<string, string> = {};

/** Adaptador ListSource server-side sobre el estado paginado ya existente (`subzonePage`, `loadSubzones`). */
const subzoneListSource: ListSource<CountrySubzone> = reactive({
  get total() { return subzonePage.value.total; },
  get rows() { return subzonePage.value.items; },
  get loading() { return subzonesLoading.value; },
  get error() { return subzonesError.value; },
  get page() { return subzonePage.value.page; },
  get perPage() { return subzonePage.value.perPage; },
  sort: '',
  sortDir: 'ASC',
  async loadPage(p: number) { await loadSubzones(p); },
  async loadMore() { /* solo modo paginado */ },
  async refresh() { await loadSubzones(1); },
  setSort() { /* columnas no ordenables hoy */ },
  setPerPage() { /* tamaño de página fijo por ahora */ },
}) as ListSource<CountrySubzone>;

function openSubzoneCreate(): void {
  subzoneMode.value = 'create';
  subzoneForm.id = undefined;
  subzoneForm.from_paese_iso = 'IT';
  subzoneForm.id_paese_iso = '';
  subzoneForm.id_servizi_forn = '';
  subzoneForm.zona = 0;
  subzoneForm.tempi = 0;
  subzoneForm.nota_zona = '';
  subzoneForm.prov = '';
  subzoneForm.gruppo = 0;
  subzoneForm.capList = '';
  subzoneForm.capKo = '';
  capListChips.value = [];
  capKoChips.value = [];
  subzoneForm.bidirezBool = false;
  subzoneForm.invpresaBool = false;
  subzoneDialog.value = true;
}

function openSubzoneEdit(z: CountrySubzone): void {
  subzoneMode.value = 'edit';
  subzoneForm.id = z.id;
  subzoneForm.from_paese_iso = z.from_paese_iso || '';
  subzoneForm.id_paese_iso = z.id_paese_iso || '';
  subzoneForm.id_servizi_forn = z.id_servizi_forn ?? '';
  subzoneForm.zona = z.zona ?? 0;
  subzoneForm.tempi = z.tempi ?? 0;
  subzoneForm.nota_zona = z.nota_zona || '';
  subzoneForm.prov = String(z.prov ?? '');
  subzoneForm.gruppo = Number(z.gruppo) || 0;
  subzoneForm.capList = String((z.cap_list as string) ?? '');
  subzoneForm.capKo = String((z.cap_ko as string) ?? '');
  capListChips.value = capStringToChips(z.cap_list);
  capKoChips.value = capStringToChips(z.cap_ko);
  subzoneForm.bidirezBool = z.bidirez === 'S';
  subzoneForm.invpresaBool = z.invpresa === 'S';
  subzoneDialog.value = true;
}

async function saveSubzone(): Promise<void> {
  savingSubzone.value = true;
  try {
    const payload = {
      id: subzoneForm.id,
      from_rec: 'N',
      from_paese_iso: subzoneForm.from_paese_iso,
      id_paese_iso: subzoneForm.id_paese_iso,
      id_servizi_forn: subzoneForm.id_servizi_forn,
      zona: subzoneForm.zona,
      tempi: subzoneForm.tempi,
      nota_zona: subzoneForm.nota_zona,
      prov: normalizeCsvList(subzoneForm.prov),
      gruppo: subzoneForm.gruppo,
      cap_list: normalizeCsvList(sanitizeCapChips(capListChips.value).join(',')),
      cap_ko: normalizeCsvList(sanitizeCapChips(capKoChips.value).join(',')),
      bidirez: subzoneForm.bidirezBool ? 'S' : 'N',
      invpresa: subzoneForm.invpresaBool ? 'S' : 'N',
    };
    if (subzoneMode.value === 'create') {
      await geographicConfigService.createSubzone(payload);
      toast.success(t('geographic_config.subzone_created'));
    } else {
      await geographicConfigService.updateSubzone(payload);
      toast.success(t('geographic_config.subzone_updated'));
    }
    subzoneDialog.value = false;
    await loadSubzones(subzonePage.value.page);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    savingSubzone.value = false;
  }
}

async function confirmDeleteSubzone(z: CountrySubzone): Promise<void> {
  const ok = await confirm.askDanger(
    t('geographic_config.confirm_delete_zone', { route: `${z.from_paese_iso} → ${z.id_paese_iso}` }),
    t('geographic_config.confirm_delete_title'),
  );
  if (!ok) return;
  try {
    await geographicConfigService.removeSubzone(z.id);
    toast.success(t('geographic_config.subzone_deleted'));
    await loadSubzones(subzonePage.value.page);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

// ── Groups ──
const groups = ref<CountryGroup[]>([]);
const groupsLoading = ref(false);
const groupsError = ref<string | null>(null);
const groupDialog = ref(false);
const groupMode = ref<'create' | 'edit'>('create');
const savingGroup = ref(false);
const expandedGroupId = ref<number | null>(null);
const groupMembers = ref<CountryGroupMember[]>([]);

interface GroupFormState {
  id?: number;
  nome: string;
  nome_EN: string;
  help: string;
  help_EN: string;
  orderby: number;
}
const groupForm = reactive<GroupFormState>({
  nome: '',
  nome_EN: '',
  help: '',
  help_EN: '',
  orderby: 0,
});

async function loadGroups(): Promise<void> {
  groupsLoading.value = true;
  groupsError.value = null;
  try {
    groups.value = await geographicConfigService.listGroups();
  } catch (e) {
    groupsError.value = e instanceof Error ? e.message : String(e);
  } finally {
    groupsLoading.value = false;
  }
}

async function toggleGroupMembers(g: CountryGroup): Promise<void> {
  if (expandedGroupId.value === g.id) {
    expandedGroupId.value = null;
    return;
  }
  expandedGroupId.value = g.id;
  try {
    groupMembers.value = await geographicConfigService.getGroupMembers(g.id);
  } catch {
    groupMembers.value = [];
  }
}

function openGroupCreate(): void {
  groupMode.value = 'create';
  groupForm.id = undefined;
  groupForm.nome = '';
  groupForm.nome_EN = '';
  groupForm.help = '';
  groupForm.help_EN = '';
  groupForm.orderby = 0;
  groupDialog.value = true;
}

function openGroupEdit(g: CountryGroup): void {
  groupMode.value = 'edit';
  groupForm.id = g.id;
  groupForm.nome = g.nome || '';
  groupForm.nome_EN = g.nome_EN || '';
  groupForm.help = g.help || '';
  groupForm.help_EN = g.help_EN || '';
  groupForm.orderby = g.orderby || 0;
  groupDialog.value = true;
}

async function saveGroup(): Promise<void> {
  savingGroup.value = true;
  try {
    const payload = { ...groupForm };
    if (groupMode.value === 'create') {
      await geographicConfigService.createGroup(payload);
      toast.success(t('geographic_config.group_created'));
    } else {
      await geographicConfigService.updateGroup(payload);
      toast.success(t('geographic_config.group_updated'));
    }
    groupDialog.value = false;
    await loadGroups();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    savingGroup.value = false;
  }
}

async function confirmDeleteGroup(g: CountryGroup): Promise<void> {
  const ok = await confirm.askDanger(
    t('geographic_config.confirm_delete_group', { name: g.nome || '#' + g.id }),
    t('geographic_config.confirm_delete_title'),
  );
  if (!ok) return;
  try {
    await geographicConfigService.removeGroup(g.id);
    toast.success(t('geographic_config.group_deleted'));
    await loadGroups();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

// ── Remote / KO areas (aree_ko_remote) ──
function emptyRemotePage(): Paginated<RemoteArea> {
  return { items: [], total: 0, page: 1, perPage: 30, pages: 0 };
}
const remotePage = ref<Paginated<RemoteArea>>(emptyRemotePage());
const remoteLoading = ref(false);
const remoteError = ref<string | null>(null);
const remoteFilterFornitore = ref('');
const remoteFilterIso = ref('');
const remoteFilterTipo = ref<'' | 'KO' | 'RM'>('');
const remoteDialog = ref(false);
const remoteMode = ref<'create' | 'edit'>('create');
const savingRemote = ref(false);

const remoteTipoItems = computed(() => [
  { title: t('geographic_config.remote_ko'), value: 'KO' },
  { title: t('geographic_config.remote_rm'), value: 'RM' },
]);
const remoteTipoFilterItems = computed(() => [
  { title: t('common.all'), value: '' },
  ...remoteTipoItems.value,
]);

interface RemoteFormState {
  id?: number;
  id_fornitore: string | number;
  iso: string;
  citta: string;
  cap: string;
  tipo: 'KO' | 'RM';
}
const remoteForm = reactive<RemoteFormState>({
  id_fornitore: '',
  iso: 'IT',
  citta: '',
  cap: '',
  tipo: 'KO',
});

async function loadRemoteAreas(page = 1): Promise<void> {
  remoteLoading.value = true;
  remoteError.value = null;
  try {
    remotePage.value = await geographicConfigService.listRemoteAreas(page, {
      id_fornitore: remoteFilterFornitore.value || undefined,
      iso: remoteFilterIso.value || undefined,
      tipo: remoteFilterTipo.value || undefined,
    });
  } catch (e) {
    remoteError.value = e instanceof Error ? e.message : String(e);
  } finally {
    remoteLoading.value = false;
  }
}

function onRemoteFilterChange(): void {
  void loadRemoteAreas(1);
}

const selectedRemote = ref<{ id: number }[]>([]);
const remoteHeaders: DataTableHeader[] = [
  { title: t('geographic_config.col_type') as string, key: 'tipo', width: 70, sortable: false },
  { title: t('geographic_config.col_fornitore') as string, key: 'id_fornitore', width: 90, sortable: false },
  { title: t('geographic_config.col_iso') as string, key: 'iso', width: 70, sortable: false },
  { title: t('geographic_config.col_city') as string, key: 'citta', sortable: false },
  { title: t('geographic_config.col_cap') as string, key: 'cap', width: 110, sortable: false },
  { title: t('common.actions') as string, key: 'actions', width: 120, align: 'end', sortable: false },
];
const remoteSortKeyMap: Record<string, string> = {};

/** Adaptador ListSource server-side sobre el estado paginado ya existente (`remotePage`, `loadRemoteAreas`). */
const remoteListSource: ListSource<RemoteArea> = reactive({
  get total() { return remotePage.value.total; },
  get rows() { return remotePage.value.items; },
  get loading() { return remoteLoading.value; },
  get error() { return remoteError.value; },
  get page() { return remotePage.value.page; },
  get perPage() { return remotePage.value.perPage; },
  sort: '',
  sortDir: 'ASC',
  async loadPage(p: number) { await loadRemoteAreas(p); },
  async loadMore() { /* solo modo paginado */ },
  async refresh() { await loadRemoteAreas(1); },
  setSort() { /* columnas no ordenables hoy */ },
  setPerPage() { /* tamaño de página fijo por ahora */ },
}) as ListSource<RemoteArea>;

function openRemoteCreate(): void {
  remoteMode.value = 'create';
  remoteForm.id = undefined;
  remoteForm.id_fornitore = '';
  remoteForm.iso = 'IT';
  remoteForm.citta = '';
  remoteForm.cap = '';
  remoteForm.tipo = 'KO';
  remoteDialog.value = true;
}

function openRemoteEdit(r: RemoteArea): void {
  remoteMode.value = 'edit';
  remoteForm.id = r.id;
  remoteForm.id_fornitore = r.id_fornitore ?? '';
  remoteForm.iso = r.iso || '';
  remoteForm.citta = r.citta || '';
  remoteForm.cap = r.cap || '';
  remoteForm.tipo = (r.tipo as 'KO' | 'RM') || 'KO';
  remoteDialog.value = true;
}

async function saveRemote(): Promise<void> {
  savingRemote.value = true;
  try {
    const payload = {
      id: remoteForm.id,
      id_fornitore: remoteForm.id_fornitore,
      iso: remoteForm.iso,
      citta: remoteForm.citta,
      cap: remoteForm.cap,
      tipo: remoteForm.tipo,
    };
    if (remoteMode.value === 'create') {
      await geographicConfigService.createRemoteArea(payload);
      toast.success(t('geographic_config.remote_created'));
    } else {
      await geographicConfigService.updateRemoteArea(payload);
      toast.success(t('geographic_config.remote_updated'));
    }
    remoteDialog.value = false;
    await loadRemoteAreas(remotePage.value.page);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    savingRemote.value = false;
  }
}

async function confirmDeleteRemote(r: RemoteArea): Promise<void> {
  const ok = await confirm.askDanger(
    t('geographic_config.confirm_delete_remote', { location: r.cap || r.citta || `#${r.id}` }),
    t('geographic_config.confirm_delete_title'),
  );
  if (!ok) return;
  try {
    await geographicConfigService.removeRemoteArea(r.id);
    toast.success(t('geographic_config.remote_deleted'));
    await loadRemoteAreas(remotePage.value.page);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

onMounted(() => {
  void paesiService.list().then((list) => { paesiList.value = list; }).catch(() => { paesiList.value = []; });
  void loadCountries();
  void loadZones();
  void loadSubzones();
  void loadGroups();
  void loadRemoteAreas();
});
</script>
