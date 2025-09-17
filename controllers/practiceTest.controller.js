const { PracticeTest, TestAttempt, UserTestCooldown, User, Course, sequelize } = require('../models');
const { Op } = require('sequelize');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { validationResult } = require('express-validator');

// Helper function to calculate score
const calculateScore = (answers, questionsAsked) => {
  let correctAnswers = 0;
  let totalQuestions = questionsAsked.length;

  questionsAsked.forEach((question, index) => {
    const userAnswer = answers[index];
    const correctAnswer = question.correctAnswer;

    if (userAnswer === correctAnswer) {
      correctAnswers++;
    }
  });

  const percentage = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
  return {
    correctAnswers,
    wrongAnswers: totalQuestions - correctAnswers,
    score: percentage,
    obtainedMarks: correctAnswers
  };
};

// Helper function to get random questions
const getRandomQuestions = (questions, count) => {
  const shuffled = [...questions].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

// Admin routes
exports.createPracticeTest = catchAsync(async (req, res, next) => {
  const {
    title,
    description,
    category,
    questions,
    totalQuestions,
    questionsPerTest,
    duration,
    passingScore,
    isActive,
    allowRepeat,
    repeatAfterHours,
    enableCooldown,
    showInPublic,
    targetUserType,
    courseId
  } = req.body;

  if (!title || !category || !questions || !duration || !targetUserType) {
    return next(new AppError('Missing required fields', 400));
  }

  if (!['student', 'corporate', 'government'].includes(targetUserType)) {
    return next(new AppError('Invalid targetUserType', 400));
  }

  const practiceTest = await PracticeTest.create({
    title,
    description,
    category,
    questions,
    totalQuestions: totalQuestions || questions.length,
    questionsPerTest: questionsPerTest || 10,
    duration,
    passingScore: passingScore || 70,
    isActive: isActive !== undefined ? isActive : true,
    allowRepeat: allowRepeat !== undefined ? allowRepeat : false,
    repeatAfterHours: repeatAfterHours || 24,
    enableCooldown: enableCooldown !== undefined ? enableCooldown : true,
    showInPublic: showInPublic !== undefined ? showInPublic : false,
    targetUserType,
    courseId,
    createdBy: req.user.id
  });

  res.status(201).json({
    status: 'success',
    data: practiceTest
  });
});

exports.getAllPracticeTests = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10, category, targetUserType, isActive } = req.query;
  const offset = (page - 1) * limit;

  const whereClause = {};
  if (category) whereClause.category = category;
  if (targetUserType) whereClause.targetUserType = targetUserType;
  if (isActive !== undefined) whereClause.isActive = isActive === 'true';

  const practiceTests = await PracticeTest.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: Course,
        as: 'course',
        attributes: ['id', 'title']
      },
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'firstName', 'lastName', 'email']
      }
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']]
  });

  res.json({
    status: 'success',
    data: {
      practiceTests: practiceTests.rows,
      pagination: {
        total: practiceTests.count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(practiceTests.count / limit)
      }
    }
  });
});

exports.getPracticeTestById = catchAsync(async (req, res, next) => {
  const { testId } = req.params;

  const practiceTest = await PracticeTest.findByPk(testId, {
    include: [
      {
        model: Course,
        as: 'course',
        attributes: ['id', 'title']
      },
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'firstName', 'lastName', 'email']
      }
    ]
  });

  if (!practiceTest) {
    return next(new AppError('Practice test not found', 404));
  }

  res.json({
    status: 'success',
    data: practiceTest
  });
});

exports.getTestStatistics = catchAsync(async (req, res, next) => {
  const { testId } = req.params;

  const practiceTest = await PracticeTest.findByPk(testId);
  if (!practiceTest) {
    return next(new AppError('Practice test not found', 404));
  }

  const totalAttempts = await TestAttempt.count({
    where: { practiceTestId: testId }
  });

  const completedAttempts = await TestAttempt.count({
    where: { 
      practiceTestId: testId,
      status: 'completed'
    }
  });

  const passedAttempts = await TestAttempt.count({
    where: { 
      practiceTestId: testId,
      passed: true
    }
  });

  const avgScore = await TestAttempt.findOne({
    where: { 
      practiceTestId: testId,
      status: 'completed'
    },
    attributes: [
      [sequelize.fn('AVG', sequelize.col('score')), 'avgScore']
    ],
    raw: true
  });

  res.json({
    status: 'success',
    data: {
      totalAttempts,
      completedAttempts,
      passedAttempts,
      averageScore: avgScore ? Math.round(avgScore.avgScore) : 0,
      passRate: completedAttempts > 0 ? Math.round((passedAttempts / completedAttempts) * 100) : 0
    }
  });
});

