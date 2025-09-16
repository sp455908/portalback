const express = require('express');
const router = express.Router();
const practiceTestController = require('../controllers/practiceTest.controller');
const { protect, protectWithQueryToken } = require('../middlewares/auth.middleware');
const { verifyOriginForDownloads } = require('../middlewares/security.middleware');
const authorize = require('../middlewares/role.middleware');
const { validateBatchAccess } = require('../middlewares/batchAccess.middleware');
const { practiceTestRateLimit, testSubmissionRateLimit, pdfDownloadRateLimit } = require('../middlewares/rateLimit.middleware');
const { validationMiddleware } = require('../middlewares/validation.middleware');
const windowFocusMiddleware = require('../middlewares/windowFocus.middleware');
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

// Admin routes (admin and owner)
router.post('/', protect, authorize('admin', 'owner'), practiceTestController.createPracticeTest);
router.get('/admin', protect, authorize('admin', 'owner'), practiceTestController.getAllPracticeTests);
router.get('/admin/:testId', protect, authorize('admin', 'owner'), practiceTestController.getPracticeTestById);
router.get('/admin/:testId/statistics', protect, authorize('admin', 'owner'), practiceTestController.getTestStatistics);
router.put('/admin/:testId', protect, authorize('admin', 'owner'), practiceTestController.updatePracticeTest);
router.delete('/admin/:testId', protect, authorize('admin', 'owner'), practiceTestController.deletePracticeTest);
router.post('/admin/:testId/reset', protect, authorize('admin', 'owner'), practiceTestController.resetQuestionUsage);
router.delete('/admin/:userId/:testId/reset-cooldown', protect, authorize('admin', 'owner'), practiceTestController.resetUserTestCooldown);
router.post('/admin/:userId/:testId/set-cooldown', protect, authorize('admin', 'owner'), practiceTestController.setUserCooldown);
router.get('/admin/:testId/users', protect, authorize('admin', 'owner'), practiceTestController.getTestUsers);
router.put('/admin/:testId/settings', protect, authorize('admin', 'owner'), practiceTestController.updateTestSettings);
router.put('/admin/:testId/question/:questionIndex', protect, authorize('admin', 'owner'), practiceTestController.updateTestQuestion);
router.patch('/admin/:testId/active-status', protect, authorize('admin', 'owner'), practiceTestController.updateTestActiveStatus);

// JSON import routes (admin and owner)
router.post('/admin/import-json', protect, authorize('admin', 'owner'), practiceTestController.importQuestionsFromJSON);
router.put('/admin/:testId/update-json', protect, authorize('admin', 'owner'), practiceTestController.updateTestWithJSON);

// Excel import routes (admin and owner)
router.post('/admin/import-excel', protect, authorize('admin', 'owner'), upload.single('excelFile'), practiceTestController.importQuestionsFromExcel);
router.put('/admin/:testId/update-excel', protect, authorize('admin', 'owner'), upload.single('excelFile'), practiceTestController.updateTestWithExcel);
router.post('/admin/parse-excel', protect, authorize('admin', 'owner'), upload.single('excelFile'), practiceTestController.parseExcelPreview);

// Bulk update test settings (admin and owner)
router.put('/admin/bulk-settings', protect, authorize('admin', 'owner'), practiceTestController.bulkUpdateTestSettings);

// Route to get available tests (requires authentication to filter by user type)
router.get('/available', practiceTestRateLimit, protect, authorize('student', 'corporate', 'government'), practiceTestController.getAvailablePracticeTests);

// Student/Corporate/Government routes
router.post('/:testId/start', practiceTestRateLimit, protect, authorize('student', 'corporate', 'government'), validateBatchAccess, windowFocusMiddleware.preventConcurrentSessions, windowFocusMiddleware.addTestSecurityHeaders, validationMiddleware.validateTestId, practiceTestController.startPracticeTest);
router.get('/attempt/:testAttemptId', protect, authorize('student', 'corporate', 'government'), windowFocusMiddleware.addTestSecurityHeaders, validationMiddleware.validateAttemptId, practiceTestController.getAttemptDetails);
router.post('/attempt/:testAttemptId/submit', testSubmissionRateLimit, protect, authorize('student', 'corporate', 'government'), windowFocusMiddleware.validateTestIntegrity, validationMiddleware.validateAttemptId, validationMiddleware.validateTestSubmission, practiceTestController.submitPracticeTest);
router.get('/attempts', protect, authorize('student', 'corporate', 'government'), validationMiddleware.validatePagination, practiceTestController.getUserTestAttempts);
router.delete('/attempt/:attemptId', protect, validationMiddleware.validateAttemptId, practiceTestController.deleteAttempt);

// Handle invalid attempt routes
router.get('/attempt', (req, res) => {
  res.status(400).json({
    status: 'fail',
    message: 'Test attempt ID is required'
  });
});
// PDF download: allow cookie, header, or query token auth to support new-tab flow
router.get('/attempt/:testAttemptId/pdf', pdfDownloadRateLimit, protectWithQueryToken, verifyOriginForDownloads, authorize('student', 'corporate', 'government', 'admin'), practiceTestController.downloadAttemptPDF);

module.exports = router; 