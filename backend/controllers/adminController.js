const db = require('../config/db');
const settingsModel = require('../models/settingsModel');
const auditModel = require('../models/auditModel');
const { asyncHandler, ApiError } = require('../middleware/errors');
const { assert, isNonEmptyString, isOptionalString, isPrice, isPositiveInt } = require('../middleware/validate');

const ORDER_STATUSES = [
  'received', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered',
  'ready_for_pickup', 'collected', 'cancelled', 'rejected',
];

// ---------- Dashboard ----------
const getDashboard = asyncHandler(async (req, res) => {
  const [today, pending, popular, recent, unavailable, customers] = await Promise.all([
    db.query(`SELECT COUNT(*)::int AS orders,
                     COALESCE(SUM(total) FILTER (WHERE payment_status = 'paid'), 0) AS revenue,
                     COUNT(*) FILTER (WHERE status IN ('delivered','collected'))::int AS completed,
                     COUNT(*) FILTER (WHERE status IN ('cancelled','rejected'))::int AS cancelled
              FROM orders WHERE created_at::date = CURRENT_DATE`),
    db.query(`SELECT COUNT(*)::int AS n FROM orders WHERE status IN ('received','confirmed','preparing')`),
    db.query(`SELECT oi.item_name, SUM(oi.quantity)::int AS sold
              FROM order_items oi JOIN orders o ON o.id = oi.order_id
              WHERE o.status NOT IN ('cancelled','rejected')
              GROUP BY oi.item_name ORDER BY sold DESC LIMIT 5`),
    db.query(`SELECT order_number, customer_name, order_type, total, status, payment_status, created_at
              FROM orders ORDER BY created_at DESC LIMIT 8`),
    db.query(`SELECT name FROM menu_items WHERE available = FALSE AND archived = FALSE`),
    db.query(`SELECT COUNT(DISTINCT phone)::int AS n FROM orders`),
  ]);
  res.json({
    success: true,
    data: {
      today: {
        orders: today.rows[0].orders,
        revenue: Number(today.rows[0].revenue),
        completed: today.rows[0].completed,
        cancelled: today.rows[0].cancelled,
      },
      pending_orders: pending.rows[0].n,
      customer_count: customers.rows[0].n,
      popular_items: popular.rows,
      recent_orders: recent.rows,
      unavailable_items: unavailable.rows.map((r) => r.name),
    },
  });
});

// ---------- Menu ----------
const listMenu = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT m.*, c.name AS category_name FROM menu_items m
     JOIN categories c ON c.id = m.category_id
     WHERE m.archived = FALSE ORDER BY c.display_order, m.name`
  );
  res.json({ success: true, data: rows });
});

function validateMenuBody(b) {
  assert(isNonEmptyString(b.name, 140), 'Name is required');
  assert(isPrice(b.price), 'Price must be a non-negative number');
  assert(isPositiveInt(b.category_id), 'Category is required');
  assert(isOptionalString(b.description, 2000), 'Description too long');
  assert(isOptionalString(b.ingredients, 2000), 'Ingredients too long');
  assert(isOptionalString(b.portion_info, 140), 'Portion info too long');
  assert(isOptionalString(b.image_url, 300), 'Image URL too long');
}

const createMenuItem = asyncHandler(async (req, res) => {
  const b = req.body || {};
  validateMenuBody(b);
  const { rows } = await db.query(
    `INSERT INTO menu_items (category_id, name, description, ingredients, portion_info, price, image_url, available, featured)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [b.category_id, b.name.trim(), (b.description || '').trim(), (b.ingredients || '').trim(),
     (b.portion_info || '').trim(), b.price, (b.image_url || '').trim(), b.available !== false, !!b.featured]
  );
  await auditModel.log(req.admin.id, 'menu.create', `Created "${rows[0].name}" at ₦${b.price}`);
  res.status(201).json({ success: true, data: rows[0] });
});

