# TaskFlow

A small project/task management web app — built specifically as the subject
of a Jenkins DevOps pipeline assignment, not as a production product. It's
intentionally simple, but has real backend depth: authentication, role-based
authorization (project owner vs member), relational data (projects → tasks →
comments), and a real integration test suite that runs against an actual
database rather than mocks.

## Stack

- **Backend**: Node.js, Express, MongoDB (via Mongoose), JWT auth, bcrypt
- **Frontend**: React (Vite), React Router
- **Tests**: Jest + Supertest, run against a real MongoDB container in CI
- **Everything else**: see `Jenkinsfile` and `SETUP.md` for the pipeline

## What it does

- Register / log in
- Create projects, invite members by email
- Create tasks within a project, assign them, move them between
  to-do / in-progress / done
- Comment on tasks
- Authorization is real: only a project's owner or members can see or touch
  it; only the owner can manage membership or delete the project; only a
  task's creator or the project owner can delete that task

## Local development (without Docker)

```bash
cd backend && npm install && cp .env.example .env
# start a local MongoDB, then:
npm run dev

cd ../frontend && npm install
npm run dev
```

## Local development (with Docker)

```bash
docker compose up
```

Backend: http://localhost:3000 · Frontend: http://localhost:5173

## Running the test suite

```bash
cd backend
npm test
```

This spins up an in-memory MongoDB automatically if `MONGO_URI` isn't set.
In CI (`scripts/test.sh`), `MONGO_URI` points at a real, disposable MongoDB
container instead — that's what actually exercises the app.

See `SETUP.md` for the full Jenkins pipeline setup.
