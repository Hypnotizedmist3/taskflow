const mongoose = require('mongoose');
const Project = require('../models/Project');
const { HttpError } = require('./errorHandler');

async function loadProject(req, res, next) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return next(new HttpError(404, 'Project not found'));
  }
  const project = await Project.findById(id);
  if (!project) {
    return next(new HttpError(404, 'Project not found'));
  }
  req.project = project;
  return next();
}

function requireMember(req, res, next) {
  if (!req.project.isMember(req.user._id)) {
    return next(new HttpError(403, 'You are not a member of this project'));
  }
  return next();
}

function requireOwner(req, res, next) {
  if (!req.project.isOwner(req.user._id)) {
    return next(new HttpError(403, 'Only the project owner can do this'));
  }
  return next();
}

module.exports = { loadProject, requireMember, requireOwner };
