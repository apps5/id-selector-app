async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  return body;
}

function queryString(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  });
  return search.toString();
}

export const api = {
  state: () => request('/api/state'),
  available: (params) => request(`/api/items/available?${queryString(params)}`),
  selected: (params) => request(`/api/items/selected?${queryString(params)}`),
  add: (id) => request('/api/items', { method: 'POST', body: JSON.stringify({ id }) }),
  select: (id) => request(`/api/selection/${id}`, { method: 'POST' }),
  unselect: (id) => request(`/api/selection/${id}`, { method: 'DELETE' }),
  reorder: (ids) => request('/api/selection/order', { method: 'PUT', body: JSON.stringify({ ids }) })
};
