<template>
  <div>
    <!-- ═══ LANDING ═══ -->
    <div v-if="viewState === 'landing'">
      <CmSectionHeader :title="t('sections.price_lists')" :subtitle="t('price_lists.subtitle')">
        <template #actions>
          <v-btn
            v-if="landingTab === 'lists'"
            color="primary"
            size="small"
            :prepend-icon="mdiPlus"
            @click="openCreate"
          >
            {{ t('price_lists.new_list') }}
          </v-btn>
        </template>
      </CmSectionHeader>

      <v-tabs v-model="landingTab" class="mb-4" density="compact">
        <v-tab value="lists">{{ t('price_lists.tab_lists') }}</v-tab>
        <v-tab value="assignments">{{ t('price_lists.assignments_title') }}</v-tab>
      </v-tabs>

      <AssignmentsPanel v-if="landingTab === 'assignments'" />

      <template v-else>
      <v-card class="pa-4 mb-4" variant="outlined">
        <div class="cm-filters">
          <v-text-field
            v-model="search"
            :prepend-inner-icon="mdiMagnify"
            :label="t('common.search')"
            density="compact"
            hide-details
            clearable
            style="max-width: 260px"
            @update:model-value="onSearch"
            @keyup.enter="loadLists(1)"
          />
          <v-select
            v-model="filterTipo"
            :items="tipoFilterItems"
            item-title="title"
            item-value="value"
            :label="t('price_lists.type')"
            density="compact"
            hide-details
            style="max-width: 160px"
            @update:model-value="onFilterChange"
          />
          <v-select
            v-model="filterStatus"
            :items="statusFilterItems"
            item-title="title"
            item-value="value"
            :label="t('common.status')"
            density="compact"
            hide-details
            style="max-width: 150px"
            @update:model-value="onFilterChange"
          />
          <v-select
            v-model="filterBase"
            :items="baseFilterItems"
            item-title="title"
            item-value="value"
            :label="t('price_lists.base')"
            density="compact"
            hide-details
            style="max-width: 150px"
            @update:model-value="onFilterChange"
          />
          <div style="max-width: 240px; flex: 1">
            <CmAnagraficaAutocomplete
              :model-value="filterFornitore"
              :label="t('price_lists.carrier')"
              clearable
              @update:model-value="onFornitoreFilter"
            />
          </div>
          <v-btn size="small" variant="text" @click="showAdvanced = !showAdvanced">
            {{ showAdvanced ? t('price_lists.filters_less') : t('price_lists.filters_more') }}
            <v-badge v-if="advancedCount > 0" :content="advancedCount" color="primary" inline />
          </v-btn>
          <v-spacer />
          <template v-if="isAdmin">
            <v-btn
              size="small"
              variant="outlined"
              color="primary"
              :disabled="bulkSelected.size === 0"
              @click="bulkDialog = true"
            >
              {{ t('price_lists.bulk_btn', { n: bulkSelected.size }) }}
            </v-btn>
            <v-btn size="small" variant="text" @click="bulkHistoryDialog = true">
              {{ t('price_lists.bulk_history') }}
            </v-btn>
            <v-btn size="small" variant="text" :loading="refreshingAlerts" @click="refreshAlerts">
              {{ t('price_lists.alert_refresh') }}
            </v-btn>
          </template>
          <span class="cm-cell-hint">{{ t('price_lists.n_lists', { n: listPage.total }) }}</span>
        </div>
        <div v-if="showAdvanced" class="cm-filters mt-3">
          <v-text-field v-model="adv.list_id" type="number" :label="t('price_lists.f_id')" density="compact" hide-details style="max-width: 110px" @update:model-value="onAdvChange" />
          <v-select v-model="adv.pack" :items="packFilterItems" item-title="title" item-value="value" :label="t('price_lists.pack_type')" density="compact" hide-details clearable style="max-width: 170px" @update:model-value="onAdvChange" />
          <v-text-field v-model="adv.paese_part" maxlength="2" :label="t('price_lists.f_country_from')" density="compact" hide-details style="max-width: 130px" @update:model-value="onAdvChange" />
          <v-text-field v-model="adv.paese_dest" maxlength="2" :label="t('price_lists.f_country_to')" density="compact" hide-details style="max-width: 130px" @update:model-value="onAdvChange" />
          <v-text-field v-model="adv.valuta_sigla" maxlength="3" :label="t('price_lists.currency')" density="compact" hide-details style="max-width: 100px" @update:model-value="onAdvChange" />
          <v-text-field v-model="adv.cod" :label="t('price_lists.f_cod_fornitore')" density="compact" hide-details style="max-width: 170px" @update:model-value="onAdvChange" />
          <v-select v-model="adv.maggiorazione" :items="yesNoItems" item-title="title" item-value="value" :label="t('price_lists.f_markup')" density="compact" hide-details clearable style="max-width: 130px" @update:model-value="onAdvChange" />
          <v-select v-model="adv.base_profile" :items="baseProfileItems" item-title="title" item-value="value" :label="t('price_lists.base_profiles')" density="compact" hide-details clearable style="max-width: 170px" @update:model-value="onAdvChange" />
          <v-switch v-model="adv.problemi" true-value="S" false-value="" :label="t('price_lists.f_problems')" density="compact" hide-details color="primary" @update:model-value="onAdvChange" />
          <v-btn size="small" variant="text" @click="clearAdvanced">{{ t('price_lists.filters_clear') }}</v-btn>
        </div>
      </v-card>

      <CmAsyncSection
        :loading="listsLoading"
        :error="listsError"
        :empty="!listsLoading && !listsError && listPage.items.length === 0"
        :data="listPage.items"
        loading-type="skeleton"
        :skeleton-rows="8"
        :skeleton-cols="6"
        @clear-error="listsError = null"
      >
        <template #empty>
          <CmEmptyState :icon="mdiCurrencyEur" :title="t('price_lists.empty_lists')" />
        </template>

        <template #default>
          <v-card variant="outlined">
            <v-table density="compact">
              <thead>
                <tr>
                  <th v-if="isAdmin" style="width: 40px">
                    <v-checkbox-btn
                      :model-value="allPageSelected"
                      :indeterminate="somePageSelected && !allPageSelected"
                      density="compact"
                      :aria-label="t('price_lists.bulk_select_all')"
                      @update:model-value="togglePage"
                    />
                  </th>
                  <th class="cm-sortable" @click="setSort('nome')">{{ t('price_lists.col_name') }}{{ sortMark('nome') }}</th>
                  <th class="cm-sortable" style="width: 90px" @click="setSort('tipo')">{{ t('price_lists.col_type') }}{{ sortMark('tipo') }}</th>
                  <th class="cm-sortable" style="width: 170px" @click="setSort('servizio_nome')">{{ t('price_lists.col_service') }}{{ sortMark('servizio_nome') }}</th>
                  <th class="cm-sortable" style="width: 110px" @click="setSort('id_fornitore')">{{ t('price_lists.col_carrier') }}{{ sortMark('id_fornitore') }}</th>
                  <th style="width: 90px">{{ t('price_lists.col_partner') }}</th>
                  <th v-if="isAdmin" style="width: 90px" class="text-right">{{ t('price_lists.col_clients') }}</th>
                  <th class="cm-sortable" style="width: 110px" @click="setSort('insert_datetime')">{{ t('price_lists.col_created') }}{{ sortMark('insert_datetime') }}</th>
                  <th style="width: 80px">{{ t('common.status') }}</th>
                  <th style="width: 60px" class="text-center">{{ t('common.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="lst in listPage.items"
                  :key="lst.id"
                  class="cm-clickable"
                  @click="selectList(lst)"
                >
                  <td v-if="isAdmin" @click.stop>
                    <v-checkbox-btn
                      :model-value="bulkSelected.has(lst.id)"
                      density="compact"
                      @update:model-value="toggleBulk(lst.id, Boolean($event))"
                    />
                  </td>
                  <td>
                    <span class="font-weight-medium">{{ lst.nome }}</span>
                    <v-icon v-if="lst.has_problems" :icon="mdiAlert" size="x-small" color="warning" class="ml-1" :title="t('price_lists.alert_title')" />
                    <v-chip
                      v-if="lst.listino_base === 'S'"
                      size="x-small"
                      color="warning"
                      variant="flat"
                      class="ml-2"
                    >
                      {{ t('price_lists.base_badge') }}
                    </v-chip>
                  </td>
                  <td>
                    <v-chip size="x-small" :color="tipoColor(lst.tipo)" variant="tonal">
                      {{ tipoLabel(lst.tipo) }}
                    </v-chip>
                  </td>
                  <td class="cm-cell-hint" :title="'#' + (lst.id_servizi ?? '')">{{ lst.servizio_nome || lst.id_servizi || '—' }}</td>
                  <td class="cm-cell-hint">{{ lst.fornitore_nome || lst.id_fornitore || '—' }}</td>
                  <td class="cm-cell-hint">
                    <span v-if="(lst.id_anagr_titolare ?? 0) > 0">#{{ lst.id_anagr_titolare }}</span>
                    <span v-else>{{ t('price_lists.global') }}</span>
                  </td>
                  <td v-if="isAdmin" class="text-right" @click.stop>
                    <a v-if="(lst.clients_count ?? 0) > 0" class="cm-link" href="#" @click.prevent="openClients(lst)">{{ lst.clients_count }}</a>
                    <span v-else class="cm-cell-hint">0</span>
                  </td>
                  <td class="cm-cell-hint">{{ (lst.insert_datetime || '').slice(0, 10) || '—' }}</td>
                  <td>
                    <v-chip size="x-small" :color="lst.attivo === 'S' ? 'success' : 'error'" variant="tonal">
                      {{ lst.attivo === 'S' ? t('common.active') : t('common.inactive') }}
                    </v-chip>
                  </td>
                  <td class="text-center" @click.stop>
                    <v-tooltip :text="t('price_lists.clone')" location="top">
                      <template #activator="{ props: tp }">
                        <v-btn v-bind="tp" :icon="mdiContentCopy" size="x-small" variant="text" @click="openClone(lst)" />
                      </template>
                    </v-tooltip>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </v-card>

          <div v-if="listPage.pages > 1" class="cm-pagination">
            <v-btn
              :icon="mdiChevronLeft"
              size="small"
              variant="text"
              :disabled="listPage.page <= 1"
              @click="loadLists(listPage.page - 1)"
            />
            <span class="cm-cell-hint">{{ listPage.page }} / {{ listPage.pages }}</span>
            <v-btn
              :icon="mdiChevronRight"
              size="small"
              variant="text"
              :disabled="listPage.page >= listPage.pages"
              @click="loadLists(listPage.page + 1)"
            />
          </div>
        </template>
      </CmAsyncSection>
      </template>
    </div>

    <!-- ═══ DETAIL ═══ -->
    <div v-else-if="selected">
      <div class="d-flex align-center ga-2 mb-4">
        <v-btn :icon="mdiArrowLeft" variant="text" size="small" @click="backToLanding" />
        <div class="text-h6 flex-grow-1">
          {{ selected.nome }}
          <v-chip size="x-small" :color="tipoColor(selected.tipo)" variant="tonal" class="ml-2">
            {{ tipoLabel(selected.tipo) }}
          </v-chip>
        </div>
        <template v-if="!editMode">
          <v-btn variant="text" size="small" :prepend-icon="mdiPencil" @click="toggleEdit">
            {{ t('price_lists.edit_info') }}
          </v-btn>
        </template>
        <template v-else>
          <v-btn variant="text" size="small" :disabled="savingInfo" @click="toggleEdit">
            {{ t('common.cancel') }}
          </v-btn>
          <v-btn color="primary" size="small" :loading="savingInfo" @click="saveListInfo">
            {{ t('common.save') }}
          </v-btn>
        </template>
      </div>

      <v-card v-if="editMode" variant="outlined" class="pa-4 mb-4">
        <div class="cm-grid">
          <v-text-field v-model="editForm.nome" :label="t('price_lists.col_name')" density="compact" hide-details />
          <v-select
            v-model="editForm.attivo"
            :items="statusItems"
            item-title="title"
            item-value="value"
            :label="t('common.status')"
            density="compact"
            hide-details
          />
        </div>
      </v-card>

      <!-- Listino base por perfil (solo TMWE): paridad listy_base_ajax / listy_base_check_ajax -->
      <v-card v-if="isAdmin && selected?.tipo === 'C'" variant="outlined" class="pa-3 mb-4">
        <div class="d-flex align-center flex-wrap ga-2">
          <span class="cm-cell-hint">{{ t('price_lists.base_profiles') }}:</span>
          <v-chip
            v-for="bp in BASE_PROFILES"
            :key="bp.key"
            size="small"
            :color="isBaseFor(bp.col) ? 'warning' : undefined"
            :variant="isBaseFor(bp.col) ? 'flat' : 'outlined'"
            :disabled="baseBusy"
            @click="toggleBase(bp.key, bp.col)"
          >
            {{ t(bp.label) }}
          </v-chip>
        </div>
      </v-card>

      <v-tabs v-model="activeDetailTab" density="compact" class="mb-4">
        <v-tab value="packs">{{ t('price_lists.tab_packs', { n: packs.length }) }}</v-tab>
        <v-tab value="prices">{{ t('price_lists.tab_prices') }}</v-tab>
        <v-tab value="supplements">{{ t('price_lists.tab_supplements') }}</v-tab>
        <v-tab value="history">{{ t('price_lists.tab_history') }}</v-tab>
      </v-tabs>

      <!-- Packs tab -->
      <div v-show="activeDetailTab === 'packs'">
        <div class="cm-actions-right mb-3">
          <v-btn color="primary" size="small" :prepend-icon="mdiPlus" @click="openPackCreate">
            {{ t('price_lists.new_pack') }}
          </v-btn>
        </div>

        <CmAsyncSection
          :loading="packsLoading"
          :empty="!packsLoading && packs.length === 0"
          :data="packs"
        >
          <template #empty>
            <CmEmptyState :icon="mdiPackageVariant" :title="t('price_lists.empty_packs')" />
          </template>
          <template #default>
            <v-card v-for="pk in packs" :key="pk.id" variant="outlined" class="pa-3 mb-2">
              <div class="d-flex align-center ga-3">
                <div class="flex-grow-1">
                  <div>
                    <v-chip size="x-small" color="primary" variant="flat" class="mr-2">
                      {{ packLabel(pk.pack) }}
                    </v-chip>
                    {{ pk.cod_cliente_fornitore || '' }}
                    <span class="cm-cell-hint ml-2">
                      {{ pk.valuta_sigla }} · {{ pk.metric_imperial === 'I' ? t('price_lists.imperial') : t('price_lists.metric') }}
                    </span>
                    <v-chip
                      v-for="a in packAlerts(pk)"
                      :key="a.tp"
                      size="x-small"
                      color="warning"
                      variant="flat"
                      class="ml-2"
                      @click="openAlert(pk, a.tp)"
                    >
                      <v-icon :icon="mdiAlert" size="x-small" class="mr-1" />{{ t(a.label) }}
                    </v-chip>
                  </div>
                  <div v-if="pk.note" class="cm-cell-hint">{{ pk.note }}</div>
                </div>
                <v-btn size="small" variant="text" color="primary" @click="selectPack(pk)">
                  {{ t('price_lists.prices') }}
                </v-btn>
                <v-btn size="small" variant="text" :prepend-icon="mdiPencil" @click="openPackEdit(pk)">
                  {{ t('common.edit') }}
                </v-btn>
                <v-btn size="small" variant="text" color="error" :prepend-icon="mdiDelete" @click="confirmDeletePack(pk)">
                  {{ t('common.delete') }}
                </v-btn>
              </div>
            </v-card>
          </template>
        </CmAsyncSection>
      </div>

      <!-- Price matrix tab -->
      <div v-show="activeDetailTab === 'prices'">
        <div v-if="!selectedPack" class="cm-detail-hint">
          {{ t('price_lists.select_pack_for_prices') }}
        </div>
        <template v-else>
          <div class="d-flex align-center ga-3 mb-3">
            <span class="font-weight-medium">
              {{ packLabel(selectedPack.pack) }} — {{ selectedPack.cod_cliente_fornitore || ('#' + selectedPack.id) }}
            </span>
            <v-spacer />
            <template v-if="!matrixEditMode">
              <v-btn
                v-if="priceMatrix.length > 0 && viewingCurrent && !isBancale"
                size="small"
                variant="outlined"
                color="primary"
                :prepend-icon="mdiPencil"
                @click="startMatrixEdit"
              >
                {{ t('price_lists.matrix_edit') }}
              </v-btn>
              <v-btn
                size="small"
                variant="outlined"
                :prepend-icon="mdiFileUpload"
                @click="openImport"
              >
                {{ t('price_lists.import_btn') }}
              </v-btn>
              <v-btn
                size="small"
                variant="outlined"
                :prepend-icon="mdiTableLarge"
                @click="sheetDialog = true"
              >
                {{ t('price_lists.sheet_btn') }}
              </v-btn>
              <v-menu>
                <template #activator="{ props: mp }">
                  <v-btn
                    v-bind="mp"
                    size="small"
                    variant="outlined"
                    :prepend-icon="mdiDownload"
                    :loading="exporting"
                  >
                    {{ t('price_lists.export_excel') }}
                  </v-btn>
                </template>
                <v-list density="compact">
                  <v-list-item :title="t('price_lists.export_xlsx')" @click="exportExcel('xlsx', 'prices')" />
                  <v-list-item :title="t('price_lists.export_csv_prices')" @click="exportExcel('csv', 'prices')" />
                  <v-list-item :title="t('price_lists.export_csv_suppl')" @click="exportExcel('csv', 'supplements')" />
                  <v-list-item :title="t('price_lists.export_sheet')" @click="exportExcel('sheet')" />
                </v-list>
              </v-menu>
            </template>
            <template v-else>
              <v-btn
                size="small"
                variant="text"
                :disabled="matrixSaving"
                @click="cancelMatrixEdit"
              >
                {{ t('common.cancel') }}
              </v-btn>
              <!-- Fecha de entrada en vigor. Vacía → se sobrescribe la versión
                   vigente (comportamiento histórico). Con fecha → se publica una
                   versión nueva y la anterior queda intacta, recuperable. -->
              <v-text-field
                v-model="effectiveDate"
                type="date"
                :min="minEffectiveDate"
                :label="t('price_lists.effective_from')"
                density="compact"
                variant="outlined"
                hide-details
                clearable
                class="cm-effective-date"
              />
              <v-tooltip
                :text="effectiveDate
                  ? t('price_lists.save_as_version_hint')
                  : t('price_lists.save_overwrite_hint')"
                location="top"
                max-width="320"
              >
                <template #activator="{ props: tp }">
                  <v-btn
                    v-bind="tp"
                    size="small"
                    :color="effectiveDate ? 'success' : 'primary'"
                    :prepend-icon="effectiveDate ? mdiCalendarClock : mdiContentSave"
                    :loading="matrixSaving"
                    :disabled="!(matrixDirty || extDirty)"
                    @click="saveMatrix"
                  >
                    {{ effectiveDate ? t('price_lists.publish_version') : t('common.save') }}
                  </v-btn>
                </template>
              </v-tooltip>
            </template>
          </div>

          <div v-if="visibleVersions.length > 1 || versions.length > 1" class="d-flex align-center flex-wrap ga-2 mb-3">
            <span class="cm-cell-hint">{{ t('price_lists.versions') }}:</span>
            <v-chip
              v-for="v in visibleVersions"
              :key="v.data_start + v.data_stop"
              size="small"
              :color="versionColor(v)"
              :variant="isSelectedVersion(v) ? 'flat' : 'outlined'"
              @click="selectVersion(v)"
            >
              {{ versionLabel(v) }}
            </v-chip>
            <v-btn
              v-if="hasExpiredVersions"
              size="x-small"
              variant="text"
              @click="showExpired = !showExpired"
            >
              {{ showExpired ? t('price_lists.hide_expired') : t('price_lists.show_expired') }}
            </v-btn>
            <v-btn
              v-if="selectedVersionObj && selectedVersionObj.estado === 'futuro' && !matrixEditMode"
              size="x-small"
              variant="outlined"
              color="error"
              :prepend-icon="mdiDelete"
              @click="confirmDeleteFutureVersion"
            >
              {{ t('price_lists.delete_future_version') }}
            </v-btn>
          </div>

          <CmAsyncSection
            :loading="matrixLoading"
            :error="matrixError"
            :empty="!matrixLoading && !matrixError && priceMatrix.length === 0"
            :data="priceMatrix"
            @clear-error="matrixError = null"
          >
            <template #empty>
              <CmEmptyState :icon="mdiTableLarge" :title="t('price_lists.empty_prices')" />
            </template>
            <template #default>
              <v-alert v-if="isBancale" type="info" variant="tonal" density="compact" class="mb-3">
                {{ t('price_lists.bancale_readonly') }}
              </v-alert>
              <v-btn-toggle
                v-if="availableFields.length > 1"
                v-model="matrixField"
                mandatory
                density="compact"
                variant="outlined"
                color="primary"
                class="mb-3"
              >
                <v-btn v-for="f in availableFields" :key="f.value" :value="f.value" size="small">
                  {{ t(f.label) }}
                </v-btn>
              </v-btn-toggle>
              <PriceMatrixTable
                :prices="matrixEditMode ? matrixDraft : priceMatrix"
                :editable="matrixEditMode"
                :field="matrixField"
                :zone-names="zoneNames"
                @update:prices="matrixDraft = $event"
                @dirty-change="matrixDirty = $event"
              />
              <div v-if="extPrices.length > 0 || matrixEditMode" class="mt-4">
                <div class="font-weight-medium mb-2">{{ t('price_lists.ext_title') }}</div>
                <ExtPricesTable
                  :rows="matrixEditMode ? extDraft : extPrices"
                  :editable="matrixEditMode"
                  @dirty="extDirty = true"
                />
              </div>
            </template>
          </CmAsyncSection>

          <!-- KO zones: toggle which zones this list does NOT serve -->
          <div v-if="!matrixEditMode && matrixZones.length > 0" class="cm-zoneko mt-4">
            <div class="d-flex align-center ga-2 mb-2">
              <v-icon :icon="mdiCancel" size="small" color="error" />
              <span class="text-subtitle-2">{{ t('price_lists.zones_ko_title') }}</span>
              <span class="text-caption text-medium-emphasis">{{ t('price_lists.zones_ko_hint') }}</span>
            </div>
            <div class="d-flex ga-2 flex-wrap">
              <v-chip
                v-for="z in matrixZones"
                :key="z"
                size="small"
                :color="isZoneKo(z) ? 'error' : 'default'"
                :variant="isZoneKo(z) ? 'flat' : 'outlined'"
                :disabled="koSaving"
                @click="toggleZoneKo(z)"
              >
                {{ `Z${z}` }}
                <v-icon v-if="isZoneKo(z)" :icon="mdiCancel" size="x-small" class="ml-1" />
              </v-chip>
            </div>
          </div>
        </template>
      </div>

      <!-- Supplements tab -->
      <div v-show="activeDetailTab === 'supplements'">
        <div v-if="!selectedPack" class="cm-detail-hint">
          {{ t('price_lists.select_pack_for_supplements') }}
        </div>
        <template v-else>
          <SupplementsEditor :pack-id="selectedPack.id" @saved="loadMatrix(selectedPack.id)" />
        </template>
      </div>

      <!-- History tab (listini_update) -->
      <div v-show="activeDetailTab === 'history'">
        <CmAsyncSection
          :loading="logLoading"
          :error="logError"
          :empty="!logLoading && !logError && updateLog.length === 0"
          :data="updateLog"
          @clear-error="logError = null"
        >
          <template #empty>
            <div class="cm-cell-hint text-center pa-6">{{ t('price_lists.history_empty') }}</div>
          </template>
          <template #default>
            <v-table density="compact">
              <thead>
                <tr>
                  <th>{{ t('price_lists.history_when') }}</th>
                  <th>{{ t('price_lists.history_operation') }}</th>
                  <th>{{ t('price_lists.history_pack') }}</th>
                  <th>{{ t('price_lists.history_version') }}</th>
                  <th>{{ t('price_lists.history_user') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in updateLog" :key="r.id">
                  <td class="cm-cell-hint">{{ r.insert_datetime }}</td>
                  <td>{{ r.operazione }}</td>
                  <td class="cm-cell-hint">#{{ r.id_listino_pack }}</td>
                  <td class="cm-cell-hint">{{ r.data_start.slice(0, 10) }} → {{ r.data_stop.slice(0, 10) }}</td>
                  <td class="cm-cell-hint">#{{ r.insert_user }}</td>
                </tr>
              </tbody>
            </v-table>
          </template>
        </CmAsyncSection>
      </div>

      <div class="cm-detail-footer">
        <v-btn variant="outlined" size="small" color="error" :prepend-icon="mdiDelete" @click="confirmDeleteList">
          {{ t('price_lists.delete_list') }}
        </v-btn>
      </div>
    </div>

    <!-- ═══ CREATE DIALOG ═══ -->
    <CreateListDialog v-model="createDialog" @created="loadLists(1)" />

    <!-- ═══ CLONE DIALOG ═══ -->
    <CloneListDialog
      v-model="cloneDialog"
      :source="cloneSource"
      @cloned="loadLists(1)"
    />

    <!-- ═══ IMPORT WIZARD ═══ -->
    <ImportWizardDialog
      v-model="importDialog"
      :pack-id="selectedPack?.id ?? null"
      @imported="onImported"
    />

    <ListinoClientsDialog v-model="clientsDialog" :listino="clientsListino" />
    <SheetImportDialog
      v-model="sheetDialog"
      :pack-id="selectedPack?.id ?? null"
      :versions="versions"
      @applied="selectedPack && loadMatrix(selectedPack.id)"
    />
    <PackAlertDialog
      v-model="alertDialog"
      :pack-id="alertPackId"
      :tp="alertTp"
      @changed="selected && loadPacks(selected.id)"
    />

    <!-- ═══ BULK UPDATE ═══ -->
    <BulkUpdateDialog v-model="bulkDialog" :listino-ids="[...bulkSelected]" @done="onBulkDone" />
    <BulkHistoryDialog v-model="bulkHistoryDialog" />

    <!-- ═══ PACK DIALOG ═══ -->
    <PackFormDialog
      v-model="packDialog"
      :mode="packFormMode"
      :pack="packEditTarget"
      :list-id="selected?.id ?? null"
      @saved="selected && loadPacks(selected.id)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  mdiPlus,
  mdiPencil,
  mdiDelete,
  mdiAlert,
  mdiMagnify,
  mdiArrowLeft,
  mdiDownload,
  mdiCurrencyEur,
  mdiPackageVariant,
  mdiTableLarge,
  mdiPlusBox,
  mdiChevronLeft,
  mdiChevronRight,
  mdiContentCopy,
  mdiContentSave,
  mdiCalendarClock,
  mdiFileUpload,
  mdiCancel,
} from '@mdi/js';
import CmSectionHeader from '@shared/anagrafiche/components/CmSectionHeader.vue';
import CmAsyncSection from '@shared/anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '@shared/anagrafiche/components/CmEmptyState.vue';
import CmAnagraficaAutocomplete from '../components/CmAnagraficaAutocomplete.vue';
import PriceMatrixTable, { type PriceField } from './PriceMatrixTable.vue';
import ExtPricesTable from './ExtPricesTable.vue';
import ImportWizardDialog from './ImportWizardDialog.vue';
import AssignmentsPanel from './AssignmentsPanel.vue';
import CloneListDialog from './CloneListDialog.vue';
import CreateListDialog from './CreateListDialog.vue';
import PackFormDialog from './PackFormDialog.vue';
import SupplementsEditor from './SupplementsEditor.vue';
import BulkUpdateDialog from './BulkUpdateDialog.vue';
import BulkHistoryDialog from './BulkHistoryDialog.vue';
import ListinoClientsDialog from './ListinoClientsDialog.vue';
import PackAlertDialog from './PackAlertDialog.vue';
import SheetImportDialog from './SheetImportDialog.vue';
import { useListiniAdmin } from '../composables/useListiniAdmin';
import { useToastStore } from '@shared/anagrafiche/stores/toast.store';
import { useConfirm } from '@shared/anagrafiche/composables/useConfirm';
import type { Paginated } from '@shared/anagrafiche/services/api.types';
import {
  listiniService,
  type ListinoLite,
  type ListinoTipo,
  type ListinoPack,
  type ListinoPrice,
  type ListinoVersion,
  type BasePerfil,
  type AlertType,
  type UpdateLogRow,
  type ImportResult,
} from '../services/listini.service';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();
const { isAdmin } = useListiniAdmin();

// ── Historial de versiones (listini_update) ──
const updateLog = ref<UpdateLogRow[]>([]);
const logLoading = ref(false);
const logError = ref<string | null>(null);

async function loadLog(): Promise<void> {
  if (!selected.value) return;
  logLoading.value = true;
  logError.value = null;
  try {
    updateLog.value = await listiniService.updateLog(selected.value.id);
  } catch (e) {
    updateLog.value = [];
    logError.value = e instanceof Error ? e.message : String(e);
  } finally {
    logLoading.value = false;
  }
}
const sheetDialog = ref(false);

// ── Avisos de problemas de un pack ──
const alertDialog = ref(false);
const alertPackId = ref<number | null>(null);
const alertTp = ref<AlertType>('_zn');
const refreshingAlerts = ref(false);

function packAlerts(pk: ListinoPack): Array<{ tp: AlertType; label: string }> {
  const out: Array<{ tp: AlertType; label: string }> = [];
  if (pk.problemi_zn === 'S') out.push({ tp: '_zn', label: 'price_lists.alert_zones' });
  if (pk.problemi_prz === 'S') out.push({ tp: '_prz', label: 'price_lists.alert_prices' });
  if (pk.problemi === 'S') out.push({ tp: '', label: 'price_lists.alert_api' });
  return out;
}
function openAlert(pk: ListinoPack, tp: AlertType): void {
  alertPackId.value = pk.id;
  alertTp.value = tp;
  alertDialog.value = true;
}
async function refreshAlerts(): Promise<void> {
  const ok = await confirm.askDanger(t('price_lists.alert_refresh_confirm'), t('price_lists.alert_refresh'));
  if (!ok) return;
  refreshingAlerts.value = true;
  try {
    const r = await listiniService.problemsRefresh();
    toast.success(t('price_lists.alert_refreshed', { packs: r.packs, flagged: r.flagged }));
    void loadLists(listPage.value.page);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    refreshingAlerts.value = false;
  }
}

// ── Listino base por perfil (solo TMWE) ──
const BASE_PROFILES: Array<{ key: BasePerfil; col: string; label: string }> = [
  { key: 'C', col: 'listino_base', label: 'price_lists.base_profile_C' },
  { key: 'P', col: 'listino_base_prtn', label: 'price_lists.base_profile_P' },
  { key: 'O', col: 'listino_base_promo', label: 'price_lists.base_profile_O' },
  { key: 'M', col: 'listino_base_market', label: 'price_lists.base_profile_M' },
];
const baseBusy = ref(false);

function isBaseFor(col: string): boolean {
  return selected.value?.[col] === 'S';
}

async function toggleBase(profile: BasePerfil, col: string): Promise<void> {
  if (!selected.value || baseBusy.value) return;
  baseBusy.value = true;
  try {
    const check = await listiniService.baseCheck(selected.value.id, profile);
    if (check.status !== 'OK') {
      // Ya es la base de su servicio: hay que elegir otro listino para cambiarla.
      toast.info(t('price_lists.base_already'));
      return;
    }
    const text = check.previous_name
      ? t('price_lists.base_confirm_replace', { name: check.previous_name, id: check.previous_id ?? '' })
      : t('price_lists.base_confirm');
    const ok = await confirm.askDanger(text, t('price_lists.base_title'));
    if (!ok) return;
    await listiniService.setBase(selected.value.id, profile, check.previous_id);
    const fresh = await listiniService.getById(selected.value.id);
    if (fresh) selected.value = { ...selected.value, ...fresh, [col]: 'S' };
    toast.success(t('price_lists.base_updated'));
    void loadLists(listPage.value.page);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    baseBusy.value = false;
  }
}

// ── Modificación múltiple (solo TMWE) ──
const bulkSelected = ref<Set<number>>(new Set());
const bulkDialog = ref(false);
const bulkHistoryDialog = ref(false);

function toggleBulk(id: number, on: boolean): void {
  const next = new Set(bulkSelected.value);
  if (on) next.add(id);
  else next.delete(id);
  bulkSelected.value = next;
}
const allPageSelected = computed(
  () => listPage.value.items.length > 0 && listPage.value.items.every((l) => bulkSelected.value.has(l.id)),
);
const somePageSelected = computed(() => listPage.value.items.some((l) => bulkSelected.value.has(l.id)));
function togglePage(on: unknown): void {
  const next = new Set(bulkSelected.value);
  for (const l of listPage.value.items) {
    if (on) next.add(l.id);
    else next.delete(l.id);
  }
  bulkSelected.value = next;
}
function onBulkDone(): void {
  bulkSelected.value = new Set();
  void loadLists();
}

type ViewState = 'landing' | 'detail';
const viewState = ref<ViewState>('landing');

// Landing-level tabs: listino list vs client assignments manager.
const landingTab = ref<'lists' | 'assignments'>('lists');

// ── Landing ──
function emptyPage(): Paginated<ListinoLite> {
  return { items: [], total: 0, page: 1, perPage: 30, pages: 0 };
}
const listPage = ref<Paginated<ListinoLite>>(emptyPage());
const listsLoading = ref(false);
const listsError = ref<string | null>(null);
const search = ref('');
const filterTipo = ref<ListinoTipo | ''>('');
const filterStatus = ref<'active' | 'all'>('active');
const filterBase = ref<'S' | 'N' | ''>('');
const filterFornitore = ref<number | null>(null);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

const tipoFilterItems = computed(() => [
  { title: t('common.all'), value: '' },
  { title: t('price_lists.tipo_client'), value: 'C' },
  { title: t('price_lists.tipo_supplier'), value: 'F' },
  { title: t('price_lists.tipo_reference'), value: 'R' },
]);
const statusFilterItems = computed(() => [
  { title: t('price_lists.active_only'), value: 'active' },
  { title: t('common.all'), value: 'all' },
]);
const baseFilterItems = computed(() => [
  { title: t('common.all'), value: '' },
  { title: t('price_lists.base_only'), value: 'S' },
  { title: t('price_lists.non_base'), value: 'N' },
]);
const statusItems = computed(() => [
  { title: t('common.active'), value: 'S' },
  { title: t('common.inactive'), value: 'N' },
]);

function tipoLabel(tipo?: string): string {
  if (tipo === 'C') return t('price_lists.tipo_client');
  if (tipo === 'F') return t('price_lists.tipo_supplier');
  if (tipo === 'R') return t('price_lists.tipo_reference');
  return tipo || '';
}
function tipoColor(tipo?: string): string {
  if (tipo === 'C') return 'success';
  if (tipo === 'F') return 'info';
  return 'default';
}
function packLabel(pack?: string): string {
  switch (pack) {
    case 'D':
      return t('price_lists.pack_document');
    case 'U':
      return t('price_lists.pack_unique');
    case 'P':
      return t('price_lists.pack_parcel');
    case 'Ps':
      return t('price_lists.pack_parcel_s');
    case 'Pm':
      return t('price_lists.pack_parcel_m');
    default:
      return pack || '';
  }
}

// ── Filtros avanzados, orden y vista inversa de clientes ──
const showAdvanced = ref(false);
const adv = reactive({
  list_id: '' as string | number,
  pack: '' as string,
  paese_part: '',
  paese_dest: '',
  valuta_sigla: '',
  cod: '',
  maggiorazione: '' as '' | 'S' | 'N',
  base_profile: '' as '' | BasePerfil,
  problemi: '' as '' | 'S',
});
const advancedCount = computed(() => Object.values(adv).filter((v) => v !== '' && v !== null && v !== undefined).length);
const packFilterItems = computed(() => [
  { title: t('price_lists.pack_document'), value: 'D' },
  { title: t('price_lists.pack_unique'), value: 'U' },
  { title: t('price_lists.pack_parcel'), value: 'P' },
  { title: t('price_lists.pack_parcel_s'), value: 'Ps' },
  { title: t('price_lists.pack_parcel_m'), value: 'Pm' },
]);
const yesNoItems = computed(() => [
  { title: t('common.yes'), value: 'S' },
  { title: t('common.no'), value: 'N' },
]);
const baseProfileItems = computed(() => [
  { title: t('price_lists.base_profile_C'), value: 'C' },
  { title: t('price_lists.base_profile_P'), value: 'P' },
  { title: t('price_lists.base_profile_O'), value: 'O' },
  { title: t('price_lists.base_profile_M'), value: 'M' },
]);
let advTimer: ReturnType<typeof setTimeout> | undefined;
function onAdvChange(): void {
  clearTimeout(advTimer);
  advTimer = setTimeout(() => void loadLists(1), 350);
}
function clearAdvanced(): void {
  Object.assign(adv, { list_id: '', pack: '', paese_part: '', paese_dest: '', valuta_sigla: '', cod: '', maggiorazione: '', base_profile: '', problemi: '' });
  void loadLists(1);
}

const sortKey = ref<string>('nome');
const sortDir = ref<'asc' | 'desc'>('asc');
function setSort(key: string): void {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  else {
    sortKey.value = key;
    sortDir.value = 'asc';
  }
  void loadLists(1);
}
function sortMark(key: string): string {
  return sortKey.value === key ? (sortDir.value === 'asc' ? ' ▲' : ' ▼') : '';
}

const clientsDialog = ref(false);
const clientsListino = ref<ListinoLite | null>(null);
function openClients(lst: ListinoLite): void {
  clientsListino.value = lst;
  clientsDialog.value = true;
}

async function loadLists(page = 1): Promise<void> {
  listsLoading.value = true;
  listsError.value = null;
  try {
    listPage.value = await listiniService.list(page, {
      search: search.value || undefined,
      tipo: filterTipo.value || undefined,
      attivo: filterStatus.value === 'active' ? 'S' : undefined,
      id_fornitore: filterFornitore.value ?? undefined,
      listino_base: filterBase.value || (adv.base_profile ? 'S' : undefined),
      base_profile: adv.base_profile || undefined,
      pack: adv.pack || undefined,
      paese_part: adv.paese_part.trim() || undefined,
      paese_dest: adv.paese_dest.trim() || undefined,
      valuta_sigla: adv.valuta_sigla.trim() || undefined,
      maggiorazione: adv.maggiorazione || undefined,
      cod: adv.cod.trim() || undefined,
      problemi: adv.problemi || undefined,
      sort: sortKey.value,
      dir: sortDir.value,
      ...(adv.list_id !== '' && Number(adv.list_id) > 0 ? { list_id: Number(adv.list_id) } : {}),
    });
  } catch (e) {
    listsError.value = e instanceof Error ? e.message : String(e);
  } finally {
    listsLoading.value = false;
  }
}

function onSearch(): void {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => void loadLists(1), 350);
}
function onFilterChange(): void {
  void loadLists(1);
}
function onFornitoreFilter(v: number | null): void {
  filterFornitore.value = v;
  void loadLists(1);
}

// ── Detail / info edit ──
const selected = ref<ListinoLite | null>(null);
const editMode = ref(false);
const savingInfo = ref(false);
const activeDetailTab = ref<'packs' | 'prices' | 'supplements' | 'history'>('packs');
watch(activeDetailTab, (tab) => {
  if (tab === 'history') void loadLog();
});

interface InfoForm {
  nome: string;
  attivo: 'S' | 'N';
}
const editForm = reactive<InfoForm>({ nome: '', attivo: 'S' });

function selectList(lst: ListinoLite): void {
  selected.value = lst;
  editMode.value = false;
  activeDetailTab.value = 'packs';
  selectedPack.value = null;
  priceMatrix.value = [];
  viewState.value = 'detail';
  void loadPacks(lst.id);
}

function backToLanding(): void {
  viewState.value = 'landing';
  selected.value = null;
  selectedPack.value = null;
  void loadLists(listPage.value.page);
}

function toggleEdit(): void {
  if (!editMode.value && selected.value) {
    editForm.nome = selected.value.nome || '';
    editForm.attivo = (selected.value.attivo as 'S' | 'N') || 'S';
  }
  editMode.value = !editMode.value;
}

async function saveListInfo(): Promise<void> {
  if (!selected.value) return;
  savingInfo.value = true;
  try {
    await listiniService.update(selected.value.id, { nome: editForm.nome, attivo: editForm.attivo });
    selected.value.nome = editForm.nome;
    selected.value.attivo = editForm.attivo;
    toast.success(t('price_lists.list_updated'));
    editMode.value = false;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    savingInfo.value = false;
  }
}

// ── Packs ──
const packs = ref<ListinoPack[]>([]);
const packsLoading = ref(false);
// Pack create/edit dialog: the form + save call live in PackFormDialog; the page
// owns the open state, the mode and the pack being edited, and refreshes packs
// on `saved`.
const packDialog = ref(false);
const packFormMode = ref<'create' | 'edit'>('create');
const packEditTarget = ref<ListinoPack | null>(null);

async function loadPacks(listId: number): Promise<void> {
  packsLoading.value = true;
  try {
    packs.value = await listiniService.listPacks(listId);
  } catch {
    packs.value = [];
  } finally {
    packsLoading.value = false;
  }
}

function openPackCreate(): void {
  packFormMode.value = 'create';
  packEditTarget.value = null;
  packDialog.value = true;
}

function openPackEdit(pk: ListinoPack): void {
  packFormMode.value = 'edit';
  packEditTarget.value = pk;
  packDialog.value = true;
}

async function confirmDeletePack(pk: ListinoPack): Promise<void> {
  const ok = await confirm.askDanger(
    t('price_lists.confirm_delete_pack', { name: pk.cod_cliente_fornitore || packLabel(pk.pack) + ' #' + pk.id }),
    t('price_lists.confirm_delete_title'),
  );
  if (!ok || !selected.value) return;
  try {
    await listiniService.removePack(pk.id);
    toast.success(t('price_lists.pack_deleted'));
    if (selectedPack.value?.id === pk.id) selectedPack.value = null;
    await loadPacks(selected.value.id);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

// ── Price matrix ──
const selectedPack = ref<ListinoPack | null>(null);
const priceMatrix = ref<ListinoPrice[]>([]);
const matrixLoading = ref(false);
const matrixError = ref<string | null>(null);
const exporting = ref(false);

// ── Editable matrix state ──
const matrixEditMode = ref(false);
const matrixDraft = ref<ListinoPrice[]>([]);
const matrixDirty = ref(false);

// Peso extra (listini_zone_ext) y metadatos del pack, que llegan con la matriz.
const extPrices = ref<ListinoPrice[]>([]);
const extDraft = ref<ListinoPrice[]>([]);
const extDirty = ref(false);
const packMeta = ref<Record<string, unknown> | null>(null);
const zoneNames = ref<Record<string, string>>({});
const matrixField = ref<PriceField>('prezzo');

const isBancale = computed<boolean>(() => packMeta.value?.peso_bancale === 'B');
const availableFields = computed<Array<{ value: PriceField; label: string }>>(() => {
  const m = packMeta.value ?? {};
  const out: Array<{ value: PriceField; label: string }> = [{ value: 'prezzo', label: 'price_lists.field_price' }];
  if (m.costo_a_collo2 === 'S') out.push({ value: 'prezzo2', label: 'price_lists.field_price2' });
  if (m.usa_costo_base === 'S') out.push({ value: 'prezzo_base', label: 'price_lists.field_base' });
  if (m.usa_costo_min === 'S') out.push({ value: 'prezzo_min', label: 'price_lists.field_min' });
  return out;
});
const matrixSaving = ref(false);

function startMatrixEdit(): void {
  matrixDraft.value = priceMatrix.value.map((p) => ({ ...p }));
  extDraft.value = extPrices.value.map((p) => ({ ...p }));
  matrixDirty.value = false;
  extDirty.value = false;
  matrixEditMode.value = true;
}

function cancelMatrixEdit(): void {
  matrixEditMode.value = false;
  matrixDraft.value = [];
  extDraft.value = [];
  matrixDirty.value = false;
  extDirty.value = false;
}

/**
 * Fecha de entrada en vigor. Vacío = sobrescribir la versión VIGENTE (el
 * comportamiento histórico). Con fecha = publicar una versión nueva, dejando
 * intacta la anterior y pudiendo volver a ella.
 */
const effectiveDate = ref<string>('');

/** Fecha mínima seleccionable: mañana (una versión "futura" no puede ser hoy). */
const minEffectiveDate = computed(() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
});

/** Filas de la rejilla listas para enviar: las celdas vaciadas se descartan. */
function priceRowsToSend(): ListinoPrice[] {
  return matrixDraft.value
    .filter((p) => p.prezzo !== '' && p.prezzo !== null && p.prezzo !== undefined)
    .map((p) => {
      const row: ListinoPrice = { ...p };
      for (const f of ['prezzo2', 'prezzo_base', 'prezzo_min'] as const) {
        if (row[f] === '' || row[f] === null) delete row[f];
      }
      return row;
    });
}

async function saveMatrix(): Promise<void> {
  if (!selectedPack.value || !(matrixDirty.value || extDirty.value)) {
    matrixEditMode.value = false;
    return;
  }
  const packId = selectedPack.value.id;
  const prices = priceRowsToSend();
  if (prices.length === 0) {
    toast.error(t('price_lists.matrix_empty_error'));
    return;
  }
  matrixSaving.value = true;
  try {
    // Siempre por op=new_version (paridad con el legacy, que versiona): el
    // backend cierra la versión anterior e inserta la nueva en una transacción,
    // arrastrando suplementos y peso extra.
    //  - Con fecha: versión que entra en vigor ese día.
    //  - Sin fecha: actualiza la vigente (caso 1/2 del legacy: se cierra ahora
    //    y la nueva arranca ahora); sin versión previa, la primera (caso 4).
    const cur = versions.value.find((v) => v.estado === 'in_corso');
    let start: string;
    let stop: string | undefined;
    if (effectiveDate.value) {
      start = effectiveDate.value;
    } else if (cur) {
      start = cur.data_start.slice(0, 10);
      stop = cur.data_stop.slice(0, 10);
    } else {
      start = new Date().toISOString().slice(0, 10);
    }
    const ext = extDirty.value
      ? extDraft.value.filter((r) => r.zona !== '' && r.peso_max !== '' && r.prezzo !== '')
      : undefined;
    const res = await listiniService.saveMatrixAsNewVersion(packId, prices, start, stop, ext);
    toast.success(`${res.operazione} · ${res.rows_inserted} ${t('price_lists.rows')}`);
    effectiveDate.value = '';
    matrixEditMode.value = false;
    matrixDirty.value = false;
    extDirty.value = false;
    await loadMatrix(packId);
  } catch (e) {
    toast.error(t('price_lists.matrix_save_failed') + ': ' + (e instanceof Error ? e.message : String(e)));
  } finally {
    matrixSaving.value = false;
  }
}

async function selectPack(pk: ListinoPack): Promise<void> {
  selectedPack.value = pk;
  activeDetailTab.value = 'prices';
  await loadMatrix(pk.id);
}

// ── Versions ──
const versions = ref<ListinoVersion[]>([]);
const selectedVersionKey = ref<string | null>(null);
const showExpired = ref(false);

const ZERO_DATE = '0000-00-00 00:00:00';

function versionKey(v: ListinoVersion): string {
  return `${v.data_start}|${v.data_stop}`;
}
const selectedVersionObj = computed<ListinoVersion | null>(
  () => versions.value.find((v) => versionKey(v) === selectedVersionKey.value) ?? null,
);
const viewingCurrent = computed<boolean>(
  () => selectedVersionObj.value === null || selectedVersionObj.value.estado === 'in_corso',
);
const hasExpiredVersions = computed<boolean>(() => versions.value.some((v) => v.estado === 'scaduto'));
const visibleVersions = computed<ListinoVersion[]>(() =>
  versions.value.filter((v) => showExpired.value || v.estado !== 'scaduto'),
);

function isSelectedVersion(v: ListinoVersion): boolean {
  return selectedVersionObj.value
    ? versionKey(v) === selectedVersionKey.value
    : v.estado === 'in_corso';
}
function versionColor(v: ListinoVersion): string {
  return v.estado === 'in_corso' ? 'success' : v.estado === 'futuro' ? 'info' : 'grey';
}
function versionLabel(v: ListinoVersion): string {
  const day = (d: string): string => (d && d !== ZERO_DATE ? d.slice(0, 10) : '…');
  const state = t(`price_lists.version_${v.estado}`);
  return `${state} · ${day(v.data_start)} → ${day(v.data_stop)}`;
}

async function selectVersion(v: ListinoVersion): Promise<void> {
  if (!selectedPack.value) return;
  selectedVersionKey.value = v.estado === 'in_corso' ? null : versionKey(v);
  const date = v.estado === 'in_corso' || v.data_start === ZERO_DATE ? undefined : v.data_start;
  await loadMatrix(selectedPack.value.id, date, false);
}

async function confirmDeleteFutureVersion(): Promise<void> {
  const v = selectedVersionObj.value;
  if (!selectedPack.value || !v) return;
  const ok = await confirm.askDanger(
    t('price_lists.confirm_delete_future_version', { start: v.data_start.slice(0, 10) }),
    t('price_lists.confirm_delete_title'),
  );
  if (!ok) return;
  try {
    await listiniService.deleteFutureVersion(selectedPack.value.id, v.data_start, v.data_stop);
    toast.success(t('price_lists.future_version_deleted'));
    selectedVersionKey.value = null;
    await loadMatrix(selectedPack.value.id);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

async function loadMatrix(packId: number, date?: string, refreshVersions = true): Promise<void> {
  matrixLoading.value = true;
  matrixError.value = null;
  if (refreshVersions) selectedVersionKey.value = null;
  try {
    const full = await listiniService.getMatrixFull(packId, date);
    priceMatrix.value = full.prices;
    extPrices.value = full.ext_prices;
    packMeta.value = full.metadata;
    zoneNames.value = full.zone_names;
    zonesKo.value = full.zones_ko;
    if (refreshVersions) versions.value = full.versions;
    if (!availableFields.value.some((f) => f.value === matrixField.value)) matrixField.value = 'prezzo';
  } catch (e) {
    priceMatrix.value = [];
    extPrices.value = [];
    matrixError.value = e instanceof Error ? e.message : String(e);
  } finally {
    matrixLoading.value = false;
  }
}

// ── KO zones ──
const zonesKo = ref<Array<number | string>>([]);
const koSaving = ref(false);

const matrixZones = computed<Array<number | string>>(() => {
  const set = new Set<number | string>();
  for (const p of priceMatrix.value) set.add(p.zona);
  return [...set].sort((a, b) => Number(a) - Number(b));
});

function isZoneKo(z: number | string): boolean {
  return zonesKo.value.some((k) => String(k) === String(z));
}

async function toggleZoneKo(z: number | string): Promise<void> {
  if (!selectedPack.value || koSaving.value) return;
  const action = isZoneKo(z) ? 'remove' : 'add';
  koSaving.value = true;
  try {
    await listiniService.setZoneKo(selectedPack.value.id, z, action);
    zonesKo.value = await listiniService.getZonesKo(selectedPack.value.id);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    koSaving.value = false;
  }
}

// ── Import wizard ──
const importDialog = ref(false);

function openImport(): void {
  if (!selectedPack.value) return;
  importDialog.value = true;
}

async function onImported(result: ImportResult): Promise<void> {
  toast.success(
    t('price_lists.import_result', {
      ins: result.inserted,
      upd: result.updated,
      del: result.deleted,
    }),
  );
  if (selectedPack.value) await loadMatrix(selectedPack.value.id);
}

async function exportExcel(format: 'xlsx' | 'csv' | 'sheet' = 'xlsx', section: 'prices' | 'supplements' = 'prices'): Promise<void> {
  if (!selectedPack.value) return;
  exporting.value = true;
  try {
    // La versión que se está viendo (no solo la vigente).
    const v = selectedVersionObj.value;
    const date = v && v.estado !== 'in_corso' && v.data_start !== ZERO_DATE ? v.data_start.slice(0, 10) : undefined;
    const f = await listiniService.exportExcel(selectedPack.value.id, format, { section, date });
    const bytes = atob(f.file);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob = new Blob([arr], { type: f.mime_type || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (f.filename || 'price_list') + '.' + (f.format || format);
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('price_lists.export_done'));
  } catch (e) {
    toast.error(t('price_lists.export_failed') + ': ' + (e instanceof Error ? e.message : String(e)));
  } finally {
    exporting.value = false;
  }
}

// ── Supplements ──
// ── Create ──
// Create dialog: the whole form + supplier-service autocomplete live in
// CreateListDialog; the page owns the open state and refreshes on `created`.
const createDialog = ref(false);

function openCreate(): void {
  createDialog.value = true;
}

// ── Clone ──
// Clone dialog: the form + clone call live in CloneListDialog; the page owns the
// open state and the source list, and refreshes the landing list on `cloned`.
const cloneDialog = ref(false);
const cloneSource = ref<ListinoLite | null>(null);

function openClone(lst: ListinoLite): void {
  cloneSource.value = lst;
  cloneDialog.value = true;
}

async function confirmDeleteList(): Promise<void> {
  if (!selected.value) return;
  const ok = await confirm.askDanger(
    t('price_lists.confirm_delete_list', { name: selected.value.nome }),
    t('price_lists.confirm_delete_title'),
  );
  if (!ok) return;
  try {
    await listiniService.remove(selected.value.id);
    toast.success(t('price_lists.list_deleted'));
    backToLanding();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

onMounted(() => {
  void loadLists();
});
</script>

<style scoped>
.cm-clickable {
  cursor: pointer;
}
.cm-sortable {
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
.cm-link {
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
}
.cm-detail-hint {
  text-align: center;
  padding: 40px;
  color: var(--cm-text-muted);
  font-size: 13px;
}
.cm-detail-footer {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--cm-border-light, #eee);
}

/* Campo de fecha de vigencia: compacto, para que quepa junto a los botones de
   la barra de edición sin desplazarlos. */
.cm-effective-date {
  max-width: 170px;
  flex: 0 0 170px;
}
</style>