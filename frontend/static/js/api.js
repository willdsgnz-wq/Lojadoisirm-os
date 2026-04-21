const headers = {
  "Content-Type": "application/json",
};

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Ocorreu um erro ao processar a requisição.");
  }
  return data;
}

export const api = {
  login(payload) {
    return request("/api/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  logout() {
    return request("/api/logout", {
      method: "POST",
    });
  },

  me() {
    return request("/api/auth/me", {
      method: "GET",
    });
  },

  bootstrap() {
    return request("/api/bootstrap", {
      method: "GET",
    });
  },

  create(entity, payload) {
    return request(`/api/${entity}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  update(entity, id, payload) {
    return request(`/api/${entity}/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  remove(entity, id) {
    return request(`/api/${entity}/${id}`, {
      method: "DELETE",
    });
  },
};
