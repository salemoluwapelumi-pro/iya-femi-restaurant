const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const adminController = require('../controllers/adminController');
const { requireAdmin } = require('../middleware/auth');
const { ApiError } = require('../middleware/errors');

const router = express.Router();
router.use(requireAdmin); // All admin routes require authentication (BR-011)

// Secure image upload: whitelist extensions/mime types, random filenames, 3MB cap.
const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'frontend', 'assets', 'uploads'),
  filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + ALLOWED[file.mimetype]),
});
const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED[file.mimetype]) return cb(new ApiError(400, 'Only JPEG, PNG or WebP images are allowed'));
    cb(null, true);
  },
});

router.get('/dashboard', adminController.getDashboard);

router.get('/menu', adminController.listMenu);
router.post('/menu', adminController.createMenuItem);
router.put('/menu/:id', adminController.updateMenuItem);
router.delete('/menu/:id', adminController.archiveMenuItem);
router.patch('/menu/:id/availability', adminController.toggleAvailability);

router.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No image uploaded' });
  res.json({ success: true, data: { url: `/assets/uploads/${req.file.filename}` } });
});

router.get('/categories', adminController.listCategories);
router.post('/categories', adminController.createCategory);
router.put('/categories/:id', adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);

router.get('/orders', adminController.listOrders);
router.get('/orders/:id', adminController.getOrder);
router.patch('/orders/:id/status', adminController.updateOrderStatus);
router.post('/orders/:id/payment', adminController.recordPayment);

router.get('/reviews', adminController.listReviews);
router.patch('/reviews/:id', adminController.moderateReview);
router.delete('/reviews/:id', adminController.deleteReview);

router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);

router.get('/delivery-zones', adminController.listZones);
router.post('/delivery-zones', adminController.createZone);
router.put('/delivery-zones/:id', adminController.updateZone);
router.delete('/delivery-zones/:id', adminController.deleteZone);

router.get('/audit-log', adminController.listAuditLog);

module.exports = router;