const updateMenuItem = asyncHandler(async (req, res) => {
  const b = req.body || {};
  validateMenuBody(b);
  const { rows: existing } = await db.query('SELECT * FROM menu_items WHERE id = $1 AND archived = FALSE', [req.params.id]);
  if (!existing.length) throw new ApiError(404, 'Menu item not found');
  const prev = existing[0];
  const { rows } = await db.query(
    `UPDATE menu_items SET category_id=$1, name=$2, description=$3, ingredients=$4, portion_info=$5,
       price=$6, image_url=$7, available=$8, featured=$9, updated_at=NOW()
     WHERE id=$10 RETURNING *`,
    [b.category_id, b.name.trim(), (b.description || '').trim(), (b.ingredients || '').trim(),
     (b.portion_info || '').trim(), b.price, (b.image_url || '').trim(), b.available !== false, !!b.featured, req.params.id]
  );
  if (Number(prev.price) !== Number(b.price)) {
    await auditModel.log(req.admin.id, 'menu.price_change', `Changed "${prev.name}" from ₦${prev.price} to ₦${b.price}`); // BR-014
  } else {
    await auditModel.log(req.admin.id, 'menu.update', `Updated "${prev.name}"`);
  }
  res.json({ success: true, data: rows[0] });
});

const archiveMenuItem = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    'UPDATE menu_items SET archived = TRUE, available = FALSE, updated_at = NOW() WHERE id = $1 RETURNING name',
    [req.params.id]
  );
  if (!rows.length) throw new ApiError(404, 'Menu item not found');
  await auditModel.log(req.admin.id, 'menu.archive', `Archived "${rows[0].name}"`);
  res.json({ success: true, data: { message: 'Item archived' } });
});

const toggleAvailability = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    'UPDATE menu_items SET available = NOT available, updated_at = NOW() WHERE id = $1 AND archived = FALSE RETURNING name, available',
    [req.params.id]
  );
  if (!rows.length) throw new ApiError(404, 'Menu item not found');
  await auditModel.log(req.admin.id, 'menu.availability', `Set "${rows[0].name}" ${rows[0].available ? 'available' : 'unavailable'}`);
  res.json({ success: true, data: rows[0] });
});

// ---------- Categories ----------
const listCategories = asyncHandler(async (req, res) => {
  const { rows } = await db.query('SELECT * FROM categories ORDER BY display_order');
  res.json({ success: true, data: rows });
});

const createCategory = asyncHandler(async (req, res) => {
  const b = req.body || {};
  assert(isNonEmptyString(b.name, 80), 'Category name is required');
  const slug = b.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const { rows } = await db.query(
    'INSERT INTO categories (name, slug, display_order) VALUES ($1, $2, $3) RETURNING *',
    [b.name.trim(), slug, Number(b.display_order) || 0]
  );
  await auditModel.log(req.admin.id, 'category.create', `Created category "${b.name}"`);
  res.status(201).json({ success: true, data: rows[0] });
});

const updateCategory = asyncHandler(async (req, res) => {
  const b = req.body || {};
  assert(isNonEmptyString(b.name, 80), 'Category name is required');
  const { rows } = await db.query(
    'UPDATE categories SET name=$1, display_order=$2, active=$3 WHERE id=$4 RETURNING *',
    [b.name.trim(), Number(b.display_order) || 0, b.active !== false, req.params.id]
  );
  if (!rows.length) throw new ApiError(404, 'Category not found');
  await auditModel.log(req.admin.id, 'category.update', `Updated category "${b.name}"`);
  res.json({ success: true, data: rows[0] });
});

const deleteCategory = asyncHandler(async (req, res) => {
  const { rows: items } = await db.query(
    'SELECT COUNT(*)::int AS n FROM menu_items WHERE category_id = $1 AND archived = FALSE',
    [req.params.id]
  );
  if (items[0].n > 0) throw new ApiError(409, 'Move or archive this category\'s menu items first');
  const { rows } = await db.query('DELETE FROM categories WHERE id = $1 RETURNING name', [req.params.id]);
  if (!rows.length) throw new ApiError(404, 'Category not found');
  await auditModel.log(req.admin.id, 'category.delete', `Deleted category "${rows[0].name}"`);
  res.json({ success: true, data: { message: 'Category deleted' } });
});

