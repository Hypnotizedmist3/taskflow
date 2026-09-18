const request = require('supertest');
const { createApp } = require('../../src/app');
const { registerUser } = require('../helpers');

const app = createApp();

async function createProjectAndTask(token) {
  const project = await request(app)
    .post('/api/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Q&A' });
  const task = await request(app)
    .post(`/api/projects/${project.body.project.id}/tasks`)
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Investigate flaky test' });
  return { project: project.body.project, task: task.body.task };
}

describe('Comments', () => {
  it('lets a project member add a comment to a task', async () => {
    const { token } = await registerUser(app);
    const { task } = await createProjectAndTask(token);

    const res = await request(app)
      .post(`/api/tasks/${task.id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Reproduced locally, looking into it.' });

    expect(res.status).toBe(201);
    expect(res.body.comment.text).toBe('Reproduced locally, looking into it.');
    expect(res.body.comment.task).toBe(task.id);
  });

  it('rejects an empty comment', async () => {
    const { token } = await registerUser(app);
    const { task } = await createProjectAndTask(token);

    const res = await request(app)
      .post(`/api/tasks/${task.id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: '   ' });

    expect(res.status).toBe(400);
  });

  it('lists comments in chronological order', async () => {
    const { token } = await registerUser(app);
    const { task } = await createProjectAndTask(token);

    await request(app)
      .post(`/api/tasks/${task.id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'First' });
    await request(app)
      .post(`/api/tasks/${task.id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Second' });

    const res = await request(app)
      .get(`/api/tasks/${task.id}/comments`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.comments.map((c) => c.text)).toEqual(['First', 'Second']);
  });

  it('blocks a non-member from commenting', async () => {
    const { token: ownerToken } = await registerUser(app);
    const { token: strangerToken } = await registerUser(app);
    const { task } = await createProjectAndTask(ownerToken);

    const res = await request(app)
      .post(`/api/tasks/${task.id}/comments`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .send({ text: 'I should not be able to do this' });

    expect(res.status).toBe(403);
  });

  it('removes a task’s comments when the task is deleted', async () => {
    const { token } = await registerUser(app);
    const { task } = await createProjectAndTask(token);

    await request(app)
      .post(`/api/tasks/${task.id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'About to vanish' });

    await request(app).delete(`/api/tasks/${task.id}`).set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .get(`/api/tasks/${task.id}/comments`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
