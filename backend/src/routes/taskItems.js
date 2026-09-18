const express = require('express');
const { body, validationResult } = require('express-validator');
const Task = require('../models/Task');
const Comment = require('../models/Comment');
const { authenticate } = require('../middleware/auth');
const { loadTask } = require('../middleware/task');
const { HttpError } = require('../middleware/errorHandler');
const { taskJSON } = require('./tasks');

// Mounted at /api/tasks
const router = express.Router();

router.use(authenticate);

function commentJSON(comment) {
  return {
    id: comment._id,
    task: comment.task,
    author: comment.author,
    text: comment.text,
    createdAt: comment.createdAt,
  };
}

router.get('/:taskId', loadTask, (req, res) => {
  res.json({ task: taskJSON(req.task) });
});

router.patch(
  '/:taskId',
  loadTask,
  [
    body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
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

      if (title !== undefined) req.task.title = title;
      if (description !== undefined) req.task.description = description;
      if (status !== undefined) req.task.status = status;
      if (priority !== undefined) req.task.priority = priority;
      if (assignee !== undefined) req.task.assignee = assignee || null;
      if (dueDate !== undefined) req.task.dueDate = dueDate || null;

      await req.task.save();
      res.json({ task: taskJSON(req.task) });
    } catch (err) {
      next(err);
    }
  }
);

router.delete('/:taskId', loadTask, async (req, res, next) => {
  try {
    const isCreator = req.task.createdBy.toString() === req.user._id.toString();
    const isOwner = req.project.isOwner(req.user._id);
    if (!isCreator && !isOwner) {
      return next(new HttpError(403, 'Only the task creator or project owner can delete this task'));
    }
    await Comment.deleteMany({ task: req.task._id });
    await req.task.deleteOne();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get('/:taskId/comments', loadTask, async (req, res, next) => {
  try {
    const comments = await Comment.find({ task: req.task._id }).sort({ createdAt: 1 });
    res.json({ comments: comments.map(commentJSON) });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/:taskId/comments',
  loadTask,
  [body('text').trim().notEmpty().withMessage('Comment text is required')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new HttpError(400, errors.array()[0].msg));
      }
      const comment = await Comment.create({
        task: req.task._id,
        author: req.user._id,
        text: req.body.text,
      });
      res.status(201).json({ comment: commentJSON(comment) });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
