const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

projectSchema.methods.isMember = function isMember(userId) {
  const id = userId.toString();
  return this.owner.toString() === id || this.members.some((m) => m.toString() === id);
};

projectSchema.methods.isOwner = function isOwner(userId) {
  return this.owner.toString() === userId.toString();
};

module.exports = mongoose.model('Project', projectSchema);
