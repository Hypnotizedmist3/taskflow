const request = require('supertest');

let counter = 0;

function uniqueEmail(prefix = 'user') {
  counter += 1;
  return `${prefix}${counter}.${Date.now()}@example.com`;
}

async function registerUser(app, overrides = {}) {
  const payload = {
    name: overrides.name || 'Test User',
    email: overrides.email || uniqueEmail(),
    password: overrides.password || 'password123',
  };
  const res = await request(app).post('/api/auth/register').send(payload);
  if (res.status !== 201) {
    throw new Error(`registerUser failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { token: res.body.token, user: res.body.user, password: payload.password };
}

module.exports = { registerUser, uniqueEmail };
