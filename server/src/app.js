import express from 'express';
import { BatchQueue } from './batchQueue.js';
import { HttpError } from './errors.js';
import { ItemStore } from './store.js';

function readKey(name, params) {
  return `${name}:${JSON.stringify(params)}`;
}

export function createApp({
  store = new ItemStore(),
  addQueue = new BatchQueue(10_000),
  dataQueue = new BatchQueue(1_000)
} = {}) {
  const app = express();
  app.use(express.json({ limit: '100kb' }));

  // Lightweight endpoint for hosting health checks. It intentionally bypasses
  // the batched data queue so infrastructure probes do not delay API work.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/state', async (_req, res, next) => {
    try {
      const result = await dataQueue.enqueue('state', () => store.getState());
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/items/available', async (req, res, next) => {
    const params = {
      search: req.query.search ?? '',
      cursor: req.query.cursor ?? 0,
      limit: req.query.limit ?? 20
    };

    try {
      const result = await dataQueue.enqueue(readKey('available', params), () =>
        store.listAvailable(params)
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/items/selected', async (req, res, next) => {
    const params = {
      search: req.query.search ?? '',
      cursor: req.query.cursor ?? 0,
      limit: req.query.limit ?? 20
    };

    try {
      const result = await dataQueue.enqueue(readKey('selected', params), () =>
        store.listSelected(params)
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/items', async (req, res, next) => {
    let id;
    try {
      id = store.normalizeId(req.body?.id);
      const result = await addQueue.enqueue(`add:${id}`, () => store.addCustom(id));
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/selection/:id', async (req, res, next) => {
    let id;
    try {
      id = store.normalizeId(req.params.id);
      const result = await dataQueue.enqueue(`select:${id}`, () => store.select(id));
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/selection/:id', async (req, res, next) => {
    let id;
    try {
      id = store.normalizeId(req.params.id);
      const result = await dataQueue.enqueue(`unselect:${id}`, () => store.unselect(id));
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/selection/order', async (req, res, next) => {
    try {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const normalized = ids.map((id) => store.normalizeId(id));
      const result = await dataQueue.enqueue(`reorder:${normalized.join(',')}`, () =>
        store.reorderSubset(normalized)
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _req, res, _next) => {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  });

  return { app, store, addQueue, dataQueue };
}
