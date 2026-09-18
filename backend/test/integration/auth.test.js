const request = require('supertest');
const { createApp } = require('../../src/app');
const { registerUser, uniqueEmail } = require('../helpers');

const app = createApp();

describe('Auth', () => {
  describe('POST /api/auth/register', () => {
    it('creates a new user and returns a token', async () => {
      const email = uniqueEmail();
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Ada Lovelace', email, password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({ name: 'Ada Lovelace', email });
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('rejects a duplicate email', async () => {
      const email = uniqueEmail();
      await request(app).post('/api/auth/register').send({ name: 'A', email, password: 'password123' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'B', email, password: 'password123' });

      expect(res.status).toBe(409);
    });

    it('rejects a weak password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'A', email: uniqueEmail(), password: 'short' });

      expect(res.status).toBe(400);
    });

    it('rejects an invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'A', email: 'not-an-email', password: 'password123' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in with correct credentials', async () => {
      const { user, password } = await registerUser(app);
      const res = await request(app).post('/api/auth/login').send({ email: user.email, password });

      expect(res.status).toBe(200);
      expect(res.body.token).toEqual(expect.any(String));
    });

    it('rejects an incorrect password', async () => {
      const { user } = await registerUser(app);
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'wrong-password' });

      expect(res.status).toBe(401);
    });

    it('rejects an unknown email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: uniqueEmail(), password: 'password123' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns the current user when authenticated', async () => {
      const { token, user } = await registerUser(app);
      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(user.email);
    });

    it('rejects a missing token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('rejects a malformed token', async () => {
      const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token');
      expect(res.status).toBe(401);
    });
  });
});
