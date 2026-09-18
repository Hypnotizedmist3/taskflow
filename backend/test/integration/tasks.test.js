const request = require('supertest');
const { createApp } = require('../../src/app');
const { registerUser } = require('../helpers');

const app = createApp();

async function createProject(token) {
  const res = await request(app)
    .post('/api/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Launch Plan' });
  return res.body.project;
}

describe('Tasks', () => {
  it('lets a project member create a task, defaulting status and priority', async () => {
    const { token } = await registerUser(app);
    const project = await createProject(token);

    const res = await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Write launch announcement' });

    expect(res.status).toBe(201);
    expect(res.body.task).toMatchObject({
      title: 'Write launch announcement',
      status: 'todo',
      priority: 'medium',
      project: project.id,
    });
  });

  it('rejects a non-member creating a task', async () => {
    const { token: ownerToken } = await registerUser(app);
    const { token: strangerToken } = await registerUser(app);
    const project = await createProject(ownerToken);

    const res = await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .send({ title: 'Sneaky task' });

    expect(res.status).toBe(403);
  });

  it('rejects an invalid status value', async () => {
    const { token } = await registerUser(app);
    const project = await createProject(token);

    const res = await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Bad status', status: 'not-a-real-status' });

    expect(res.status).toBe(400);
  });

  it('rejects assigning a task to someone outside the project', async () => {
    const { token } = await registerUser(app);
    const { user: outsider } = await registerUser(app);
    const project = await createProject(token);

    const res = await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Assign to outsider', assignee: outsider.id });

    expect(res.status).toBe(400);
  });

  it('filters tasks by status', async () => {
    const { token } = await registerUser(app);
    const project = await createProject(token);

    await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Todo task' });
    const done = await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Done task', status: 'done' });

    const res = await request(app)
      .get(`/api/projects/${project.id}/tasks?status=done`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0].id).toBe(done.body.task.id);
  });

  it('updates a task status via PATCH', async () => {
    const { token } = await registerUser(app);
    const project = await createProject(token);
    const created = await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Move me' });

    const res = await request(app)
      .patch(`/api/tasks/${created.body.task.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('in_progress');
  });

  it('blocks a non-member from reading or updating a task', async () => {
    const { token: ownerToken } = await registerUser(app);
    const { token: strangerToken } = await registerUser(app);
    const project = await createProject(ownerToken);
    const created = await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Private task' });

    const read = await request(app)
      .get(`/api/tasks/${created.body.task.id}`)
      .set('Authorization', `Bearer ${strangerToken}`);
    expect(read.status).toBe(403);

    const update = await request(app)
      .patch(`/api/tasks/${created.body.task.id}`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .send({ status: 'done' });
    expect(update.status).toBe(403);
  });

  it('lets the task creator delete it, but not an unrelated member', async () => {
    const { token: ownerToken } = await registerUser(app);
    const { token: memberToken, user: member } = await registerUser(app);
    const project = await createProject(ownerToken);

    await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: member.email });

    const created = await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Owner-created task' });

    const forbidden = await request(app)
      .delete(`/api/tasks/${created.body.task.id}`)
      .set('Authorization', `Bearer ${memberToken}`);
    expect(forbidden.status).toBe(403);

    const allowed = await request(app)
      .delete(`/api/tasks/${created.body.task.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(allowed.status).toBe(204);
  });
});
