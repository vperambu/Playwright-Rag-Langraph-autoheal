class PostsClient {
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

  async getPosts() {
    return this.request('GET', '/posts');
  }

  async getPost(id) {
    return this.request('GET', `/posts/${id}`);
  }

  async createPost(data) {
    return this.request('POST', '/posts', data);
  }

  async updatePost(id, data) {
    return this.request('PUT', `/posts/${id}`, data);
  }

  async deletePost(id) {
    return this.request('DELETE', `/posts/${id}`);
  }
}

module.exports = PostsClient;
