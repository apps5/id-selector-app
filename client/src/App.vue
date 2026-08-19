<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { api } from './api';
import InfiniteSentinel from './components/InfiniteSentinel.vue';
import SearchInput from './components/SearchInput.vue';
import { usePagedList } from './usePagedList';

const leftSearch = ref('');
const rightSearch = ref('');
const newId = ref('');
const addPending = ref(false);
const addMessage = ref('');
const addError = ref('');
const actionError = ref('');
const pendingIds = ref(new Set());
const state = ref({ totalCount: 1_000_000, selectedCount: 0, availableCount: 1_000_000, extraCount: 0 });
const draggedId = ref(null);
const reorderPending = ref(false);

const available = usePagedList((params) => api.available(params));
const selected = usePagedList((params) => api.selected(params));

const formattedTotal = computed(() => new Intl.NumberFormat('ru-RU').format(state.value.totalCount));
const formattedSelected = computed(() => new Intl.NumberFormat('ru-RU').format(state.value.selectedCount));

function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

async function refreshState() {
  state.value = await api.state();
}

async function reloadLists() {
  await Promise.all([
    available.reset({ search: leftSearch.value }),
    selected.reset({ search: rightSearch.value }),
    refreshState()
  ]);
}

const reloadLeftSearch = debounce(() => available.reset({ search: leftSearch.value }));
const reloadRightSearch = debounce(() => selected.reset({ search: rightSearch.value }));
watch(leftSearch, reloadLeftSearch);
watch(rightSearch, reloadRightSearch);

function markPending(id, value) {
  const next = new Set(pendingIds.value);
  if (value) next.add(id);
  else next.delete(id);
  pendingIds.value = next;
}

async function selectItem(id) {
  actionError.value = '';
  markPending(id, true);
  try {
    await api.select(id);
    await reloadLists();
  } catch (error) {
    actionError.value = error.message;
  } finally {
    markPending(id, false);
  }
}

async function unselectItem(id) {
  actionError.value = '';
  markPending(id, true);
  try {
    await api.unselect(id);
    await reloadLists();
  } catch (error) {
    actionError.value = error.message;
  } finally {
    markPending(id, false);
  }
}

async function addItem() {
  addError.value = '';
  addMessage.value = '';
  if (!/^\d+$/.test(newId.value) || Number(newId.value) <= 0) {
    addError.value = 'Введите положительный целочисленный ID.';
    return;
  }

  addPending.value = true;
  try {
    const created = await api.add(newId.value);
    addMessage.value = `ID ${created.id} добавлен.`;
    newId.value = '';
    await Promise.all([available.reset({ search: leftSearch.value }), refreshState()]);
  } catch (error) {
    addError.value = error.message;
  } finally {
    addPending.value = false;
  }
}

function onDragStart(id, event) {
  draggedId.value = id;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', String(id));
}

async function onDrop(targetId) {
  const sourceId = draggedId.value;
  draggedId.value = null;
  if (!sourceId || sourceId === targetId || reorderPending.value) return;

  const sourceIndex = selected.items.value.findIndex((item) => item.id === sourceId);
  const targetIndex = selected.items.value.findIndex((item) => item.id === targetId);
  if (sourceIndex === -1 || targetIndex === -1) return;

  const snapshot = [...selected.items.value];
  const next = [...selected.items.value];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  selected.items.value = next;

  reorderPending.value = true;
  actionError.value = '';
  try {
    await api.reorder(next.map((item) => item.id));
    await nextTick();
    await selected.reset({ search: rightSearch.value });
  } catch (error) {
    selected.items.value = snapshot;
    actionError.value = error.message;
  } finally {
    reorderPending.value = false;
  }
}

onMounted(reloadLists);
</script>