// ---------- Orders ----------
const listOrders = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const params = [];
  let sql = `SELECT o.*, z.name AS zone_name FROM orders o
             LEFT JOIN delivery_zones z ON z.id = o.delivery_zone_id`;
  if (status) {
    params.push(status);
    sql += ` WHERE o.status = $1`;
  }
  sql += ' ORDER BY o.created_at DESC LIMIT 200';
  const { rows } = await db.query(sql, params);
  res.json({ success: true, data: rows });
});

const getOrder = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT o.*, z.name AS zone_name FROM orders o
     LEFT JOIN delivery_zones z ON z.id = o.delivery_zone_id WHERE o.id = $1`,
    [req.params.id]
  );
  if (!rows.length) throw new ApiError(404, 'Order not found');
  const [{ rows: items }, { rows: history }, { rows: payments }] = await Promise.all([
    db.query('SELECT * FROM order_items WHERE order_id = $1', [req.params.id]),
    db.query('SELECT * FROM order_status_history WHERE order_id = $1 ORDER BY created_at', [req.params.id]),
    db.query('SELECT * FROM payments WHERE order_id = $1', [req.params.id]),
  ]);
  res.json({ success: true, data: { ...rows[0], items, history, payments } });
});

// Only staff can change status (BR-004).
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  assert(ORDER_STATUSES.includes(status), 'Invalid order status');
  const { rows } = await db.query(
    'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING order_number',
    [status, req.params.id]
  );
  if (!rows.length) throw new ApiError(404, 'Order not found');
  await db.query('INSERT INTO order_status_history (order_id, status, changed_by) VALUES ($1, $2, $3)', [
    req.params.id, status, req.admin.email,
  ]);
  await auditModel.log(req.admin.id, 'order.status', `Order ${rows[0].order_number} → ${status}`);
  res.json({ success: true, data: { order_number: rows[0].order_number, status } });
});

// An order is only marked paid after staff verify the payment and record a
// unique transaction reference (BR-005). The UNIQUE constraint on
// payments.reference prevents the same transaction being applied twice (BR-006).
const recordPayment = asyncHandler(async (req, res) => {
  const { reference, status } = req.body || {};
  assert(isNonEmptyString(reference, 120), 'A payment transaction reference is required');
  assert(['paid', 'failed', 'refunded'].includes(status), 'Payment status must be paid, failed or refunded');

  const { rows: orders } = await db.query('SELECT id, order_number, total, payment_method FROM orders WHERE id = $1', [req.params.id]);
  if (!orders.length) throw new ApiError(404, 'Order not found');
  const order = orders[0];

  if (status === 'paid') {
    try {
      await db.query(
        'INSERT INTO payments (order_id, method, amount, reference, status) VALUES ($1,$2,$3,$4,$5)',
        [order.id, order.payment_method, order.total, reference.trim(), 'verified']
      );
    } catch (err) {
      if (err.code === '23505') throw new ApiError(409, 'This transaction reference has already been used');
      throw err;
    }
  }

  await db.query('UPDATE orders SET payment_status = $1, updated_at = NOW() WHERE id = $2', [status, order.id]);
  await auditModel.log(req.admin.id, 'order.payment', `Order ${order.order_number} payment → ${status} (ref: ${reference})`);
  res.json({ success: true, data: { order_number: order.order_number, payment_status: status } });
});

// ---------- Reviews ----------
const listReviews = asyncHandler(async (req, res) => {
  const { rows } = await db.query('SELECT * FROM reviews ORDER BY created_at DESC LIMIT 200');
  res.json({ success: true, data: rows });
});

const moderateReview = asyncHandler(async (req, res) => {
  const { approved } = req.body || {};
  assert(typeof approved === 'boolean', 'approved must be true or false');
  const { rows } = await db.query('UPDATE reviews SET approved = $1 WHERE id = $2 RETURNING id', [approved, req.params.id]);
  if (!rows.length) throw new ApiError(404, 'Review not found');
  await auditModel.log(req.admin.id, 'review.moderate', `Review #${req.params.id} ${approved ? 'approved' : 'hidden'}`);
  res.json({ success: true, data: { id: rows[0].id, approved } });
});

