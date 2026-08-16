const db = require('../config/db');
const settingsModel = require('../models/settingsModel');
const { asyncHandler } = require('../middleware/errors');

const PUBLIC_SETTING_KEYS = [
  'restaurant_name', 'tagline', 'description', 'address',
  'phone_primary', 'phone_secondary', 'phone_tertiary', 'whatsapp_number', 'email',
  'maps_query', 'opening_hours', 'ordering_enabled', 'minimum_order',
  'bank_name', 'bank_account_name', 'bank_account_number',
  'facebook_url', 'instagram_url', 'tiktok_url',
];

const getMenu = asyncHandler(async (req, res) => {
  const { category, search, sort } = req.query;
  const params = [];
  let sql = `
    SELECT m.id, m.name, m.description, m.portion_info, m.price, m.image_url,
           m.available, m.featured, c.name AS category_name, c.slug AS category_slug
    FROM menu_items m JOIN categories c ON c.id = m.category_id
    WHERE m.archived = FALSE AND c.active = TRUE`;
  if (category) {
    params.push(category);
    sql += ` AND c.slug = $${params.length}`;
  }
  if (search) {
    params.push(`%${search}%`);
    sql += ` AND (m.name ILIKE $${params.length} OR m.description ILIKE $${params.length})`;
  }
  const sorts = {
    price_asc: 'm.price ASC',
    price_desc: 'm.price DESC',
    name: 'm.name ASC',
  };
  sql += ` ORDER BY ${sorts[sort] || 'c.display_order, m.name'}`;
  const { rows } = await db.query(sql, params);
  res.json({ success: true, data: rows });
});

const getMenuItem = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT m.*, c.name AS category_name, c.slug AS category_slug
     FROM menu_items m JOIN categories c ON c.id = m.category_id
     WHERE m.id = $1 AND m.archived = FALSE`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ success: false, error: 'Menu item not found' });
  res.json({ success: true, data: rows[0] });
});

const getCategories = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT c.id, c.name, c.slug, c.display_order,
            COUNT(m.id)::int AS item_count
     FROM categories c
     LEFT JOIN menu_items m ON m.category_id = c.id AND m.archived = FALSE
     WHERE c.active = TRUE
     GROUP BY c.id ORDER BY c.display_order`
  );
  res.json({ success: true, data: rows });
});

const getPublicSettings = asyncHandler(async (req, res) => {
  const all = await settingsModel.getAll();
  const data = {};
  for (const key of PUBLIC_SETTING_KEYS) data[key] = all[key] || '';
  data.is_open_now = settingsModel.isOpenNow(all);
  res.json({ success: true, data });
});

const getDeliveryZones = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    'SELECT id, name, areas, fee FROM delivery_zones WHERE active = TRUE ORDER BY fee'
  );
  res.json({ success: true, data: rows });
});

module.exports = { getMenu, getMenuItem, getCategories, getPublicSettings, getDeliveryZones };
