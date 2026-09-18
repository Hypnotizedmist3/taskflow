import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export function TaskDetailPage() {
  const { taskId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  function loadAll() {
    Promise.all([api.getTask(token, taskId), api.listComments(token, taskId)])
      .then(([taskData, commentData]) => {
        setTask(taskData.task);
        setComments(commentData.comments);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(loadAll, [token, taskId]);

  async function handleAddComment(e) {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await api.addComment(token, taskId, text.trim());
      setText('');
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete() {
    try {
      await api.deleteTask(token, taskId);
      navigate(`/projects/${task.project}`);
    } catch (err) {
      setError(err.message);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!task) return <p>Loading...</p>;

  return (
    <div className="page">
      <h1>{task.title}</h1>
      <p className="muted">
        Status: {task.status} · Priority: {task.priority}
      </p>
      {task.description && <p>{task.description}</p>}
      <button type="button" onClick={handleDelete} className="danger">
        Delete task
      </button>

      <section>
        <h2>Comments</h2>
        <ul className="comment-list">
          {comments.map((c) => (
            <li key={c.id}>{c.text}</li>
          ))}
        </ul>
        <form className="inline-form" onSubmit={handleAddComment}>
          <input
            placeholder="Add a comment"
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
          />
          <button type="submit">Post</button>
        </form>
      </section>
    </div>
  );
}