const deleteReview = asyncHandler(async (req, res) => {
  const { rows } = await db.query('DELETE FROM reviews WHERE id = $1 RETURNING id', [req.params.id]);
  if (!rows.length) throw new ApiError(404, 'Review not found');
  await auditModel.log(req.admin.id, 'review.delete', `Deleted review #${req.params.id}`);
  res.json({ success: true, data: { message: 'Review deleted' } });
});

// ---------- Settings ----------
const EDITABLE_SETTINGS = [
  'restaurant_name', 'tagline', 'description', 'address',
  'phone_primary', 'phone_secondary', 'phone_tertiary', 'whatsapp_number', 'email',
  'maps_query', 'opening_hours', 'ordering_enabled', 'minimum_order',
  'bank_name', 'bank_account_name', 'bank_account_number',
  'facebook_url', 'instagram_url', 'tiktok_url',
];

const getSettings = asyncHandler(async (req, res) => {
  const all = await settingsModel.getAll();
  res.json({ success: true, data: all });
});

const updateSettings = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const updated = [];
  for (const key of EDITABLE_SETTINGS) {
    if (b[key] !== undefined) {
      assert(typeof b[key] === 'string' && b[key].length <= 4000, `Invalid value for ${key}`);
      await settingsModel.set(key, b[key]);
      updated.push(key);
    }
  }
  await auditModel.log(req.admin.id, 'settings.update', `Updated: ${updated.join(', ')}`);
  res.json({ success: true, data: { updated } });
});

// ---------- Delivery zones ----------
const listZones = asyncHandler(async (req, res) => {
  const { rows } = await db.query('SELECT * FROM delivery_zones ORDER BY fee');
  res.json({ success: true, data: rows });
});

const createZone = asyncHandler(async (req, res) => {
  const b = req.body || {};
  assert(isNonEmptyString(b.name, 120), 'Zone name is required');
  assert(isPrice(b.fee), 'Fee must be a non-negative number');
  assert(isOptionalString(b.areas, 1000), 'Areas too long');
  const { rows } = await db.query(
    'INSERT INTO delivery_zones (name, areas, fee) VALUES ($1,$2,$3) RETURNING *',
    [b.name.trim(), (b.areas || '').trim(), b.fee]
  );
  await auditModel.log(req.admin.id, 'zone.create', `Created zone "${b.name}" at ₦${b.fee}`);
  res.status(201).json({ success: true, data: rows[0] });
});

const updateZone = asyncHandler(async (req, res) => {
  const b = req.body || {};
  assert(isNonEmptyString(b.name, 120), 'Zone name is required');
  assert(isPrice(b.fee), 'Fee must be a non-negative number');
  const { rows } = await db.query(
    'UPDATE delivery_zones SET name=$1, areas=$2, fee=$3, active=$4 WHERE id=$5 RETURNING *',
    [b.name.trim(), (b.areas || '').trim(), b.fee, b.active !== false, req.params.id]
  );
  if (!rows.length) throw new ApiError(404, 'Zone not found');
  await auditModel.log(req.admin.id, 'zone.update', `Updated zone "${b.name}"`);
  res.json({ success: true, data: rows[0] });
});

const deleteZone = asyncHandler(async (req, res) => {
  const { rows } = await db.query('DELETE FROM delivery_zones WHERE id = $1 RETURNING name', [req.params.id]);
  if (!rows.length) throw new ApiError(404, 'Zone not found');
  await auditModel.log(req.admin.id, 'zone.delete', `Deleted zone "${rows[0].name}"`);
  res.json({ success: true, data: { message: 'Zone deleted' } });
});

// ---------- Audit log ----------
const listAuditLog = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT a.*, ad.name AS admin_name FROM audit_log a
     LEFT JOIN admins ad ON ad.id = a.admin_id
     ORDER BY a.created_at DESC LIMIT 200`
  );
  res.json({ success: true, data: rows });
});

module.exports = {
  getDashboard,
  listMenu, createMenuItem, updateMenuItem, archiveMenuItem, toggleAvailability,
  listCategories, createCategory, updateCategory, deleteCategory,
  listOrders, getOrder, updateOrderStatus, recordPayment,
  listReviews, moderateReview, deleteReview,
  getSettings, updateSettings,
  listZones, createZone, updateZone, deleteZone,
  listAuditLog,
};
