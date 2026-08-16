const express = require('express');
const rateLimit = require('express-rate-limit');
const publicController = require('../controllers/publicController');
const orderController = require('../controllers/orderController');
const reviewController = require('../controllers/reviewController');

const router = express.Router();

const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

router.get('/menu', publicController.getMenu);
router.get('/menu/:id', publicController.getMenuItem);
router.get('/categories', publicController.getCategories);
router.get('/settings/public', publicController.getPublicSettings);
router.get('/delivery-zones', publicController.getDeliveryZones);

router.post('/orders', writeLimiter, orderController.createOrder);
router.get('/orders/track/:orderNumber', orderController.trackOrder);

router.get('/reviews', reviewController.getApprovedReviews);
router.post('/reviews', writeLimiter, reviewController.submitReview);

module.exports = router;
