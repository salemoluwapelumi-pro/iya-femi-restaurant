const db = require('../config/db');

async function log(adminId, action, details) {
  await db.query('INSERT INTO audit_log (admin_id, action, details) VALUES ($1, $2, $3)', [
    adminId || null,
    action,
    details || '',
  ]);
}

module.exports = { log };
