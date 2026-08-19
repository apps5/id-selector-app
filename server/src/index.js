import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT || 3001);
const { app } = createApp();

if (process.env.NODE_ENV === 'production') {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(here, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
