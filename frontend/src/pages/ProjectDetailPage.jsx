import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

const COLUMNS = [
  { key: 'todo', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'done', label: 'Done' },
];

export function ProjectDetailPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [memberEmail, setMemberEmail] = useState('');

  function loadAll() {
    Promise.all([api.getProject(token, id), api.listTasks(token, id)])
      .then(([projectData, taskData]) => {
        setProject(projectData.project);
        setTasks(taskData.tasks);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(loadAll, [token, id]);

  async function handleAddTask(e) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await api.createTask(token, id, { title: title.trim() });
      setTitle('');
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleStatusChange(taskId, status) {
    try {
      await api.updateTask(token, taskId, { status });
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddMember(e) {
    e.preventDefault();
    if (!memberEmail.trim()) return;
    try {
      await api.addMember(token, id, memberEmail.trim());
      setMemberEmail('');
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!project) return <p>Loading...</p>;

  const isOwner = project.owner === user?.id;

  return (
    <div className="page">
      <h1>{project.name}</h1>
      {project.description && <p className="muted">{project.description}</p>}

      <form className="inline-form" onSubmit={handleAddTask}>
        <input
          placeholder="New task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <button type="submit">Add task</button>
      </form>

      <div className="board">
        {COLUMNS.map((col) => (
          <div className="board-column" key={col.key}>
            <h2>{col.label}</h2>
            {tasks
              .filter((t) => t.status === col.key)
              .map((t) => (
                <div className="task-card" key={t.id}>
                  <Link to={`/tasks/${t.id}`}>{t.title}</Link>
                  <div className="task-card-actions">
                    {COLUMNS.filter((c) => c.key !== t.status).map((c) => (
                      <button key={c.key} type="button" onClick={() => handleStatusChange(t.id, c.key)}>
                        {'→'} {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        ))}
      </div>

      {isOwner && (
        <section className="members">
          <h2>Members</h2>
          <form className="inline-form" onSubmit={handleAddMember}>
            <input
              type="email"
              placeholder="Invite by email"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              required
            />
            <button type="submit">Add member</button>
          </form>
        </section>
      )}
    </div>
  );
}
