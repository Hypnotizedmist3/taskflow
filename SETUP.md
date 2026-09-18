# Jenkins DevOps Pipeline — Setup Guide (TaskFlow)

**Project:** TaskFlow — your own project/task management web app, built for
this assignment (not a fork of someone else's repo)
**Stack:** Node.js/Express + MongoDB backend, React (Vite) frontend, Docker,
Jenkins (already installed on your Mac at `http://localhost:8080`)

This kit gives you all 7 pipeline stages — **Build, Test, Code Quality,
Security, Deploy, Release, Monitoring** — fully automated. Everything runs
inside Docker containers; you don't need Node, MongoDB, or anything else
installed natively on your Mac beyond Docker itself.

---

## 0. Prerequisites check

```bash
docker --version
docker compose version
git --version
node --version   # optional, only needed if you want to run things outside Docker too
```

Docker Desktop must be **running** before any of the steps below.

---

## 1. Create the GitHub repo and push this code

This is your own project, not a fork, so:

1. Go to https://github.com/new and create an **empty** repository (no
   README, no `.gitignore` — you already have both here).
2. In this project folder:

```bash
cd taskflow
git init
git add -A
git commit -m "Initial commit: TaskFlow app + Jenkins pipeline"
git branch -M main
git remote add origin https://github.com/<your-github-username>/taskflow.git
git push -u origin main
```

Everything (backend, frontend, Jenkinsfile, scripts, monitoring config) is
already in the right place in this folder — there's no separate "kit" to
copy in this time, since it's your own repo from the start.

---

## 2. Start the local Docker registry (Build stage artifact storage)

```bash
docker compose -f docker-compose.registry.yml up -d
```

Verify: `curl http://localhost:5061/v2/_catalog` → `{"repositories":[]}`

(Host port 5061 — not 5000, which macOS's AirPlay Receiver usually claims,
and not 5050, in case you still have another project's registry running
from before. If you don't, you can ignore that parenthetical.)

---

## 3. SonarQube

If you already have the SonarQube container running from a previous
project, it's fine — we're reusing it with a new project key (`taskflow`).
If not:

```bash
docker compose -f docker-compose.sonarqube.yml up -d   # from a previous kit, if you still have that file
```

Wait ~1-2 minutes, then open http://localhost:9000. Make sure a webhook
back to Jenkins is configured (Administration → Configuration → Webhooks →
`http://localhost:8080/sonarqube-webhook/`) — this is what lets the
**Quality Gate** stage actually work instead of timing out.

---

## 4. Create the Jenkins job

Jenkins → **New Item** → name it `TaskFlow-DevOps-Pipeline` → **Pipeline** → OK.

- **Build Triggers**: check "Poll SCM", schedule `H/5 * * * *`.
- **Pipeline** section:
  - Definition: `Pipeline script from SCM`
  - SCM: `Git`
  - Repository URL: `https://github.com/<your-github-username>/taskflow.git`
  - Branch: `*/main`
  - Script Path: `Jenkinsfile`

Save.

---

## 5. Run it

Click **Build Now**. Open **Console Output** and watch it move through:

`Checkout → Build → Test → Code Quality → Quality Gate → Security → Deploy → Release → Monitoring`

This should be **fast** compared to a project you didn't write yourself —
no exotic toolchains, no multi-gigabyte dependency installs. Expect the
first Build to take a few minutes (pulling base images, `npm install`
inside the Docker layers) and later builds to be much faster thanks to
Docker's layer cache.

Once it's green, check the deployed staging site:
- Frontend: http://localhost:4011
- Backend health: http://localhost:4001/health

Register an account and create a project to confirm it's actually working
end to end, not just "deployed."

---

## 6. Deploy production once, manually (for the monitoring/rollback demo)

The pipeline's Deploy stage only deploys **staging** automatically — that's
deliberate, mirroring a real pipeline where production goes out behind a
deliberate promotion step, not on every single commit. To have something
for the monitoring dashboard and rollback demo to show, deploy production
once yourself, using whatever version Release last tagged `stable`:

```bash
BACKEND_IMAGE_NAME=taskflow-backend FRONTEND_IMAGE_NAME=taskflow-frontend \
  ./scripts/deploy.sh production stable
```

- Frontend: http://localhost:4012
- Backend health: http://localhost:4002/health

---

## 7. Start the monitoring stack

```bash
docker compose -f docker-compose.monitoring.yml up -d
```

- Prometheus targets: http://localhost:4090/targets — staging and
  production (if deployed) should show `UP`
- Grafana: http://localhost:4080 (login `admin` / `admin`, it'll ask you to
  change the password)
- Alertmanager: http://localhost:4093

To demo an alert firing: `docker stop taskflow-backend-staging`, watch the
`SiteDown` alert go active within ~30s in Prometheus/Alertmanager, then
`docker start taskflow-backend-staging` to clear it.

---

## 8. Rollback demo (great for Top HD)

```bash
BACKEND_IMAGE_NAME=taskflow-backend FRONTEND_IMAGE_NAME=taskflow-frontend \
  ./scripts/rollback.sh
```

This redeploys production from whatever image Release last tagged `stable`.
It also runs automatically in the Jenkinsfile's `post { failure { ... } }`
block if a pipeline run fails after Release has already run once.

---

## 9. Grant access for marking

Repo → **Settings → Collaborators** → add your marking tutor and the Unit
Chair's GitHub usernames, or set the repo to **Public**.

---

## 10. What's left for you to do

- Pick 1-2 real findings from `reports/npm-audit-*.json` and
  `reports/trivy-*.json` after a run, and write them up for the report
  (what it is, severity, whether/how addressed).
- Record the demo video (this pipeline, plus the rollback and alert-firing
  demos above, makes for a strong one).
- Take the Jenkins pipeline screenshot (all 7 stages green).
- Fill in video/repo links in the report doc.

---

## Notes on what's different from a forked open-source project

- **You own every line of this code**, so there's no risk of hidden
  behavior you have to discover the hard way — if a stage fails, the bug
  really is in what's here, not in an assumption about how someone else's
  app works.
- **Real integration tests, real database.** `backend/test/integration/`
  covers auth, project membership/ownership rules, task creation and
  status transitions, and comments — all run against a genuine MongoDB
  container in the Test stage, not mocks.
- **One frontend image works in both environments.** The built frontend
  never hard-codes a backend URL; nginx proxies `/api/*` to whichever
  backend container it's deployed next to (see
  `frontend/nginx.conf.template` and `BACKEND_HOST` in `scripts/deploy.sh`).
  This avoids a real bug an earlier draft of this kit had — baking the
  staging backend's URL into the image would have made the production
  frontend silently call the staging API.
