class UsersClient {
  constructor(apiContext, token = '') {
    this.apiContext = apiContext;
    this.token = token;
  }

  async request(method, path, body = null) {
    const options = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {})
      }
    };
    if (body) options.data = body;
    const action = method.toLowerCase();
    const response = await this.apiContext[action](path, options);
    return response;
  }

  async getUsers() {
    return this.request('GET', '/users');
  }

  async getUser(id) {
    return this.request('GET', `/users/${id}`);
  }

  async createUser(data) {
    return this.request('POST', '/users', data);
  }

  async updateUser(id, data) {
    return this.request('PUT', `/users/${id}`, data);
  }

  async deleteUser(id) {
    return this.request('DELETE', `/users/${id}`);
  }
}

module.exports = UsersClient;
