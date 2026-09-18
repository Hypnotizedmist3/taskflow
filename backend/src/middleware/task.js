const mongoose = require('mongoose');
const Task = require('../models/Task');
const Project = require('../models/Project');
const { HttpError } = require('./errorHandler');

async function loadTask(req, res, next) {
  const { taskId } = req.params;
  if (!mongoose.isValidObjectId(taskId)) {
    return next(new HttpError(404, 'Task not found'));
  }
  const task = await Task.findById(taskId);
  if (!task) {
    return next(new HttpError(404, 'Task not found'));
  }
  const project = await Project.findById(task.project);
  if (!project) {
    return next(new HttpError(404, 'Task not found'));
  }
  if (!project.isMember(req.user._id)) {
    return next(new HttpError(403, 'You are not a member of this task’s project'));
  }
  req.task = task;
  req.project = project;
  return next();
}

module.exports = { loadTask };
