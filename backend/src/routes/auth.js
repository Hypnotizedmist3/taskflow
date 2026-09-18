const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { HttpError } = require('../middleware/errorHandler');

const router = express.Router();

function signToken(user) {
  return jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new HttpError(400, errors.array()[0].msg));
      }

      const { name, email, password } = req.body;
      const existing = await User.findOne({ email });
      if (existing) {
        return next(new HttpError(409, 'An account with that email already exists'));
      }

      const user = new User({ name, email });
      await user.setPassword(password);
      await user.save();

      const token = signToken(user);
      return res.status(201).json({ token, user: user.toSafeJSON() });
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new HttpError(400, errors.array()[0].msg));
      }

      const { email, password } = req.body;
      const user = await User.findOne({ email }).select('+passwordHash');
      if (!user) {
        return next(new HttpError(401, 'Invalid email or password'));
      }

      const valid = await user.verifyPassword(password);
      if (!valid) {
        return next(new HttpError(401, 'Invalid email or password'));
      }

      const token = signToken(user);
      return res.json({ token, user: user.toSafeJSON() });
    } catch (err) {
      return next(err);
    }
  }
);

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

module.exports = router;
