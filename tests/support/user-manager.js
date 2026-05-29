const fs = require('fs');
const path = require('path');

class UserManager {
  constructor() {
    this.users = this.loadUsers();
  }

  loadUsers() {
    const filePath = path.resolve(__dirname, 'users.json');
    if (fs.existsSync(filePath)) {
      try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8')) || {};
      } catch (error) {
        return {};
      }
    }
    return {
      admin: { username: 'admin@example.com', password: 'Password123' },
      customer: { username: 'customer@example.com', password: 'Customer123' }
    };
  }

  getUser(roleOrKey) {
    if (!roleOrKey) return this.users.default || null;
    return this.users[roleOrKey] || this.users.default || null;
  }
}

module.exports = UserManager;
