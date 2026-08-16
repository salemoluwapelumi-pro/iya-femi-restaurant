const jwt = require('jsonwebtoken');
const { ApiError } = require('./errors');

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new ApiError(401, 'Authentication required'));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = { id: payload.sub, email: payload.email, name: payload.name, role: payload.role };
    return next();
  } catch (err) {
    return next(new ApiError(401, 'Invalid or expired token'));
  }
}

module.exports = { requireAdmin };
