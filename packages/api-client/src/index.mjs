export class VelvetApiError extends Error {
  constructor(status, payload) {
    super(payload?.message || payload?.error || `Velvet API error ${status}`);
    this.name = 'VelvetApiError';
    this.status = status;
    this.code = payload?.error;
    this.requestId = payload?.requestId;
    this.payload = payload;
  }
}

export class VelvetApiClient {
  #baseUrl;
  #audience;
  #accessToken = null;
  #onToken;
  #refreshPromise = null;

  constructor({ baseUrl, audience, onToken } = {}) {
    if (!baseUrl) throw new Error('baseUrl is required');
    if (!['members', 'pro', 'control'].includes(audience)) throw new Error('Invalid Velvet audience');
    this.#baseUrl = baseUrl.replace(/\/+$/, '');
    this.#audience = audience;
    this.#onToken = onToken || (() => {});
  }

  setAccessToken(token) {
    this.#accessToken = token || null;
    this.#onToken(this.#accessToken);
  }

  async #refresh() {
    if (!this.#refreshPromise) {
      this.#refreshPromise = fetch(`${this.#baseUrl}/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-velvet-app': this.#audience }
      }).then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new VelvetApiError(response.status, payload);
        this.setAccessToken(payload.accessToken);
        return payload.accessToken;
      }).finally(() => {
        this.#refreshPromise = null;
      });
    }
    return this.#refreshPromise;
  }

  async request(path, { method = 'GET', body, retry = true } = {}) {
    const response = await fetch(`${this.#baseUrl}${path}`, {
      method,
      credentials: 'include',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-velvet-app': this.#audience,
        ...(this.#accessToken ? { authorization: `Bearer ${this.#accessToken}` } : {})
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    if (response.status === 204) return null;
    const payload = await response.json();
    if (response.status === 401 && retry && !path.startsWith('/v1/auth/')) {
      await this.#refresh();
      return this.request(path, { method, body, retry: false });
    }
    if (!response.ok) throw new VelvetApiError(response.status, payload);
    return payload;
  }

  async register(input) {
    const result = await this.request('/v1/auth/register', {
      method: 'POST',
      body: { ...input, audience: this.#audience }
    });
    this.setAccessToken(result.accessToken);
    return result;
  }

  async login(email, password) {
    const result = await this.request('/v1/auth/login', {
      method: 'POST',
      body: { email, password, audience: this.#audience }
    });
    this.setAccessToken(result.accessToken);
    return result;
  }

  async logout() {
    await this.request('/v1/auth/logout', { method: 'POST' });
    this.setAccessToken(null);
  }

  me = () => this.request('/v1/me');
  updateMemberProfile = (input) => this.request('/v1/member-profiles/me', { method: 'PATCH', body: input });
  getEstablishment = (id) => this.request(`/v1/establishments/${encodeURIComponent(id)}`);
  updateEstablishment = (id, input) => this.request(`/v1/pro/establishments/${encodeURIComponent(id)}`, { method: 'PATCH', body: input });
  createEvent = (input) => this.request('/v1/events', { method: 'POST', body: input });
  registerForEvent = (id) => this.request(`/v1/events/${encodeURIComponent(id)}/registrations`, { method: 'POST' });
  controlAudit = () => this.request('/v1/control/audit');
}
