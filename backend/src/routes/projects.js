const express = require('express');
const { body, validationResult } = require('express-validator');
const Project = require('../models/Project');
const User = require('../models/User');
const Task = require('../models/Task');
const Comment = require('../models/Comment');
const { authenticate } = require('../middleware/auth');
const { loadProject, requireMember, requireOwner } = require('../middleware/project');
const { HttpError } = require('../middleware/errorHandler');
const tasksRouter = require('./tasks');

const router = express.Router();

router.use(authenticate);

function projectJSON(project) {
  return {
    id: project._id,
    name: project.name,
    description: project.description,
    owner: project.owner,
    members: project.members,
    createdAt: project.createdAt,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const projects = await Project.find({
      $or: [{ owner: req.user._id }, { members: req.user._id }],
    }).sort({ createdAt: -1 });
    res.json({ projects: projects.map(projectJSON) });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  [body('name').trim().notEmpty().withMessage('Project name is required')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new HttpError(400, errors.array()[0].msg));
      }
      const { name, description } = req.body;
      const project = await Project.create({
        name,
        description: description || '',
        owner: req.user._id,
        members: [req.user._id],
      });
      res.status(201).json({ project: projectJSON(project) });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/:id', loadProject, requireMember, (req, res) => {
  res.json({ project: projectJSON(req.project) });
});

router.patch(
  '/:id',
  loadProject,
  requireOwner,
  [body('name').optional().trim().notEmpty().withMessage('Project name cannot be empty')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new HttpError(400, errors.array()[0].msg));
      }
      const { name, description } = req.body;
      if (name !== undefined) req.project.name = name;
      if (description !== undefined) req.project.description = description;
      await req.project.save();
      res.json({ project: projectJSON(req.project) });
    } catch (err) {
      next(err);
    }
  }
);

router.delete('/:id', loadProject, requireOwner, async (req, res, next) => {
  try {
    const taskIds = await Task.find({ project: req.project._id }).distinct('_id');
    await Comment.deleteMany({ task: { $in: taskIds } });
    await Task.deleteMany({ project: req.project._id });
    await req.project.deleteOne();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post(
  '/:id/members',
  loadProject,
  requireOwner,
  [body('email').isEmail().withMessage('Valid email is required')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new HttpError(400, errors.array()[0].msg));
      }
      const user = await User.findOne({ email: req.body.email.toLowerCase() });
      if (!user) {
        return next(new HttpError(404, 'No user with that email'));
      }
      if (req.project.members.some((m) => m.toString() === user._id.toString())) {
        return next(new HttpError(409, 'User is already a member'));
      }
      req.project.members.push(user._id);
      await req.project.save();
      res.status(201).json({ project: projectJSON(req.project) });
    } catch (err) {
      next(err);
    }
  }
);

router.delete('/:id/members/:userId', loadProject, requireOwner, async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (userId === req.project.owner.toString()) {
      return next(new HttpError(400, 'Cannot remove the project owner'));
    }
    req.project.members = req.project.members.filter((m) => m.toString() !== userId);
    await req.project.save();
    res.json({ project: projectJSON(req.project) });
  } catch (err) {
    next(err);
  }
});

// Nested task routes: /api/projects/:id/tasks
router.use('/:id/tasks', loadProject, requireMember, tasksRouter);

module.exports = router;
module.exports.projectJSON = projectJSON;
