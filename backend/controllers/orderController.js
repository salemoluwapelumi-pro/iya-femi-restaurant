const db = require('../config/db');
const settingsModel = require('../models/settingsModel');
const { asyncHandler, ApiError } = require('../middleware/errors');
const { assert, isNonEmptyString, isOptionalString, isNigerianPhone, isPositiveInt } = require('../middleware/validate');

const ORDER_TYPES = ['delivery', 'pickup', 'dine_in'];
const PAYMENT_METHODS = ['bank_transfer', 'cash'];

function generateOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `IF-${ts}${rand}`;
}

// Server calculates the total from current database prices (BR-002, BR-016)
// and snapshots prices into order_items so later price changes never affect
// completed orders (BR-003).
const createOrder = asyncHandler(async (req, res) => {
  const b = req.body || {};
  assert(isNonEmptyString(b.customer_name, 140), 'Customer name is required');
  assert(isNigerianPhone(b.phone), 'A valid Nigerian phone number is required');
  assert(isOptionalString(b.email, 160), 'Invalid email');
  assert(ORDER_TYPES.includes(b.order_type), 'Order type must be delivery, pickup or dine_in');
  assert(PAYMENT_METHODS.includes(b.payment_method), 'Payment method must be bank_transfer or cash');
  assert(Array.isArray(b.items) && b.items.length > 0, 'Order must contain at least one item');
  assert(b.items.every((i) => isPositiveInt(i.menu_item_id) && isPositiveInt(i.quantity) && i.quantity <= 50), 'Invalid order items');
  assert(isOptionalString(b.notes, 1000), 'Notes too long');
  assert(isOptionalString(b.delivery_instructions, 1000), 'Delivery instructions too long');
  if (b.order_type === 'delivery') {
    assert(isNonEmptyString(b.delivery_address, 500), 'Delivery address is required for delivery orders');
    assert(isPositiveInt(b.delivery_zone_id), 'Please select a delivery zone');
  }

  const settings = await settingsModel.getAll();
  if (!settingsModel.isOpenNow(settings)) {
    throw new ApiError(409, "We're currently closed. You can place an order for the next available opening.");
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const ids = [...new Set(b.items.map((i) => i.menu_item_id))];
    const { rows: items } = await client.query(
      'SELECT id, name, price, available, archived FROM menu_items WHERE id = ANY($1)',
      [ids]
    );
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    for (const line of b.items) {
      const item = byId[line.menu_item_id];
      if (!item || item.archived) throw new ApiError(400, 'One of the items in your cart no longer exists');
      if (!item.available) throw new ApiError(409, `"${item.name}" is currently unavailable. Please remove it from your cart.`); // BR-001, BR-015
    }

    let subtotal = 0;
    for (const line of b.items) subtotal += Number(byId[line.menu_item_id].price) * line.quantity;

    let deliveryFee = 0;
    let zoneId = null;
    if (b.order_type === 'delivery') {
      const { rows: zones } = await client.query(
        'SELECT id, fee FROM delivery_zones WHERE id = $1 AND active = TRUE',
        [b.delivery_zone_id]
      );
      if (!zones.length) throw new ApiError(400, 'Selected delivery zone is not available');
      deliveryFee = Number(zones[0].fee); // BR-008
      zoneId = zones[0].id;
    }

    const minimumOrder = Number(settings.minimum_order || 0);
    if (subtotal < minimumOrder) {
      throw new ApiError(400, `Minimum order is ₦${minimumOrder.toLocaleString()}. Please add more items.`); // BR-009
    }

    const total = subtotal + deliveryFee;
    const orderNumber = generateOrderNumber();

    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (order_number, customer_name, phone, email, order_type,
         delivery_address, delivery_instructions, delivery_zone_id, delivery_fee,
         subtotal, discount, total, notes, status, payment_method, payment_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,$11,$12,'received',$13,'pending')
       RETURNING id, order_number, subtotal, delivery_fee, total, status, payment_method, payment_status, created_at`,
      [
        orderNumber, b.customer_name.trim(), b.phone.trim(), (b.email || '').trim(), b.order_type,
        b.order_type === 'delivery' ? b.delivery_address.trim() : '', (b.delivery_instructions || '').trim(),
        zoneId, deliveryFee, subtotal, total, (b.notes || '').trim(), b.payment_method,
      ]
    );
    const order = orderRows[0];

    for (const line of b.items) {
      const item = byId[line.menu_item_id];
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, item_name, unit_price, quantity, line_total)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [order.id, item.id, item.name, item.price, line.quantity, Number(item.price) * line.quantity]
      );
    }
    await client.query(
      "INSERT INTO order_status_history (order_id, status, changed_by) VALUES ($1, 'received', 'customer')",
      [order.id]
    );

    await client.query('COMMIT');
    res.status(201).json({
      success: true,
      data: {
        order_number: order.order_number,
        subtotal: Number(order.subtotal),
        delivery_fee: Number(order.delivery_fee),
        total: Number(order.total),
        status: order.status,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        bank_details: order.payment_method === 'bank_transfer'
          ? {
              bank_name: settings.bank_name || '',
              account_name: settings.bank_account_name || '',
              account_number: settings.bank_account_number || '',
            }
          : null,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// Tracking requires the phone number used on the order so strangers cannot
// look up other customers' orders (BR-012).
const trackOrder = asyncHandler(async (req, res) => {
  const { orderNumber } = req.params;
  const phone = String(req.query.phone || '').replace(/[\s-]/g, '');
  assert(isNonEmptyString(orderNumber, 30), 'Order number is required');
  assert(phone.length >= 10, 'Phone number used on the order is required');

  const { rows } = await db.query(
    `SELECT id, order_number, customer_name, order_type, delivery_address, delivery_fee,
            subtotal, total, status, payment_method, payment_status, created_at, phone
     FROM orders WHERE order_number = $1`,
    [orderNumber.toUpperCase()]
  );
  const order = rows[0];
  const normalize = (p) => p.replace(/[\s-]/g, '').replace(/^\+234/, '0');
  if (!order || normalize(order.phone) !== normalize(phone)) {
    throw new ApiError(404, 'No order found for that order number and phone');
  }

  const [{ rows: items }, { rows: history }] = await Promise.all([
    db.query('SELECT item_name, unit_price, quantity, line_total FROM order_items WHERE order_id = $1', [order.id]),
    db.query('SELECT status, created_at FROM order_status_history WHERE order_id = $1 ORDER BY created_at', [order.id]),
  ]);
  delete order.phone;
  delete order.id;
  res.json({ success: true, data: { ...order, items, history } });
});

module.exports = { createOrder, trackOrder };
