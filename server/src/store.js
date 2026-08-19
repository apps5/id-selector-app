import { HttpError } from './errors.js';

const BASE_MIN_ID = 1;
const BASE_MAX_ID = 1_000_000;
const PAGE_SIZE = 20;

function matchesSearch(id, search) {
  return !search || String(id).includes(search);
}

export class ItemStore {
  constructor() {
    this.extraIds = new Set();
    this.extraIdsSorted = [];
    this.extraIdsDirty = false;
    this.selectedSet = new Set();
    this.selectedOrder = [];
  }

  normalizeId(value) {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new HttpError(400, 'ID must be a positive safe integer');
    }
    return id;
  }

  normalizeLimit(value) {
    if (value === undefined) return PAGE_SIZE;
    const limit = Number(value);
    if (!Number.isInteger(limit) || limit < 1) return PAGE_SIZE;
    return Math.min(limit, PAGE_SIZE);
  }

  exists(id) {
    return (id >= BASE_MIN_ID && id <= BASE_MAX_ID) || this.extraIds.has(id);
  }

  getSortedExtras() {
    if (this.extraIdsDirty) {
      this.extraIdsSorted = [...this.extraIds].sort((a, b) => a - b);
      this.extraIdsDirty = false;
    }
    return this.extraIdsSorted;
  }

  addCustom(rawId) {
    const id = this.normalizeId(rawId);
    if (this.exists(id)) {
      throw new HttpError(409, `Item ${id} already exists`);
    }

    this.extraIds.add(id);
    this.extraIdsDirty = true;
    return { id };
  }

  select(rawId) {
    const id = this.normalizeId(rawId);
    if (!this.exists(id)) {
      throw new HttpError(404, `Item ${id} does not exist`);
    }
    if (this.selectedSet.has(id)) {
      return { id, changed: false };
    }

    this.selectedSet.add(id);
    this.selectedOrder.push(id);
    return { id, changed: true };
  }

  unselect(rawId) {
    const id = this.normalizeId(rawId);
    if (!this.selectedSet.has(id)) {
      return { id, changed: false };
    }

    this.selectedSet.delete(id);
    const index = this.selectedOrder.indexOf(id);
    if (index !== -1) this.selectedOrder.splice(index, 1);
    return { id, changed: true };
  }

  reorderSubset(rawIds) {
    if (!Array.isArray(rawIds) || rawIds.length < 2) {
      throw new HttpError(400, 'At least two IDs are required for reordering');
    }

    const ids = rawIds.map((id) => this.normalizeId(id));
    const unique = new Set(ids);
    if (unique.size !== ids.length) {
      throw new HttpError(400, 'Reorder list contains duplicate IDs');
    }

    for (const id of ids) {
      if (!this.selectedSet.has(id)) {
        throw new HttpError(409, `Item ${id} is not selected`);
      }
    }

    const subset = new Set(ids);
    const positions = [];
    for (let i = 0; i < this.selectedOrder.length; i += 1) {
      if (subset.has(this.selectedOrder[i])) positions.push(i);
    }

    if (positions.length !== ids.length) {
      throw new HttpError(409, 'Selected state changed while reordering');
    }

    positions.forEach((position, index) => {
      this.selectedOrder[position] = ids[index];
    });

    return { ids };
  }

  listAvailable({ search = '', cursor = 0, limit = PAGE_SIZE } = {}) {
    const normalizedSearch = String(search).trim();
    const normalizedCursor = Math.max(0, Number(cursor) || 0);
    const normalizedLimit = this.normalizeLimit(limit);
    const found = [];
    const targetCount = normalizedLimit + 1;

    let id = Math.max(BASE_MIN_ID, normalizedCursor + 1);
    for (; id <= BASE_MAX_ID && found.length < targetCount; id += 1) {
      if (!this.selectedSet.has(id) && matchesSearch(id, normalizedSearch)) {
        found.push(id);
      }
    }

    if (found.length < targetCount) {
      for (const extraId of this.getSortedExtras()) {
        if (extraId <= normalizedCursor) continue;
        if (!this.selectedSet.has(extraId) && matchesSearch(extraId, normalizedSearch)) {
          found.push(extraId);
          if (found.length >= targetCount) break;
        }
      }
    }

    const hasMore = found.length > normalizedLimit;
    const items = found.slice(0, normalizedLimit).map((itemId) => ({ id: itemId }));

    return {
      items,
      nextCursor: hasMore && items.length ? items.at(-1).id : null,
      hasMore
    };
  }

  listSelected({ search = '', cursor = 0, limit = PAGE_SIZE } = {}) {
    const normalizedSearch = String(search).trim();
    const offset = Math.max(0, Number(cursor) || 0);
    const normalizedLimit = this.normalizeLimit(limit);

    const matching = [];
    let skipped = 0;
    let sourceIndex = 0;

    for (const id of this.selectedOrder) {
      if (!matchesSearch(id, normalizedSearch)) {
        sourceIndex += 1;
        continue;
      }

      if (skipped < offset) {
        skipped += 1;
        sourceIndex += 1;
        continue;
      }

      matching.push({ id, position: sourceIndex });
      sourceIndex += 1;
      if (matching.length > normalizedLimit) break;
    }

    const hasMore = matching.length > normalizedLimit;
    const items = matching.slice(0, normalizedLimit);

    return {
      items,
      nextCursor: hasMore ? offset + normalizedLimit : null,
      hasMore
    };
  }

  getState() {
    const total = BASE_MAX_ID + this.extraIds.size;
    return {
      baseCount: BASE_MAX_ID,
      extraCount: this.extraIds.size,
      totalCount: total,
      selectedCount: this.selectedOrder.length,
      availableCount: total - this.selectedOrder.length
    };
  }
}