exports.updatePracticeTest = catchAsync(async (req, res, next) => {
  const { testId } = req.params;
  const updateData = req.body;

  const practiceTest = await PracticeTest.findByPk(testId);
  if (!practiceTest) {
    return next(new AppError('Practice test not found', 404));
  }

  await practiceTest.update(updateData);

  res.json({
    status: 'success',
    data: practiceTest
  });
});

exports.deletePracticeTest = catchAsync(async (req, res, next) => {
  const { testId } = req.params;

  const practiceTest = await PracticeTest.findByPk(testId);
  if (!practiceTest) {
    return next(new AppError('Practice test not found', 404));
  }

  await practiceTest.destroy();

  res.json({
    status: 'success',
    message: 'Practice test deleted successfully'
  });
});

exports.resetQuestionUsage = catchAsync(async (req, res, next) => {
  const { testId } = req.params;

  const practiceTest = await PracticeTest.findByPk(testId);
  if (!practiceTest) {
    return next(new AppError('Practice test not found', 404));
  }

  // Reset any question usage tracking if implemented
  res.json({
    status: 'success',
    message: 'Question usage reset successfully'
  });
});

exports.resetUserTestCooldown = catchAsync(async (req, res, next) => {
  const { userId, testId } = req.params;

  await UserTestCooldown.destroy({
    where: { userId, testId }
  });

  res.json({
    status: 'success',
    message: 'User test cooldown reset successfully'
  });
});

exports.setUserCooldown = catchAsync(async (req, res, next) => {
  const { userId, testId } = req.params;
  const { cooldownHours } = req.body;

  await UserTestCooldown.upsert({
    userId: parseInt(userId),
    testId: parseInt(testId),
    cooldownHours: cooldownHours || 24,
    setBy: req.user.id,
    isActive: true
  });

  res.json({
    status: 'success',
    message: 'User cooldown set successfully'
  });
});

exports.getTestUsers = catchAsync(async (req, res, next) => {
  const { testId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  const users = await TestAttempt.findAndCountAll({
    where: { practiceTestId: testId },
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'firstName', 'lastName', 'email']
      }
    ],
    attributes: ['userId', 'score', 'passed', 'status', 'createdAt'],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']],
    distinct: true
  });

  res.json({
    status: 'success',
    data: users.rows,
    pagination: {
      total: users.count,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(users.count / limit)
    }
  });
});

exports.updateTestSettings = catchAsync(async (req, res, next) => {
  const { testId } = req.params;
  const settings = req.body;

  const practiceTest = await PracticeTest.findByPk(testId);
  if (!practiceTest) {
    return next(new AppError('Practice test not found', 404));
  }

  await practiceTest.update(settings);

  res.json({
    status: 'success',
    data: practiceTest
  });
});

exports.updateTestQuestion = catchAsync(async (req, res, next) => {
  const { testId, questionIndex } = req.params;
  const questionData = req.body;

  const practiceTest = await PracticeTest.findByPk(testId);
  if (!practiceTest) {
    return next(new AppError('Practice test not found', 404));
  }

  const questions = [...practiceTest.questions];
  const index = parseInt(questionIndex);

  if (index < 0 || index >= questions.length) {
    return next(new AppError('Invalid question index', 400));
  }

  questions[index] = { ...questions[index], ...questionData };
  await practiceTest.update({ questions });

  res.json({
    status: 'success',
    data: practiceTest
  });
});

exports.updateTestActiveStatus = catchAsync(async (req, res, next) => {
  const { testId } = req.params;
  const { isActive } = req.body;

  const practiceTest = await PracticeTest.findByPk(testId);
  if (!practiceTest) {
    return next(new AppError('Practice test not found', 404));
  }

  await practiceTest.update({ isActive });

  res.json({
    status: 'success',
    data: practiceTest
  });
});

// JSON import routes
exports.importQuestionsFromJSON = catchAsync(async (req, res, next) => {
  const { questions, testData } = req.body;

  if (!questions || !Array.isArray(questions)) {
    return next(new AppError('Invalid questions data', 400));
  }

  const practiceTest = await PracticeTest.create({
    title: testData.title || 'Imported Test',
    description: testData.description || '',
    category: testData.category || 'General',
    questions,
    totalQuestions: questions.length,
    questionsPerTest: testData.questionsPerTest || 10,
    duration: testData.duration || 60,
    passingScore: testData.passingScore || 70,
    targetUserType: testData.targetUserType || 'student',
    createdBy: req.user.id
  });

  res.status(201).json({
    status: 'success',
    data: practiceTest
  });
});

