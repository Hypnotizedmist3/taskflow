const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Task = require('../models/Task');
const { HttpError } = require('../middleware/errorHandler');

// Mounted at /api/projects/:id/tasks with { mergeParams: true }.
// By the time requests reach here, `authenticate`, `loadProject`, and
// `requireMember` have already run (see routes/projects.js).
const router = express.Router({ mergeParams: true });

function taskJSON(task) {
  return {
    id: task._id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    project: task.project,
    assignee: task.assignee,
    createdBy: task.createdBy,
    dueDate: task.dueDate,
    createdAt: task.createdAt,
  };
}

router.get(
  '/',
  [query('status').optional().isIn(Task.TASK_STATUSES)],
  async (req, res, next) => {
    try {
      const filter = { project: req.project._id };
      if (req.query.status) filter.status = req.query.status;
      const tasks = await Task.find(filter).sort({ createdAt: -1 });
      res.json({ tasks: tasks.map(taskJSON) });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/',
  [
    body('title').trim().notEmpty().withMessage('Task title is required'),
    body('status').optional().isIn(Task.TASK_STATUSES).withMessage('Invalid status'),
    body('priority').optional().isIn(Task.TASK_PRIORITIES).withMessage('Invalid priority'),
    body('assignee').optional({ nullable: true }).isMongoId().withMessage('Invalid assignee id'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new HttpError(400, errors.array()[0].msg));
      }

      const { title, description, status, priority, assignee, dueDate } = req.body;

      if (assignee && !req.project.isMember(assignee)) {
        return next(new HttpError(400, 'Assignee must be a member of the project'));
      }

      const task = await Task.create({
        title,
        description: description || '',
        status: status || 'todo',
        priority: priority || 'medium',
        project: req.project._id,
        assignee: assignee || null,
        createdBy: req.user._id,
        dueDate: dueDate || null,
      });

      res.status(201).json({ task: taskJSON(task) });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
module.exports.taskJSON = taskJSON;
