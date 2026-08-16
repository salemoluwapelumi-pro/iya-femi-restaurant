const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const auditModel = require('../models/auditModel');
const { asyncHandler, ApiError } = require('../middleware/errors');
const { assert, isNonEmptyString } = require('../middleware/validate');

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  assert(isNonEmptyString(email, 160) && isNonEmptyString(password, 200), 'Email and password are required');

  const { rows } = await db.query(
    'SELECT id, name, email, password_hash, role FROM admins WHERE email = $1 AND active = TRUE',
    [email.trim().toLowerCase()]
  );
  const admin = rows[0];
  const valid = admin && (await bcrypt.compare(password, admin.password_hash));
  if (!valid) throw new ApiError(401, 'Invalid email or password');

  const token = jwt.sign(
    { sub: admin.id, email: admin.email, name: admin.name, role: admin.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
  await auditModel.log(admin.id, 'login', `Admin ${admin.email} logged in`);
  res.json({ success: true, data: { token, admin: { name: admin.name, email: admin.email, role: admin.role } } });
});

module.exports = { login };