<template>
  <main class="mx-auto min-h-screen max-w-[1480px] p-4 sm:p-6 lg:p-8">
    <header class="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">In-memory selector</p>
        <h1 class="mt-1 text-2xl font-semibold tracking-tight">Выбор и сортировка ID</h1>
        <p class="mt-1 text-sm text-slate-500">Базовый набор: 1–1 000 000. Страница API — максимум 20 элементов.</p>
      </div>

      <div class="flex gap-2 text-sm">
        <div class="rounded-xl bg-slate-100 px-4 py-3">
          <div class="text-xs text-slate-500">Всего</div>
          <div class="font-semibold tabular-nums">{{ formattedTotal }}</div>
        </div>
        <div class="rounded-xl bg-slate-900 px-4 py-3 text-white">
          <div class="text-xs text-slate-300">Выбрано</div>
          <div class="font-semibold tabular-nums">{{ formattedSelected }}</div>
        </div>
      </div>
    </header>

    <div v-if="actionError" class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ actionError }}
    </div>

    <section class="grid gap-5 lg:grid-cols-2">
      <article class="flex min-h-[680px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div class="border-b border-slate-100 p-5">
          <div class="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 class="font-semibold">Доступные элементы</h2>
              <p class="text-xs text-slate-500">Все элементы, кроме выбранных</p>
            </div>
            <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{{ state.availableCount.toLocaleString('ru-RU') }}</span>
          </div>

          <SearchInput v-model="leftSearch" placeholder="Найти ID в доступных" />

          <form class="mt-3 flex gap-2" @submit.prevent="addItem">
            <input
              v-model.trim="newId"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              placeholder="Новый уникальный ID"
              class="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm shadow-sm focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            />
            <button
              type="submit"
              :disabled="addPending"
              class="h-10 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {{ addPending ? 'В очереди…' : 'Добавить' }}
            </button>
          </form>
          <p v-if="addPending" class="mt-2 text-xs text-amber-600">Добавления сервер обрабатывает пакетами раз в 10 секунд.</p>
          <p v-else-if="addError" class="mt-2 text-xs text-red-600">{{ addError }}</p>
          <p v-else-if="addMessage" class="mt-2 text-xs text-emerald-600">{{ addMessage }}</p>
        </div>

        <div class="flex-1 overflow-y-auto p-3">
          <div v-if="!available.loading.value && !available.items.value.length" class="grid h-full min-h-48 place-items-center text-sm text-slate-400">
            Ничего не найдено
          </div>

          <div class="space-y-1.5">
            <div
              v-for="item in available.items.value"
              :key="item.id"
              class="group flex h-12 items-center justify-between rounded-lg border border-transparent px-3 transition hover:border-slate-200 hover:bg-slate-50"
            >
              <span class="font-mono text-sm tabular-nums text-slate-700">#{{ item.id }}</span>
              <button
                type="button"
                :disabled="pendingIds.has(item.id)"
                class="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 opacity-0 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40 group-hover:opacity-100 focus:opacity-100"
                @click="selectItem(item.id)"
              >
                {{ pendingIds.has(item.id) ? '…' : 'Выбрать →' }}
              </button>
            </div>
          </div>

          <div v-if="available.loading.value" class="py-5 text-center text-xs text-slate-400">Загрузка…</div>
          <InfiniteSentinel v-if="available.hasMore.value" @visible="available.loadMore({ search: leftSearch })" />
        </div>
      </article>

      <article class="flex min-h-[680px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div class="border-b border-slate-100 p-5">
          <div class="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 class="font-semibold">Выбранные элементы</h2>
              <p class="text-xs text-slate-500">Перетаскивайте строки для изменения порядка</p>
            </div>
            <span v-if="reorderPending" class="text-xs font-medium text-amber-600">Сохранение порядка…</span>
            <span v-else class="text-xs text-slate-400">Порядок хранится на сервере</span>
          </div>

          <SearchInput v-model="rightSearch" placeholder="Найти ID среди выбранных" />
          <p class="mt-2 text-xs text-slate-400">Drag&Drop меняет порядок и при активном фильтре: элементы вне текущего списка сохраняют свои позиции.</p>
        </div>

        <div class="flex-1 overflow-y-auto p-3">
          <div v-if="!selected.loading.value && !selected.items.value.length" class="grid h-full min-h-48 place-items-center text-sm text-slate-400">
            Список пуст
          </div>

          <div class="space-y-1.5">
            <div
              v-for="(item, index) in selected.items.value"
              :key="item.id"
              draggable="true"
              class="group flex h-12 cursor-grab items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 shadow-sm transition hover:border-slate-300 active:cursor-grabbing"
              :class="{ 'opacity-50': draggedId === item.id }"
              @dragstart="onDragStart(item.id, $event)"
              @dragend="draggedId = null"
              @dragover.prevent
              @drop.prevent="onDrop(item.id)"
            >
              <span class="select-none text-slate-300" aria-hidden="true">⠿</span>
              <span class="w-8 text-right text-xs tabular-nums text-slate-400">{{ index + 1 }}</span>
              <span class="flex-1 font-mono text-sm tabular-nums text-slate-700">#{{ item.id }}</span>
              <button
                type="button"
                :disabled="pendingIds.has(item.id)"
                class="rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-500 opacity-0 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-40 group-hover:opacity-100 focus:opacity-100"
                @click="unselectItem(item.id)"
              >
                Убрать
              </button>
            </div>
          </div>

          <div v-if="selected.loading.value" class="py-5 text-center text-xs text-slate-400">Загрузка…</div>
          <InfiniteSentinel v-if="selected.hasMore.value" @visible="selected.loadMore({ search: rightSearch })" />
        </div>
      </article>
    </section>

    <footer class="mt-5 flex flex-wrap gap-x-5 gap-y-1 px-1 text-xs text-slate-400">
      <span>Read/change batch: 1 сек</span>
      <span>Add batch: 10 сек</span>
      <span>Dedup: server queue + Set</span>
      <span>Persistence: process memory</span>
    </footer>
  </main>
</template>
