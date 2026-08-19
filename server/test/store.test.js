import test from 'node:test';
import assert from 'node:assert/strict';
import { BatchQueue } from '../src/batchQueue.js';
import { ItemStore } from '../src/store.js';

function assertThrowsStatus(fn, status) {
  assert.throws(fn, (error) => error?.status === status);
}

test('selection is idempotent and excludes selected items from available list', () => {
  const store = new ItemStore();
  assert.equal(store.select(1).changed, true);
  assert.equal(store.select(1).changed, false);
  assert.deepEqual(store.listAvailable({ limit: 3 }).items.map((item) => item.id), [2, 3, 4]);
  assert.equal(store.getState().selectedCount, 1);
});

test('custom IDs cannot duplicate the initial million items or another custom item', () => {
  const store = new ItemStore();
  assertThrowsStatus(() => store.addCustom(42), 409);
  assert.deepEqual(store.addCustom(1_500_000), { id: 1_500_000 });
  assertThrowsStatus(() => store.addCustom(1_500_000), 409);
});

test('reordering a subset preserves all non-subset positions', () => {
  const store = new ItemStore();
  [10, 20, 30, 40, 50].forEach((id) => store.select(id));

  store.reorderSubset([40, 20]);

  assert.deepEqual(store.selectedOrder, [10, 40, 30, 20, 50]);
});

test('filtered selected list keeps global order and paginates by 20 maximum', () => {
  const store = new ItemStore();
  for (let id = 1; id <= 100; id += 1) store.select(id);

  const page = store.listSelected({ search: '1', limit: 50 });
  assert.equal(page.items.length, 20);
  assert.deepEqual(page.items.slice(0, 4).map((item) => item.id), [1, 10, 11, 12]);
});

test('queue deduplicates equal pending operations', async () => {
  const queue = new BatchQueue(60_000);
  let executions = 0;

  const first = queue.enqueue('same', () => ++executions);
  const second = queue.enqueue('same', () => ++executions);

  await queue.flush();

  assert.equal(await first, 1);
  assert.equal(await second, 1);
  assert.equal(executions, 1);
  queue.close();
});
