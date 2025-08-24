const express = require('express');
const router = express.Router();
const practiceTestController = require('../controllers/practiceTest.controller');
const { protect } = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/role.middleware');
const multer = require('multer');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept Excel files
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel' ||
        file.originalname.endsWith('.xlsx') ||
        file.originalname.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'), false);
    }
  }
});

// Admin routes (admin only)
router.post('/', protect, authorize('admin'), practiceTestController.createPracticeTest);
router.get('/admin', protect, authorize('admin'), practiceTestController.getAllPracticeTests);
router.get('/admin/:testId', protect, authorize('admin'), practiceTestController.getPracticeTestById);
router.get('/admin/:testId/statistics', protect, authorize('admin'), practiceTestController.getTestStatistics);
router.put('/admin/:testId', protect, authorize('admin'), practiceTestController.updatePracticeTest);
router.delete('/admin/:testId', protect, authorize('admin'), practiceTestController.deletePracticeTest);
router.post('/admin/:testId/reset', protect, authorize('admin'), practiceTestController.resetQuestionUsage);
router.delete('/admin/:userId/:testId/reset-cooldown', protect, authorize('admin'), practiceTestController.resetUserTestCooldown);
router.post('/admin/:userId/:testId/set-cooldown', protect, authorize('admin'), practiceTestController.setUserCooldown);
router.get('/admin/:testId/users', protect, authorize('admin'), practiceTestController.getTestUsers);
router.put('/admin/:testId/settings', protect, authorize('admin'), practiceTestController.updateTestSettings);
router.put('/admin/:testId/question/:questionIndex', protect, authorize('admin'), practiceTestController.updateTestQuestion);
router.patch('/admin/:testId/active-status', protect, authorize('admin'), practiceTestController.updateTestActiveStatus);

// JSON import routes (admin only)
router.post('/admin/import-json', protect, authorize('admin'), practiceTestController.importQuestionsFromJSON);
router.put('/admin/:testId/update-json', protect, authorize('admin'), practiceTestController.updateTestWithJSON);

// Excel import routes (admin only)
router.post('/admin/import-excel', protect, authorize('admin'), upload.single('excelFile'), practiceTestController.importQuestionsFromExcel);
router.put('/admin/:testId/update-excel', protect, authorize('admin'), upload.single('excelFile'), practiceTestController.updateTestWithExcel);

// Bulk update test settings (admin only)
router.put('/admin/bulk-settings', protect, authorize('admin'), practiceTestController.bulkUpdateTestSettings);

// Public route to get available tests (no authentication required)
router.get('/available', practiceTestController.getAvailablePracticeTests);

// Student/Corporate/Government routes
router.post('/:testId/start', protect, authorize('student', 'corporate', 'government'), practiceTestController.startPracticeTest);
router.post('/attempt/:testAttemptId/submit', protect, authorize('student', 'corporate', 'government'), practiceTestController.submitPracticeTest);
router.get('/attempts', protect, authorize('student', 'corporate', 'government'), practiceTestController.getUserTestAttempts);
router.delete('/attempt/:attemptId', protect, practiceTestController.deleteAttempt);
router.get('/attempt/:testAttemptId/pdf', protect, authorize('student', 'corporate', 'government', 'admin'), practiceTestController.downloadAttemptPDF);

module.exports = router; 