exports.updateTestWithJSON = catchAsync(async (req, res, next) => {
  const { testId } = req.params;
  const { questions, testData } = req.body;

  const practiceTest = await PracticeTest.findByPk(testId);
  if (!practiceTest) {
    return next(new AppError('Practice test not found', 404));
  }

  const updateData = { questions };
  if (testData) {
    Object.assign(updateData, testData);
  }

  await practiceTest.update(updateData);

  res.json({
    status: 'success',
    data: practiceTest
  });
});

// Excel import routes
exports.importQuestionsFromExcel = catchAsync(async (req, res, next) => {
  // This would need Excel parsing logic
  res.status(501).json({
    status: 'error',
    message: 'Excel import not implemented yet'
  });
});

exports.updateTestWithExcel = catchAsync(async (req, res, next) => {
  // This would need Excel parsing logic
  res.status(501).json({
    status: 'error',
    message: 'Excel update not implemented yet'
  });
});

exports.parseExcelPreview = catchAsync(async (req, res, next) => {
  // This would need Excel parsing logic
  res.status(501).json({
    status: 'error',
    message: 'Excel preview not implemented yet'
  });
});

exports.bulkUpdateTestSettings = catchAsync(async (req, res, next) => {
  const { testIds, settings } = req.body;

  if (!testIds || !Array.isArray(testIds)) {
    return next(new AppError('Invalid test IDs', 400));
  }

  await PracticeTest.update(settings, {
    where: { id: { [Op.in]: testIds } }
  });

  res.json({
    status: 'success',
    message: 'Bulk update completed successfully'
  });
});

// Student/Corporate/Government routes
exports.getAvailablePracticeTests = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10, category } = req.query;
  const offset = (page - 1) * limit;

  const whereClause = {
    isActive: true,
    targetUserType: req.user.userType
  };

  if (category) whereClause.category = category;

  const practiceTests = await PracticeTest.findAndCountAll({
    where: whereClause,
    attributes: ['id', 'title', 'description', 'category', 'totalQuestions', 'questionsPerTest', 'duration', 'passingScore'],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']]
  });

  res.json({
    status: 'success',
    data: {
      practiceTests: practiceTests.rows,
      pagination: {
        total: practiceTests.count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(practiceTests.count / limit)
      }
    }
  });
});

