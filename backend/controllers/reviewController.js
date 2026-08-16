const db = require('../config/db');
const { asyncHandler } = require('../middleware/errors');
const { assert, isNonEmptyString, isOptionalString } = require('../middleware/validate');

const getApprovedReviews = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT customer_name, rating, comment, created_at, order_id IS NOT NULL AS verified_purchase
     FROM reviews WHERE approved = TRUE ORDER BY created_at DESC LIMIT 50`
  );
  res.json({ success: true, data: rows });
});

// Reviews go into a moderation queue; a review submitted with a valid completed
// order number is flagged as a verified purchase (BR-013).
const submitReview = asyncHandler(async (req, res) => {
  const b = req.body || {};
  assert(isNonEmptyString(b.customer_name, 140), 'Name is required');
  assert(Number.isInteger(b.rating) && b.rating >= 1 && b.rating <= 5, 'Rating must be 1-5');
  assert(isOptionalString(b.comment, 2000), 'Comment too long');
  assert(isOptionalString(b.order_number, 30), 'Invalid order number');

  let orderId = null;
  if (b.order_number) {
    const { rows } = await db.query(
      `SELECT id FROM orders WHERE order_number = $1 AND status IN ('delivered','collected')`,
      [b.order_number.trim().toUpperCase()]
    );
    orderId = rows.length ? rows[0].id : null;
  }

  await db.query(
    'INSERT INTO reviews (order_id, customer_name, rating, comment) VALUES ($1, $2, $3, $4)',
    [orderId, b.customer_name.trim(), b.rating, (b.comment || '').trim()]
  );
  res.status(201).json({ success: true, data: { message: 'Thank you! Your review will appear after moderation.' } });
});

module.exports = { getApprovedReviews, submitReview };
