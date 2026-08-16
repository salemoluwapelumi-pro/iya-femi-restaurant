const db = require('../config/db');

async function getAll() {
  const { rows } = await db.query('SELECT key, value FROM settings');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

async function set(key, value) {
  await db.query(
    'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
    [key, String(value)]
  );
}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function isOpenNow(settings) {
  if (settings.ordering_enabled !== 'true') return false;
  let hours;
  try {
    hours = JSON.parse(settings.opening_hours || '{}');
  } catch {
    return true;
  }
  const now = new Date();
  const day = hours[DAYS[now.getDay()]];
  if (!day || day.closed) return false;
  const hhmm = now.toTimeString().slice(0, 5);
  return hhmm >= day.open && hhmm <= day.close;
}

module.exports = { getAll, set, isOpenNow };
