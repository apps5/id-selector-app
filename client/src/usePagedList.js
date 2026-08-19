import { ref } from 'vue';

export function usePagedList(loader) {
  const items = ref([]);
  const cursor = ref(null);
  const hasMore = ref(true);
  const loading = ref(false);
  let generation = 0;

  async function reset(params) {
    generation += 1;
    const current = generation;
    items.value = [];
    cursor.value = null;
    hasMore.value = true;
    loading.value = false;
    await loadMore(params, current);
  }

  async function loadMore(params, expectedGeneration = generation) {
    if (loading.value || !hasMore.value) return;
    loading.value = true;
    try {
      const data = await loader({
        ...params,
        cursor: cursor.value ?? 0,
        limit: 20
      });
      if (expectedGeneration !== generation) return;
      items.value.push(...data.items);
      cursor.value = data.nextCursor;
      hasMore.value = data.hasMore;
    } finally {
      if (expectedGeneration === generation) loading.value = false;
    }
  }

  return { items, hasMore, loading, reset, loadMore };
}
