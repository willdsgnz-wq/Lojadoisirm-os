async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const baseHeaders = isFormData ? {} : { "Content-Type": "application/json" };
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...baseHeaders,
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
  get(path) {
    return request(path, {
      method: "GET",
    });
  },

  post(path, payload) {
    return request(path, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  put(path, payload) {
    return request(path, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  upload(path, formData) {
    return request(path, {
      method: "POST",
      body: formData,
    });
  },

  login(payload) {
    return this.post("/api/login", payload);
  },

  logout() {
    return request("/api/logout", {
      method: "POST",
    });
  },

  me() {
    return this.get("/api/auth/me");
  },

  bootstrap() {
    return this.get("/api/bootstrap");
  },

  create(entity, payload) {
    return this.post(`/api/${entity}`, payload);
  },

  update(entity, id, payload) {
    return this.put(`/api/${entity}/${id}`, payload);
  },

  remove(entity, id) {
    return request(`/api/${entity}/${id}`, {
      method: "DELETE",
    });
  },
};
