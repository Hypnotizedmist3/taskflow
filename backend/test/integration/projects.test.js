const request = require('supertest');
const { createApp } = require('../../src/app');
const { registerUser } = require('../helpers');

const app = createApp();

async function createProject(token, overrides = {}) {
  const res = await request(app)
    .post('/api/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: overrides.name || 'Website Redesign', description: overrides.description || '' });
  return res;
}

describe('Projects', () => {
  it('lets an authenticated user create a project and become its owner', async () => {
    const { token, user } = await registerUser(app);
    const res = await createProject(token);

    expect(res.status).toBe(201);
    expect(res.body.project.name).toBe('Website Redesign');
    expect(res.body.project.owner).toBe(user.id);
    expect(res.body.project.members).toEqual([user.id]);
  });

  it('rejects project creation without a name', async () => {
    const { token } = await registerUser(app);
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'no name here' });

    expect(res.status).toBe(400);
  });

  it('lists only projects the user owns or is a member of', async () => {
    const { token: ownerToken } = await registerUser(app);
    const { token: strangerToken } = await registerUser(app);

    await createProject(ownerToken, { name: 'Mine' });

    const ownerRes = await request(app).get('/api/projects').set('Authorization', `Bearer ${ownerToken}`);
    const strangerRes = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${strangerToken}`);

    expect(ownerRes.body.projects).toHaveLength(1);
    expect(strangerRes.body.projects).toHaveLength(0);
  });

  it('blocks a non-member from reading a project', async () => {
    const { token: ownerToken } = await registerUser(app);
    const { token: strangerToken } = await registerUser(app);
    const created = await createProject(ownerToken);

    const res = await request(app)
      .get(`/api/projects/${created.body.project.id}`)
      .set('Authorization', `Bearer ${strangerToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for a project that does not exist', async () => {
    const { token } = await registerUser(app);
    const res = await request(app)
      .get('/api/projects/000000000000000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('only lets the owner update the project', async () => {
    const { token: ownerToken } = await registerUser(app);
    const { token: memberToken, user: member } = await registerUser(app);
    const created = await createProject(ownerToken);

    await request(app)
      .post(`/api/projects/${created.body.project.id}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: member.email });

    const forbidden = await request(app)
      .patch(`/api/projects/${created.body.project.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'Hijacked' });
    expect(forbidden.status).toBe(403);

    const allowed = await request(app)
      .patch(`/api/projects/${created.body.project.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Renamed' });
    expect(allowed.status).toBe(200);
    expect(allowed.body.project.name).toBe('Renamed');
  });

  it('adds and removes members, and refuses to remove the owner', async () => {
    const { token: ownerToken } = await registerUser(app);
    const { user: member } = await registerUser(app);
    const created = await createProject(ownerToken);
    const projectId = created.body.project.id;

    const add = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: member.email });
    expect(add.status).toBe(201);
    expect(add.body.project.members).toContain(member.id);

    const removeOwner = await request(app)
      .delete(`/api/projects/${projectId}/members/${add.body.project.owner}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(removeOwner.status).toBe(400);

    const removeMember = await request(app)
      .delete(`/api/projects/${projectId}/members/${member.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(removeMember.status).toBe(200);
    expect(removeMember.body.project.members).not.toContain(member.id);
  });

  it('lets only the owner delete a project, cascading to its tasks', async () => {
    const { token: ownerToken } = await registerUser(app);
    const { token: memberToken, user: member } = await registerUser(app);
    const created = await createProject(ownerToken);
    const projectId = created.body.project.id;

    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: member.email });

    await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Set up hosting' });

    const forbidden = await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${memberToken}`);
    expect(forbidden.status).toBe(403);

    const deleted = await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(deleted.status).toBe(204);

    const afterDelete = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(afterDelete.status).toBe(404);
  });
});