exports.startPracticeTest = catchAsync(async (req, res, next) => {
  const { testId } = req.params;

  const practiceTest = await PracticeTest.findByPk(testId);
  if (!practiceTest) {
    return next(new AppError('Practice test not found', 404));
  }

  if (!practiceTest.isActive) {
    return next(new AppError('Practice test is not active', 400));
  }

  if (practiceTest.targetUserType !== req.user.userType) {
    return next(new AppError('You are not authorized to take this test', 403));
  }

  // Check cooldown if enabled
  if (practiceTest.enableCooldown) {
    const cooldown = await UserTestCooldown.findOne({
      where: { userId: req.user.id, testId, isActive: true }
    });

    if (cooldown) {
      const hoursSinceSet = (new Date() - cooldown.setAt) / (1000 * 60 * 60);
      if (hoursSinceSet < cooldown.cooldownHours) {
        return next(new AppError(`You must wait ${cooldown.cooldownHours - Math.floor(hoursSinceSet)} more hours before retaking this test`, 429));
      }
    }
  }

  // Check if user has already taken the test and repeat is not allowed
  if (!practiceTest.allowRepeat) {
    const existingAttempt = await TestAttempt.findOne({
      where: { 
        userId: req.user.id, 
        practiceTestId: testId,
        status: { [Op.in]: ['completed', 'timeout'] }
      }
    });

    if (existingAttempt) {
      return next(new AppError('You have already completed this test', 400));
    }
  }

  // Get random questions
  const questionsToAsk = getRandomQuestions(practiceTest.questions, practiceTest.questionsPerTest);

  // Create test attempt
  const testAttempt = await TestAttempt.create({
    userId: req.user.id,
    practiceTestId: testId,
    testTitle: practiceTest.title,
    questionsAsked: questionsToAsk,
    answers: [],
    totalQuestions: questionsToAsk.length,
    maxTime: practiceTest.duration * 60, // Convert minutes to seconds
    startedAt: new Date(),
    status: 'in_progress',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.json({
    status: 'success',
    data: {
      testAttemptId: testAttempt.id,
      testTitle: practiceTest.title,
      questions: questionsToAsk.map(q => ({
        question: q.question,
        options: q.options,
        questionIndex: questionsToAsk.indexOf(q)
      })),
      duration: practiceTest.duration,
      totalQuestions: questionsToAsk.length
    }
  });
});

exports.getAttemptDetails = catchAsync(async (req, res, next) => {
  const { testAttemptId } = req.params;

  const testAttempt = await TestAttempt.findByPk(testAttemptId, {
    include: [
      {
        model: PracticeTest,
        as: 'practiceTest',
        attributes: ['title', 'duration', 'passingScore']
      }
    ]
  });

  if (!testAttempt) {
    return next(new AppError('Test attempt not found', 404));
  }

  // Check if user owns this attempt
  if (testAttempt.userId !== req.user.id && !['admin', 'owner'].includes(req.user.userType)) {
    return next(new AppError('You are not authorized to view this attempt', 403));
  }

  res.json({
    status: 'success',
    data: testAttempt
  });
});

exports.submitPracticeTest = catchAsync(async (req, res, next) => {
  const { testAttemptId } = req.params;
  const { answers } = req.body;

  const testAttempt = await TestAttempt.findByPk(testAttemptId, {
    include: [
      {
        model: PracticeTest,
        as: 'practiceTest'
      }
    ]
  });

  if (!testAttempt) {
    return next(new AppError('Test attempt not found', 404));
  }

  if (testAttempt.userId !== req.user.id) {
    return next(new AppError('You are not authorized to submit this attempt', 403));
  }

  if (testAttempt.status !== 'in_progress') {
    return next(new AppError('Test attempt is not in progress', 400));
  }

  // Calculate score
  const scoreData = calculateScore(answers, testAttempt.questionsAsked);
  const passed = scoreData.score >= testAttempt.practiceTest.passingScore;

  // Update test attempt
  await testAttempt.update({
    answers,
    score: scoreData.score,
    obtainedMarks: scoreData.obtainedMarks,
    correctAnswers: scoreData.correctAnswers,
    wrongAnswers: scoreData.wrongAnswers,
    timeTaken: Math.floor((new Date() - testAttempt.startedAt) / 1000),
    completedAt: new Date(),
    status: 'completed',
    passed
  });

  // Set cooldown if enabled
  if (testAttempt.practiceTest.enableCooldown) {
    await UserTestCooldown.upsert({
      userId: req.user.id,
      testId: testAttempt.practiceTestId,
      cooldownHours: testAttempt.practiceTest.repeatAfterHours,
      setBy: req.user.id,
      isActive: true
    });
  }

  res.json({
    status: 'success',
    data: {
      score: scoreData.score,
      correctAnswers: scoreData.correctAnswers,
      wrongAnswers: scoreData.wrongAnswers,
      passed,
      timeTaken: Math.floor((new Date() - testAttempt.startedAt) / 1000)
    }
  });
});

exports.getUserTestAttempts = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10, testId } = req.query;
  const offset = (page - 1) * limit;

  const whereClause = { userId: req.user.id };
  if (testId) whereClause.practiceTestId = testId;

  const attempts = await TestAttempt.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: PracticeTest,
        as: 'practiceTest',
        attributes: ['title', 'category']
      }
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']]
  });

  res.json({
    status: 'success',
    data: attempts.rows,
    pagination: {
      total: attempts.count,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(attempts.count / limit)
    }
  });
});

exports.deleteAttempt = catchAsync(async (req, res, next) => {
  const { attemptId } = req.params;

  const attempt = await TestAttempt.findByPk(attemptId);
  if (!attempt) {
    return next(new AppError('Test attempt not found', 404));
  }

  if (attempt.userId !== req.user.id && !['admin', 'owner'].includes(req.user.userType)) {
    return next(new AppError('You are not authorized to delete this attempt', 403));
  }

  await attempt.destroy();

  res.json({
    status: 'success',
    message: 'Test attempt deleted successfully'
  });
});

exports.downloadAttemptPDF = catchAsync(async (req, res, next) => {
  const { testAttemptId } = req.params;

  const testAttempt = await TestAttempt.findByPk(testAttemptId, {
    include: [
      {
        model: PracticeTest,
        as: 'practiceTest'
      }
    ]
  });

  if (!testAttempt) {
    return next(new AppError('Test attempt not found', 404));
  }

  // Check authorization
  if (testAttempt.userId !== req.user.id && !['admin', 'owner'].includes(req.user.userType)) {
    return next(new AppError('You are not authorized to download this PDF', 403));
  }

  // For now, return a simple response. PDF generation would need additional libraries
  res.json({
    status: 'success',
    message: 'PDF download functionality needs to be implemented with PDF generation library',
    data: {
      testTitle: testAttempt.testTitle,
      score: testAttempt.score,
      passed: testAttempt.passed,
      completedAt: testAttempt.completedAt
    }
  });
});
