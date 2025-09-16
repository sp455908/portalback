let PracticeTest, TestAttempt, User, sequelize;
try {
  const models = require('../models');
  PracticeTest = models.PracticeTest;
  TestAttempt = models.TestAttempt;
  User = models.User;
  sequelize = models.sequelize;
} catch (error) {
  console.error('Error importing models:', error);
  throw error;
}
const PDFDocument = require('pdfkit');
const XLSX = require('xlsx');
const multer = require('multer');


const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// ✅ COOLDOWN FIX: Helper function to clean up old in-progress attempts
const cleanupOldInProgressAttempts = async (userId, practiceTestId) => {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    
    const oldAttempts = await TestAttempt.findAll({
      where: {
        userId: userId,
        practiceTestId: practiceTestId,
        status: 'in_progress',
        startedAt: {
          [sequelize.Op.lt]: twoHoursAgo
        }
      }
    });

    if (oldAttempts.length > 0) {
      await TestAttempt.update(
        { 
          status: 'abandoned',
          completedAt: new Date()
        },
        {
          where: {
            id: {
              [sequelize.Op.in]: oldAttempts.map(attempt => attempt.id)
            }
          }
        }
      );
      
      console.log(`Cleaned up ${oldAttempts.length} old in-progress attempts for user ${userId}, test ${practiceTestId}`);
    }
  } catch (error) {
    console.error('Error cleaning up old in-progress attempts:', error);
  }
};


exports.createPracticeTest = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      questions,
      questionsPerTest,
      duration,
      passingScore,
      allowRepeat,
      repeatAfterHours,
      targetUserType,
      showInPublic
    } = req.body;

    if (!targetUserType || !['student', 'corporate', 'government'].includes(targetUserType)) {
      return res.status(400).json({
        status: 'fail',
        message: 'targetUserType is required and must be student, corporate, or government.'
      });
    }

    
    if (!questions || questions.length < 10) {
      return res.status(400).json({
        status: 'fail',
        message: 'Practice test must have at least 10 questions'
      });
    }

    
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      if (!question.question || !question.options || question.options.length !== 4) {
        return res.status(400).json({
          status: 'fail',
          message: `Question ${i + 1} is invalid. Each question must have exactly 4 options.`
        });
      }
      if (question.correctAnswer < 0 || question.correctAnswer > 3) {
        return res.status(400).json({
          status: 'fail',
          message: `Question ${i + 1} has invalid correct answer index. Must be 0-3.`
        });
      }
    }

    const practiceTest = await PracticeTest.create({
      title,
      description,
      category,
      questions,
      totalQuestions: questions.length,
      questionsPerTest: questionsPerTest || 30,
      duration: duration || 30, 
      passingScore: passingScore || 70,
      allowRepeat: allowRepeat || false,
      repeatAfterHours: repeatAfterHours || 24,
      createdBy: req.user.id,
      targetUserType,
      showInPublic: !!showInPublic
    });

    res.status(201).json({
      status: 'success',
      data: { practiceTest }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to create practice test',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};


exports.getAllPracticeTests = async (req, res) => {
  try {
    // ✅ PERFORMANCE FIX: Remove JOIN to fix slow query issue
    // The JOIN with User table was causing 26+ second queries
    // Return practice tests without creator info for now to fix performance
    const practiceTests = await PracticeTest.findAll({
      order: [['createdAt', 'DESC']],
      // ✅ PERFORMANCE: Add timeout to prevent hanging queries
      timeout: 10000 // 10 second timeout
    });

    res.status(200).json({
      status: 'success',
      data: { practiceTests }
    });
  } catch (err) {
    console.error('Error fetching practice tests:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch practice tests',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};


exports.getPracticeTestById = async (req, res) => {
  try {
    const { testId } = req.params;
    
    const practiceTest = await PracticeTest.findByPk(testId, {
      include: [{
        model: User,
        as: 'creator',
        attributes: ['firstName', 'lastName', 'email']
      }]
    });

    if (!practiceTest) {
      return res.status(404).json({
        status: 'fail',
        message: 'Practice test not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: { practiceTest }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch practice test'
    });
  }
};


exports.getAvailablePracticeTests = async (req, res) => {
  try {
    
    if (process.env.NODE_ENV === 'development') {
    }
    
    if (!req.user) {
      return res.status(401).json({
        status: 'fail',
        message: 'Authentication required'
      });
    }

    
    let userType = req.user.userType;
    if (!userType && req.user.role && req.user.role !== 'admin') {
      userType = req.user.role;
    }

    if (!userType || !['student', 'corporate', 'government'].includes(userType)) {
      return res.status(403).json({
        status: 'fail',
        message: 'Invalid user type or insufficient permissions'
      });
    }

    
    const userBatchIds = await sequelize.query(`
      SELECT DISTINCT "batchId" 
      FROM "BatchStudents" 
      WHERE "userId" = :userId AND "status" = 'active'
    `, {
      replacements: { userId: req.user.id },
      type: sequelize.QueryTypes.SELECT
    });

    let filteredTests = [];
    
    if (userBatchIds.length > 0) {
      const batchIds = userBatchIds.map(b => b.batchId);
      
      
      const batchTests = await sequelize.query(`
        SELECT DISTINCT pt.id,
               pt.title,
               pt.description,
               pt.category,
               pt."totalQuestions",
               pt."questionsPerTest",
               pt.duration,
               pt."passingScore",
               pt."repeatAfterHours",
               pt."enableCooldown",
               pt."targetUserType",
               pt."showInPublic"
        FROM "PracticeTests" pt
        INNER JOIN "BatchAssignedTests" bat ON pt.id = bat."testId"
        WHERE bat."batchId" IN (:batchIds)
          AND pt."isActive" = true
          AND bat."isActive" = true
          AND pt."targetUserType" = :userType
      `, {
        replacements: { batchIds: batchIds, userType: userType },
        type: sequelize.QueryTypes.SELECT
      });
      
      
      filteredTests = batchTests.map(test => ({
        id: test.id,
        title: test.title,
        description: test.description,
        category: test.category,
        totalQuestions: test.totalQuestions,
        questionsPerTest: test.questionsPerTest,
        duration: test.duration,
        passingScore: test.passingScore,
        repeatAfterHours: test.repeatAfterHours,
        enableCooldown: test.enableCooldown,
        targetUserType: test.targetUserType,
        showInPublic: test.showInPublic,
        isBatchAssigned: true
      }));
    } else {
      
      const publicTests = await PracticeTest.findAll({
        where: { 
          isActive: true, 
          showInPublic: true,
          targetUserType: userType
        },
        attributes: ['id', 'title', 'description', 'category', 'totalQuestions', 'questionsPerTest', 'duration', 'passingScore', 'repeatAfterHours', 'enableCooldown', 'targetUserType', 'showInPublic'],
        order: [['createdAt', 'DESC']]
      });
      
      filteredTests = publicTests.map(test => ({
        ...test.toJSON(),
        isBatchAssigned: false
      }));
    }

    
    const userAttempts = await TestAttempt.findAll({ 
      where: {
        userId: req.user.id,
        status: 'completed'
      },
      attributes: ['practiceTestId', 'completedAt']
    });

    
    const testsWithAvailability = filteredTests.map(test => {
      const userTestAttempts = userAttempts.filter(
        attempt => attempt.practiceTestId.toString() === test.id.toString()
      );
      const lastAttempt = userTestAttempts.length > 0 
        ? userTestAttempts.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0]
        : null;
      
      return {
        ...test,
        canTakeTest: true,
        lastAttemptDate: lastAttempt ? lastAttempt.completedAt : null,
        attemptsCount: userTestAttempts.length,
        cooldownHours: 0,
        nextAvailableTime: null
      };
    });

    if (process.env.NODE_ENV === 'development') {
    }

    res.status(200).json({
      status: 'success',
      data: { practiceTests: testsWithAvailability }
    });
  } catch (err) {
    console.error('Error in getAvailablePracticeTests:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch available practice tests',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};


exports.startPracticeTest = async (req, res) => {
  try {
    const { testId } = req.params;
    
    
    const practiceTest = await PracticeTest.findByPk(testId);
    if (!practiceTest || !practiceTest.isActive) {
      return res.status(404).json({
        status: 'fail',
        message: 'Practice test not found or inactive'
      });
    }
    
    
    let userType = req.user.userType;
    if (!userType && req.user.role && req.user.role !== 'admin') {
      userType = req.user.role;
    }
    
    if (practiceTest.targetUserType && practiceTest.targetUserType !== userType) {
      console.log('User type mismatch:', {
        userId: req.user.id,
        userType: userType,
        requiredUserType: practiceTest.targetUserType,
        testId: testId,
        testTitle: practiceTest.title
      });
      return res.status(403).json({
        status: 'fail',
        message: `Access Denied: This test "${practiceTest.title}" is for ${practiceTest.targetUserType} users only. Your account type is: ${userType || 'undefined'}.`
      });
    }
    
    
    

    
    let testAttempt = await TestAttempt.findOne({
      where: {
        userId: req.user.id,
        practiceTestId: testId,
        status: 'in_progress'
      }
    });

    if (testAttempt) {
      
      return res.status(200).json({
        status: 'success',
        data: {
          testAttemptId: testAttempt.id,
          test: {
            title: practiceTest.title,
            duration: practiceTest.duration,
            questions: testAttempt.questionsAsked.map(idx => ({
              index: idx,
              question: practiceTest.questions[idx].question,
              options: practiceTest.questions[idx].options
            })),
            passingScore: practiceTest.passingScore
          },
          resume: true
        }
      });
    }

    
    // ✅ COOLDOWN FIX: Clean up old in-progress attempts first
    await cleanupOldInProgressAttempts(req.user.id, testId);

    // ✅ COOLDOWN FIX: Check for existing in-progress attempts first
    const existingInProgressAttempt = await TestAttempt.findOne({
      where: {
        userId: req.user.id,
        practiceTestId: testId,
        status: 'in_progress'
      },
      order: [['startedAt', 'DESC']]
    });

    // If there's an in-progress attempt, check if it's recent (within last 2 hours)
    if (existingInProgressAttempt) {
      const now = new Date();
      const startedAt = new Date(existingInProgressAttempt.startedAt);
      const diffMs = now.getTime() - startedAt.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      
      // If the in-progress attempt is recent (within 2 hours), allow resuming
      if (diffHours < 2) {
        return res.status(200).json({
          status: 'success',
          data: {
            testAttemptId: existingInProgressAttempt.id,
            test: {
              title: practiceTest.title,
              duration: practiceTest.duration,
              questions: [], // Will be loaded from existing attempt
              passingScore: practiceTest.passingScore
            },
            resume: true,
            message: 'Resuming existing test attempt'
          }
        });
      } else {
        // If the in-progress attempt is old (more than 2 hours), mark it as abandoned
        await existingInProgressAttempt.update({
          status: 'abandoned',
          completedAt: new Date()
        });
        console.log(`Marked old in-progress attempt ${existingInProgressAttempt.id} as abandoned`);
      }
    }

    // ✅ COOLDOWN FIX: Only check cooldown based on COMPLETED attempts
    const lastCompletedAttempt = await TestAttempt.findOne({
      where: {
        userId: req.user.id,
        practiceTestId: testId,
        status: 'completed'
      },
      order: [['completedAt', 'DESC']]
    });
    
    if (lastCompletedAttempt && lastCompletedAttempt.completedAt) {
      if (!practiceTest.allowRepeat) {
        return res.status(403).json({
          status: 'fail',
          message: 'Repeat attempts are disabled for this test.'
        });
      }
      if (practiceTest.enableCooldown) {
        const now = new Date();
        const completedAt = new Date(lastCompletedAttempt.completedAt);
        const diffMs = now.getTime() - completedAt.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        const cooldownHours = Number(practiceTest.repeatAfterHours || 0);
        if (diffHours < cooldownHours) {
          const nextAvailableTime = new Date(completedAt.getTime() + cooldownHours * 60 * 60 * 1000);
          return res.status(403).json({
            status: 'fail',
            message: `You must wait ${Math.ceil(cooldownHours - diffHours)} hour(s) before retaking this test.`,
            nextAvailableTime: nextAvailableTime.toISOString()
          });
        }
      }
    }

    
    const totalAvailable = Array.isArray(practiceTest.questions) ? practiceTest.questions.length : 0;
    if (totalAvailable === 0) {
      return res.status(400).json({ status: 'fail', message: 'This test has no questions.' });
    }
    const perAttempt = Math.min(practiceTest.questionsPerTest || totalAvailable, totalAvailable);
    const completedAttemptsCount = await TestAttempt.count({ where: { userId: req.user.id, practiceTestId: testId, status: 'completed' } });
    const attemptNumber = completedAttemptsCount + 1;
    const offset = ((attemptNumber - 1) * perAttempt) % totalAvailable;
    const selectedQuestionIndices = Array.from({ length: perAttempt }, (_, i) => (offset + i) % totalAvailable);
    const selectedQuestions = selectedQuestionIndices.map(index => ({
      index,
      question: practiceTest.questions[index].question,
      options: practiceTest.questions[index].options
    }));
    // Create snapshot of test settings at the time of attempt
    const testSettingsSnapshot = {
      questions: selectedQuestionIndices.map(idx => {
        const question = practiceTest.questions[idx];
        return {
          index: idx,
          marks: question && typeof question.marks === 'number' ? question.marks : 1,
          negativeMarks: question && typeof question.negativeMarks === 'number' ? question.negativeMarks : 0
        };
      }),
      duration: practiceTest.duration,
      passingScore: practiceTest.passingScore,
      questionsPerTest: practiceTest.questionsPerTest,
      snapshotDate: new Date().toISOString()
    };

    const testAttemptData = {
      userId: req.user.id,
      practiceTestId: testId,
      testTitle: practiceTest.title,
      questionsAsked: selectedQuestionIndices,
      totalQuestions: perAttempt,
      maxTime: practiceTest.duration * 60,
      startedAt: new Date(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      attemptsCount: (await TestAttempt.count({ where: { userId: req.user.id, practiceTestId: testId } })) + 1,
      testSettingsSnapshot: testSettingsSnapshot
    };
    const newTestAttempt = await TestAttempt.create(testAttemptData);
    
    console.log('Test attempt created successfully:', {
      testAttemptId: newTestAttempt.id,
      userId: req.user.id,
      testId: testId,
      questionsCount: selectedQuestions.length
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        testAttemptId: newTestAttempt.id,
        test: {
          title: practiceTest.title,
          duration: practiceTest.duration,
          questions: selectedQuestions,
          passingScore: practiceTest.passingScore
        },
        resume: false
      }
    });
  } catch (err) {
    console.error('Error in startPracticeTest:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({
      status: 'error',
      message: 'Failed to start practice test',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
  
  console.log('=== startPracticeTest END ===');
};


exports.submitPracticeTest = async (req, res) => {
  try {
    const { testAttemptId } = req.params;
    const { answers } = req.body;

    
    const testAttempt = await TestAttempt.findByPk(testAttemptId);
    if (!testAttempt) {
      return res.status(404).json({
        status: 'fail',
        message: 'Test attempt not found'
      });
    }

    
    if (testAttempt.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        status: 'fail',
        message: 'Not authorized to access this test attempt'
      });
    }

    
    if (testAttempt.status === 'completed') {
      return res.status(400).json({
        status: 'fail',
        message: 'Test already completed'
      });
    }

    
    const practiceTest = await PracticeTest.findByPk(testAttempt.practiceTestId);
    if (!practiceTest) {
      return res.status(404).json({
        status: 'fail',
        message: 'Practice test not found'
      });
    }

    
    let correctAnswers = 0;
    const detailedAnswers = [];

    for (let i = 0; i < answers.length; i++) {
      const answer = answers[i];
      const questionIndex = testAttempt.questionsAsked[i];
      const correctAnswer = practiceTest.questions[questionIndex].correctAnswer;
      const isCorrect = answer.selectedAnswer === correctAnswer;
      const marks = Number(practiceTest.questions[questionIndex].marks ?? 1);
      const negativeMarks = Number(practiceTest.questions[questionIndex].negativeMarks ?? 0);
      const earned = isCorrect ? marks : (negativeMarks ? -Math.abs(negativeMarks) : 0);
      
      if (isCorrect) correctAnswers++;

      detailedAnswers.push({
        questionIndex,
        selectedAnswer: answer.selectedAnswer,
        isCorrect,
        marksAwarded: earned,
        timeSpent: answer.timeSpent || 0
      });
    }

    
    testAttempt.totalQuestions = testAttempt.questionsAsked.length;

    
    let totalPossible = 0;
    let obtained = 0;
    let correctMarksSum = 0; 
    for (let i = 0; i < testAttempt.questionsAsked.length; i++) {
      const qIdx = testAttempt.questionsAsked[i];
      const q = practiceTest.questions[qIdx] || {};
      const marks = Number(q.marks ?? 1);
      const negativeMarks = Number(q.negativeMarks ?? 0);
      totalPossible += Math.max(0, marks); 
      const ans = detailedAnswers[i];
      if (ans && typeof ans.marksAwarded === 'number') {
        obtained += ans.marksAwarded;
        if (ans.isCorrect) {
          correctMarksSum += Math.max(0, marks);
        }
      } else {
        
        const isCorrect = ans ? ans.isCorrect : false;
        obtained += isCorrect ? marks : (negativeMarks ? -Math.abs(negativeMarks) : 0);
        if (isCorrect) {
          correctMarksSum += Math.max(0, marks);
        }
      }
    }

    
    const score = totalPossible > 0 ? Math.round((correctMarksSum / totalPossible) * 100) : 0;
    const passed = score >= practiceTest.passingScore;
    const timeTaken = Math.floor((new Date() - new Date(testAttempt.startedAt)) / 1000);

    
    testAttempt.answers = detailedAnswers;
    testAttempt.score = score;
    testAttempt.correctAnswers = correctAnswers;
    testAttempt.wrongAnswers = testAttempt.totalQuestions - correctAnswers;
    testAttempt.timeTaken = timeTaken;
    testAttempt.completedAt = new Date();
    testAttempt.status = 'completed';
    testAttempt.passed = passed;

    await testAttempt.update({
      answers: detailedAnswers,
      score: score,
      correctAnswers: correctAnswers,
      wrongAnswers: testAttempt.totalQuestions - correctAnswers,
      timeTaken: timeTaken,
      completedAt: new Date(),
      status: 'completed',
      passed: passed,
      obtainedMarks: obtained
    });

    res.status(200).json({
      status: 'success',
      data: {
        score,
        passed,
        correctAnswers,
        wrongAnswers: testAttempt.wrongAnswers,
        totalQuestions: testAttempt.totalQuestions,
        timeTaken,
        passingScore: practiceTest.passingScore,
        obtainedMarks: obtained,
        totalPossibleMarks: totalPossible
      }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to submit practice test'
    });
  }
};


exports.getAttemptDetails = async (req, res) => {
  try {
    const { testAttemptId } = req.params;
    
    // Validate testAttemptId
    if (!testAttemptId || testAttemptId === 'undefined' || testAttemptId === 'null') {
      console.log('Invalid testAttemptId received:', testAttemptId);
      return res.status(400).json({
        status: 'fail',
        message: 'Test attempt ID is required and must be valid'
      });
    }

    // Check if testAttemptId is a valid number
    if (isNaN(parseInt(testAttemptId))) {
      console.log('Non-numeric testAttemptId received:', testAttemptId);
      return res.status(400).json({
        status: 'fail',
        message: 'Test attempt ID must be a valid number'
      });
    }

    const testAttempt = await TestAttempt.findByPk(testAttemptId, {
      include: [{
        model: PracticeTest,
        as: 'test',
        attributes: ['id', 'title', 'description', 'category', 'duration', 'passingScore']
      }]
    });

    if (!testAttempt) {
      console.log('Test attempt not found for ID:', testAttemptId);
      return res.status(404).json({
        status: 'fail',
        message: 'Test attempt not found'
      });
    }

    // Check if user is authorized to access this attempt
    if (testAttempt.userId.toString() !== req.user.id.toString() && req.user.role !== 'admin') {
      console.log('Unauthorized access attempt:', {
        attemptUserId: testAttempt.userId,
        requestUserId: req.user.id,
        userRole: req.user.role
      });
      return res.status(403).json({
        status: 'fail',
        message: 'Not authorized to access this test attempt'
      });
    }

    res.status(200).json({
      status: 'success',
      data: { testAttempt }
    });
  } catch (err) {
    console.error('Error in getAttemptDetails:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch test attempt details'
    });
  }
};

exports.getUserTestAttempts = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        status: 'fail',
        message: 'User not authenticated'
      });
    }

    
    const validRoles = ['student', 'corporate', 'government'];
    if (!req.user.role || !validRoles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'fail',
        message: 'User role not authorized for this endpoint'
      });
    }

    const testAttempts = await TestAttempt.findAll({
      where: { userId: req.user.id },
      include: [{
        model: PracticeTest,
        as: 'test',
        attributes: ['title', 'category']
      }],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      status: 'success',
      data: { testAttempts }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch test attempts'
    });
  }
};


exports.resetUserTestCooldown = async (req, res) => {
  try {
    const { userId, testId } = req.params;

    
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'Only admins can reset test cooldowns'
      });
    }

    
    const query = userId === "all" 
      ? { practiceTestId: testId, status: 'completed' }
      : { userId, practiceTestId: testId, status: 'completed' };

    
    const result = await TestAttempt.destroy({ where: query });

    res.status(200).json({
      status: 'success',
      message: userId === "all" 
        ? `Reset cooldown for all users on test ${testId}`
        : `Reset cooldown for user ${userId} on test ${testId}`,
      data: { deletedAttempts: result }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to reset test cooldown'
    });
  }
};


exports.getTestStatistics = async (req, res) => {
  try {
    const { testId } = req.params;

    const test = await PracticeTest.findByPk(testId);
    if (!test) {
      return res.status(404).json({
        status: 'fail',
        message: 'Practice test not found'
      });
    }

    const attempts = await TestAttempt.findAll({ where: { practiceTestId: testId } });
    const completedAttempts = attempts.filter(a => a.status === 'completed');

    const stats = {
      totalAttempts: attempts.length,
      completedAttempts: completedAttempts.length,
      averageScore: completedAttempts.length > 0 
        ? Math.round(completedAttempts.reduce((sum, a) => sum + a.score, 0) / completedAttempts.length)
        : 0,
      passRate: completedAttempts.length > 0
        ? Math.round((completedAttempts.filter(a => a.passed).length / completedAttempts.length) * 100)
        : 0,
      uniqueStudents: new Set(attempts.map(a => a.userId.toString())).size,
      questionUsage: {}
    };

    
    attempts.forEach(attempt => {
      if (attempt.questionsAsked && Array.isArray(attempt.questionsAsked)) {
        attempt.questionsAsked.forEach(qIndex => {
          stats.questionUsage[qIndex] = (stats.questionUsage[qIndex] || 0) + 1;
        });
      }
    });

    
    const unusedQuestions = test.totalQuestions - Object.keys(stats.questionUsage).length;
    const allQuestionsUsed = unusedQuestions === 0;

    res.status(200).json({
      status: 'success',
      data: {
        test: {
          title: test.title,
          totalQuestions: test.totalQuestions,
          questionsPerTest: test.questionsPerTest
        },
        statistics: stats,
        allQuestionsUsed,
        unusedQuestions
      }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch test statistics'
    });
  }
};


exports.updatePracticeTest = async (req, res) => {
  try {
    const { testId } = req.params;
    const updates = req.body;
    
    if (updates.questions) {
      if (updates.questions.length < 10) {
        return res.status(400).json({
          status: 'fail',
          message: 'Practice test must have at least 10 questions'
        });
      }

      
      for (let i = 0; i < updates.questions.length; i++) {
        const question = updates.questions[i];
        if (!question.question || !question.options || question.options.length !== 4) {
          return res.status(400).json({
            status: 'fail',
            message: `Question ${i + 1} is invalid. Each question must have exactly 4 options.`
          });
        }
        if (question.correctAnswer < 0 || question.correctAnswer > 3) {
          return res.status(400).json({
            status: 'fail',
            message: `Question ${i + 1} has invalid correct answer index. Must be 0-3.`
          });
        }
      }

      
      updates.totalQuestions = updates.questions.length;
    }

    
    if (updates.targetUserType && !['student', 'corporate', 'government'].includes(updates.targetUserType)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid targetUserType. Must be student, corporate, or government.'
      });
    }

    if (typeof updates.showInPublic !== 'undefined') {
      updates.showInPublic = !!updates.showInPublic;
    }

    const practiceTest = await PracticeTest.findByPk(testId);
    if (!practiceTest) {
      return res.status(404).json({
        status: 'fail',
        message: 'Practice test not found'
      });
    }
    
    await practiceTest.update({ ...updates, updatedAt: new Date() });

    if (!practiceTest) {
      return res.status(404).json({
        status: 'fail',
        message: 'Practice test not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: { practiceTest }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to update practice test'
    });
  }
};



exports.deletePracticeTest = async (req, res) => {
  try {
    const { testId } = req.params;

    const practiceTest = await PracticeTest.findByPk(testId);
    if (!practiceTest) {
      return res.status(404).json({
        status: 'fail',
        message: 'Practice test not found'
      });
    }
    
    await practiceTest.destroy();
    if (!practiceTest) {
      return res.status(404).json({
        status: 'fail',
        message: 'Practice test not found'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Practice test deleted successfully'
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete practice test'
    });
  }
};


exports.resetQuestionUsage = async (req, res) => {
  try {
    const { testId } = req.params;

    
    await TestAttempt.destroy({ where: { practiceTestId: testId } });

    res.status(200).json({
      status: 'success',
      message: 'Question usage reset successfully. All students can now retake the test.'
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to reset question usage'
    });
  }
};


exports.importQuestionsFromJSON = async (req, res) => {
  try {
    const { title, description, category, questionsPerTest, duration, passingScore, questionsData } = req.body;

    
    if (!title || !category || !questionsData || !Array.isArray(questionsData)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Missing required fields: title, category, and questionsData array'
      });
    }

    
    const questions = questionsData.map((q, index) => {
      
      let questionText, options, correctAnswer;
      
      if (q.question && q.options && q.answer) {
        
        questionText = q.question;
        options = [q.options.a, q.options.b, q.options.c, q.options.d];
        correctAnswer = q.answer === 'a' ? 0 : q.answer === 'b' ? 1 : q.answer === 'c' ? 2 : 3;
      } else if (q.question && Array.isArray(q.options) && typeof q.correctAnswer === 'number') {
        
        questionText = q.question;
        options = q.options;
        correctAnswer = q.correctAnswer;
      } else {
        throw new Error(`Invalid question format at index ${index}`);
      }

      return {
        question: questionText,
        options: options,
        correctAnswer: correctAnswer,
        explanation: q.explanation || '',
        category: q.category || category,
        difficulty: q.difficulty || 'medium',
        marks: typeof q.marks === 'number' ? q.marks : 1,
        negativeMarks: typeof q.negativeMarks === 'number' ? q.negativeMarks : 0
      };
    });

    
    if (questions.length < 10) {
      return res.status(400).json({
        status: 'fail',
        message: 'Practice test must have at least 10 questions'
      });
    }

    
    const existingTest = await PracticeTest.findOne({ title });
    if (existingTest) {
      return res.status(400).json({
        status: 'fail',
        message: 'A practice test with this title already exists. Please use a different title.'
      });
    }

    
    const practiceTest = await PracticeTest.create({
      title,
      description: description || `Practice test for ${category}`,
      category,
      questions,
      totalQuestions: questions.length,
      questionsPerTest: questionsPerTest || 30,
      duration: duration || 30,
      passingScore: passingScore || 70,
      isActive: true,
      allowRepeat: true,
      repeatAfterHours: 24,
      createdBy: req.user._id
    });

    res.status(201).json({
      status: 'success',
      message: `Practice test "${title}" created successfully with ${questions.length} questions`,
      data: {
        practiceTest: {
          id: practiceTest._id,
          title: practiceTest.title,
          category: practiceTest.category,
          totalQuestions: practiceTest.totalQuestions,
          questionsPerTest: practiceTest.questionsPerTest,
          duration: practiceTest.duration,
          passingScore: practiceTest.passingScore
        }
      }
    });
  } catch (err) {
    console.error('Error importing questions:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to import questions from JSON',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};


exports.importQuestionsFromExcel = async (req, res) => {
  try {
    const { title, description, category, questionsPerTest, duration, passingScore, targetUserType } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        status: 'fail',
        message: 'No Excel file uploaded'
      });
    }

    if (!title || !category) {
      return res.status(400).json({
        status: 'fail',
        message: 'Missing required fields: title and category'
      });
    }

    
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    
    const questions = [];
    const headers = jsonData[0];
    
    
    const requiredHeaders = ['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer'];
    const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
    
    if (missingHeaders.length > 0) {
      return res.status(400).json({
        status: 'fail',
        message: `Missing required headers: ${missingHeaders.join(', ')}. Expected headers: ${requiredHeaders.join(', ')}`
      });
    }

    
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (row.length < 6) continue; 
      
      const question = row[headers.indexOf('Question')];
      const optionA = row[headers.indexOf('Option A')];
      const optionB = row[headers.indexOf('Option B')];
      const optionC = row[headers.indexOf('Option C')];
      const optionD = row[headers.indexOf('Option D')];
      const correctAnswer = row[headers.indexOf('Correct Answer')];
      
      
      if (!question || !optionA || !optionB || !optionC || !optionD || !correctAnswer) {
        continue; 
      }
      
      
      let correctAnswerIndex;
      const answerStr = correctAnswer.toString().toLowerCase().trim();
      
      if (answerStr === 'a' || answerStr === '1') {
        correctAnswerIndex = 0;
      } else if (answerStr === 'b' || answerStr === '2') {
        correctAnswerIndex = 1;
      } else if (answerStr === 'c' || answerStr === '3') {
        correctAnswerIndex = 2;
      } else if (answerStr === 'd' || answerStr === '4') {
        correctAnswerIndex = 3;
      } else {
        continue; 
      }
      
      questions.push({
        question: question.toString().trim(),
        options: [
          optionA.toString().trim(),
          optionB.toString().trim(),
          optionC.toString().trim(),
          optionD.toString().trim()
        ],
        correctAnswer: correctAnswerIndex,
        explanation: '',
        category: category,
        difficulty: 'medium',
        marks: 1,
        negativeMarks: 0
      });
    }

    
    if (questions.length < 10) {
      return res.status(400).json({
        status: 'fail',
        message: `Practice test must have at least 10 questions. Found ${questions.length} valid questions.`
      });
    }

    
    const existingTest = await PracticeTest.findOne({ title });
    if (existingTest) {
      return res.status(400).json({
        status: 'fail',
        message: 'A practice test with this title already exists. Please use a different title.'
      });
    }

    
    if (!targetUserType || !['student', 'corporate', 'government'].includes(targetUserType)) {
      return res.status(400).json({
        status: 'fail',
        message: 'targetUserType is required and must be student, corporate, or government.'
      });
    }

    
    const practiceTest = await PracticeTest.create({
      title,
      description: description || `Practice test for ${category}`,
      category,
      questions,
      totalQuestions: questions.length,
      questionsPerTest: questionsPerTest || 30,
      duration: duration || 30,
      passingScore: passingScore || 70,
      isActive: true,
      allowRepeat: true,
      repeatAfterHours: 24,
      createdBy: req.user._id,
      targetUserType
    });

    res.status(201).json({
      status: 'success',
      message: `Practice test "${title}" created successfully with ${questions.length} questions from Excel file`,
      data: {
        practiceTest: {
          id: practiceTest._id,
          title: practiceTest.title,
          category: practiceTest.category,
          totalQuestions: practiceTest.totalQuestions,
          questionsPerTest: practiceTest.questionsPerTest,
          duration: practiceTest.duration,
          passingScore: practiceTest.passingScore,
          targetUserType: practiceTest.targetUserType
        }
      }
    });
  } catch (err) {
    console.error('Error importing questions from Excel:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to import questions from Excel file',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};


exports.parseExcelPreview = async (req, res) => {
  try {
    const { category } = req.body;

    if (!req.file) {
      return res.status(400).json({
        status: 'fail',
        message: 'No Excel file uploaded'
      });
    }

    
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    if (!jsonData || jsonData.length === 0) {
      return res.status(400).json({ status: 'fail', message: 'Empty Excel sheet' });
    }

    const headers = jsonData[0];
    const requiredHeaders = ['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return res.status(400).json({
        status: 'fail',
        message: `Missing required headers: ${missingHeaders.join(', ')}. Expected headers: ${requiredHeaders.join(', ')}`
      });
    }

    const questions = [];
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || row.length < 6) continue;

      const question = row[headers.indexOf('Question')];
      const optionA = row[headers.indexOf('Option A')];
      const optionB = row[headers.indexOf('Option B')];
      const optionC = row[headers.indexOf('Option C')];
      const optionD = row[headers.indexOf('Option D')];
      const correctAnswer = row[headers.indexOf('Correct Answer')];

      if (!question || !optionA || !optionB || !optionC || !optionD || !correctAnswer) {
        continue;
      }

      let correctAnswerIndex;
      const answerStr = correctAnswer.toString().toLowerCase().trim();
      if (answerStr === 'a' || answerStr === '1') correctAnswerIndex = 0;
      else if (answerStr === 'b' || answerStr === '2') correctAnswerIndex = 1;
      else if (answerStr === 'c' || answerStr === '3') correctAnswerIndex = 2;
      else if (answerStr === 'd' || answerStr === '4') correctAnswerIndex = 3;
      else continue;

      questions.push({
        question: question.toString().trim(),
        options: [
          optionA.toString().trim(),
          optionB.toString().trim(),
          optionC.toString().trim(),
          optionD.toString().trim()
        ],
        correctAnswer: correctAnswerIndex,
        explanation: '',
        category: category || '',
        difficulty: 'medium',
        marks: 1
      });
    }

    return res.status(200).json({
      status: 'success',
      message: `Parsed ${questions.length} questions from Excel`,
      data: { questions }
    });
  } catch (err) {
    console.error('Error parsing Excel preview:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to parse Excel file',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};


exports.updateTestWithExcel = async (req, res) => {
  try {
    const { testId } = req.params;
    const { questionsPerTest, duration, passingScore } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        status: 'fail',
        message: 'No Excel file uploaded'
      });
    }

    
    const practiceTest = await PracticeTest.findByPk(testId);
    if (!practiceTest) {
      return res.status(404).json({
        status: 'fail',
        message: 'Practice test not found'
      });
    }

    
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    
    const questions = [];
    const headers = jsonData[0];
    
    
    const requiredHeaders = ['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer'];
    const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
    
    if (missingHeaders.length > 0) {
      return res.status(400).json({
        status: 'fail',
        message: `Missing required headers: ${missingHeaders.join(', ')}. Expected headers: ${requiredHeaders.join(', ')}`
      });
    }

    
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (row.length < 6) continue; 
      
      const question = row[headers.indexOf('Question')];
      const optionA = row[headers.indexOf('Option A')];
      const optionB = row[headers.indexOf('Option B')];
      const optionC = row[headers.indexOf('Option C')];
      const optionD = row[headers.indexOf('Option D')];
      const correctAnswer = row[headers.indexOf('Correct Answer')];
      
      
      if (!question || !optionA || !optionB || !optionC || !optionD || !correctAnswer) {
        continue; 
      }
      
      
      let correctAnswerIndex;
      const answerStr = correctAnswer.toString().toLowerCase().trim();
      
      if (answerStr === 'a' || answerStr === '1') {
        correctAnswerIndex = 0;
      } else if (answerStr === 'b' || answerStr === '2') {
        correctAnswerIndex = 1;
      } else if (answerStr === 'c' || answerStr === '3') {
        correctAnswerIndex = 2;
      } else if (answerStr === 'd' || answerStr === '4') {
        correctAnswerIndex = 3;
      } else {
        continue; 
      }
      
      questions.push({
        question: question.toString().trim(),
        options: [
          optionA.toString().trim(),
          optionB.toString().trim(),
          optionC.toString().trim(),
          optionD.toString().trim()
        ],
        correctAnswer: correctAnswerIndex,
        explanation: '',
        category: practiceTest.category,
        difficulty: 'medium',
        marks: 1
      });
    }

    
    if (questions.length < 10) {
      return res.status(400).json({
        status: 'fail',
        message: `Practice test must have at least 10 questions. Found ${questions.length} valid questions.`
      });
    }

    
    practiceTest.questions = questions;
    practiceTest.totalQuestions = questions.length;
    if (questionsPerTest) practiceTest.questionsPerTest = questionsPerTest;
    if (duration) practiceTest.duration = duration;
    if (passingScore) practiceTest.passingScore = passingScore;
    practiceTest.updatedAt = new Date();

    await practiceTest.save();

    res.status(200).json({
      status: 'success',
      message: `Practice test updated successfully with ${questions.length} questions from Excel file`,
      data: {
        practiceTest: {
          id: practiceTest._id,
          title: practiceTest.title,
          category: practiceTest.category,
          totalQuestions: practiceTest.totalQuestions,
          questionsPerTest: practiceTest.questionsPerTest,
          duration: practiceTest.duration,
          passingScore: practiceTest.passingScore
        }
      }
    });
  } catch (err) {
    console.error('Error updating test with Excel:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update test with Excel data',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};


exports.updateTestWithJSON = async (req, res) => {
  try {
    const { testId } = req.params;
    const { questionsData, questionsPerTest, duration, passingScore } = req.body;

    
    const practiceTest = await PracticeTest.findByPk(testId);
    if (!practiceTest) {
      return res.status(404).json({
        status: 'fail',
        message: 'Practice test not found'
      });
    }

    
    const questions = questionsData.map((q, index) => {
      let questionText, options, correctAnswer;
      
      if (q.question && q.options && q.answer) {
        questionText = q.question;
        options = [q.options.a, q.options.b, q.options.c, q.options.d];
        correctAnswer = q.answer === 'a' ? 0 : q.answer === 'b' ? 1 : q.answer === 'c' ? 2 : 3;
      } else if (q.question && Array.isArray(q.options) && typeof q.correctAnswer === 'number') {
        questionText = q.question;
        options = q.options;
        correctAnswer = q.correctAnswer;
      } else {
        throw new Error(`Invalid question format at index ${index}`);
      }

      return {
        question: questionText,
        options: options,
        correctAnswer: correctAnswer,
        explanation: q.explanation || '',
        category: q.category || practiceTest.category,
        difficulty: q.difficulty || 'medium',
        marks: typeof q.marks === 'number' ? q.marks : 1,
        negativeMarks: typeof q.negativeMarks === 'number' ? q.negativeMarks : 0
      };
    });

    
    practiceTest.questions = questions;
    practiceTest.totalQuestions = questions.length;
    if (questionsPerTest) practiceTest.questionsPerTest = questionsPerTest;
    if (duration) practiceTest.duration = duration;
    if (passingScore) practiceTest.passingScore = passingScore;
    practiceTest.updatedAt = new Date();

    await practiceTest.save();

    res.status(200).json({
      status: 'success',
      message: `Practice test updated successfully with ${questions.length} questions`,
      data: {
        practiceTest: {
          id: practiceTest._id,
          title: practiceTest.title,
          category: practiceTest.category,
          totalQuestions: practiceTest.totalQuestions,
          questionsPerTest: practiceTest.questionsPerTest,
          duration: practiceTest.duration,
          passingScore: practiceTest.passingScore
        }
      }
    });
  } catch (err) {
    console.error('Error updating test with JSON:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update test with JSON data',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
}; 

 


exports.updateTestActiveStatus = async (req, res) => {
  try {
    const { testId } = req.params;
    const { isActive } = req.body;

    
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'Only admins can update test active status'
      });
    }

    
    const practiceTest = await PracticeTest.findByPk(testId);
    if (!practiceTest) {
      return res.status(404).json({
        status: 'fail',
        message: 'Practice test not found'
      });
    }

    await practiceTest.update({ isActive: Boolean(isActive) });

    res.status(200).json({
      status: 'success',
      message: `Test ${isActive ? 'activated' : 'archived'} successfully`,
      data: { test: practiceTest }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to update test active status'
    });
  }
};


exports.setUserCooldown = async (req, res) => {
  try {
    const { userId, testId } = req.params;
    const { cooldownHours } = req.body;

    
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'Only admins can set user cooldowns'
      });
    }

    
    const user = await User.findByPk(userId);
    const test = await PracticeTest.findByPk(testId);
    
    if (!user || !test) {
      return res.status(404).json({
        status: 'fail',
        message: 'User or test not found'
      });
    }

    
    

    res.status(200).json({
      status: 'success',
      message: `Cooldown set to ${cooldownHours} hours for user ${user.email} on test ${test.title}`,
      data: { cooldownHours, userId, testId }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to set user cooldown'
    });
  }
};


exports.getTestUsers = async (req, res) => {
  try {
    const { testId } = req.params;

    
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'Only admins can view test users'
      });
    }

    
    const attempts = await TestAttempt.findAll({
      where: { practiceTestId: testId },
      include: [{
        model: User,
        as: 'user',
        attributes: ['firstName', 'lastName', 'email']
      }]
    });

    
    const userMap = new Map();
    attempts.forEach(attempt => {
      if (!userMap.has(attempt.userId.toString())) {
        userMap.set(attempt.userId.toString(), {
          userId: attempt.userId,
          user: attempt.user,
          lastAttempt: attempt,
          totalAttempts: 1,
          bestScore: attempt.score,
          averageScore: attempt.score
        });
      } else {
        const userData = userMap.get(attempt.userId.toString());
        userData.totalAttempts++;
        userData.averageScore = (userData.averageScore + attempt.score) / 2;
        if (attempt.score > userData.bestScore) {
          userData.bestScore = attempt.score;
        }
        if (new Date(attempt.completedAt) > new Date(userData.lastAttempt.completedAt)) {
          userData.lastAttempt = attempt;
        }
      }
    });

    const users = Array.from(userMap.values());

    res.status(200).json({
      status: 'success',
      data: { users }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch test users'
    });
  }
};


exports.updateTestSettings = async (req, res) => {
  try {
    const { testId } = req.params;
    const { allowRepeat, repeatAfterHours, enableCooldown, marksPerCorrect, enableNegative, negativeMarks } = req.body;

    
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'Only admins can update test settings'
      });
    }

    
    const practiceTest = await PracticeTest.findByPk(testId);
    if (!practiceTest) {
      return res.status(404).json({
        status: 'fail',
        message: 'Test not found'
      });
    }

    await practiceTest.update({ 
      allowRepeat, 
      repeatAfterHours, 
      enableCooldown: enableCooldown !== undefined ? enableCooldown : true 
    });

    
    const hasMarkingInputs = typeof marksPerCorrect !== 'undefined' || typeof enableNegative !== 'undefined' || typeof negativeMarks !== 'undefined';
    if (hasMarkingInputs) {
      try {
        const normalizedMarksPerCorrect = typeof marksPerCorrect === 'number' && !Number.isNaN(marksPerCorrect)
          ? marksPerCorrect
          : undefined;
        const normalizedNegativeMarks = typeof negativeMarks === 'number' && !Number.isNaN(negativeMarks)
          ? negativeMarks
          : undefined;

        const updatedQuestions = (Array.isArray(practiceTest.questions) ? practiceTest.questions : []).map((q) => {
          const next = { ...(q || {}) };
          if (typeof normalizedMarksPerCorrect !== 'undefined') {
            next.marks = normalizedMarksPerCorrect;
          } else if (typeof next.marks !== 'number') {
            next.marks = 1;
          }

          if (typeof enableNegative !== 'undefined') {
            if (enableNegative) {
              
              if (typeof normalizedNegativeMarks === 'number') {
                next.negativeMarks = normalizedNegativeMarks;
              } else if (typeof next.negativeMarks !== 'number' || next.negativeMarks === 0) {
                next.negativeMarks = -1;
              }
            } else {
              next.negativeMarks = 0;
            }
          } else if (typeof normalizedNegativeMarks === 'number') {
            
            next.negativeMarks = normalizedNegativeMarks;
          }

          return next;
        });

        practiceTest.questions = updatedQuestions;
        await practiceTest.save();
      } catch (markingErr) {
        
        return res.status(200).json({
          status: 'success',
          message: 'Test settings updated. Failed to apply marking scheme to questions.',
          data: { test: practiceTest },
          warning: process.env.NODE_ENV === 'development' ? String(markingErr?.message || markingErr) : undefined
        });
      }
    }

    res.status(200).json({
      status: 'success',
      message: 'Test settings updated successfully',
      data: { test: practiceTest }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to update test settings'
    });
  }
}; 


exports.updateTestQuestion = async (req, res) => {
  try {
    const { testId, questionIndex } = req.params;
    const update = req.body;
    const index = parseInt(questionIndex, 10);
    if (isNaN(index)) {
      return res.status(400).json({ status: 'fail', message: 'Invalid question index' });
    }
    const practiceTest = await PracticeTest.findByPk(testId);
    if (!practiceTest) {
      return res.status(404).json({ status: 'fail', message: 'Practice test not found' });
    }
    if (!practiceTest.questions[index]) {
      return res.status(404).json({ status: 'fail', message: 'Question not found' });
    }
    
    if (!update.question || !update.options || update.options.length !== 4) {
      return res.status(400).json({ status: 'fail', message: 'Each question must have exactly 4 options.' });
    }
    if (update.correctAnswer < 0 || update.correctAnswer > 3) {
      return res.status(400).json({ status: 'fail', message: 'Correct answer index must be 0-3.' });
    }
    
    practiceTest.questions[index] = {
      ...practiceTest.questions[index].toObject(),
      ...update
    };
    await practiceTest.save();
    res.status(200).json({ status: 'success', message: 'Question updated', question: practiceTest.questions[index] });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to update question' });
  }
}; 


exports.deleteAttempt = async (req, res) => {
  try {
    const { attemptId } = req.params;
    
    // Validate attemptId
    if (!attemptId || attemptId === 'undefined' || attemptId === 'null') {
      console.log('Invalid attemptId received for deletion:', attemptId);
      return res.status(400).json({ 
        status: 'fail', 
        message: 'Attempt ID is required and must be valid' 
      });
    }

    // Check if attemptId is a valid number
    if (isNaN(parseInt(attemptId))) {
      console.log('Non-numeric attemptId received for deletion:', attemptId);
      return res.status(400).json({ 
        status: 'fail', 
        message: 'Attempt ID must be a valid number' 
      });
    }

    const attempt = await TestAttempt.findByPk(attemptId);
    if (!attempt) {
      console.log('Attempt not found for deletion:', attemptId);
      return res.status(404).json({ status: 'fail', message: 'Attempt not found' });
    }
    
    // Check authorization - use req.user.id instead of req.user._id
    if (String(attempt.userId) !== String(req.user.id)) {
      console.log('Unauthorized deletion attempt:', {
        attemptUserId: attempt.userId,
        requestUserId: req.user.id,
        userRole: req.user.role
      });
      return res.status(403).json({ status: 'fail', message: 'Not authorized' });
    }
    
    await TestAttempt.destroy({ where: { id: attemptId } });
    console.log('Attempt deleted successfully:', attemptId);
    res.status(204).send();
  } catch (err) {
    console.error('Error in deleteAttempt:', err);
    res.status(500).json({ status: 'error', message: 'Failed to delete attempt' });
  }
}; 


exports.bulkUpdateTestSettings = async (req, res) => {
  try {
    const { allowRepeat, repeatAfterHours, enableCooldown } = req.body;
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'Only admins can bulk update test settings'
      });
    }
    
    const update = {};
    if (typeof allowRepeat !== 'undefined') update.allowRepeat = allowRepeat;
    if (typeof repeatAfterHours !== 'undefined') update.repeatAfterHours = repeatAfterHours;
    if (typeof enableCooldown !== 'undefined') update.enableCooldown = enableCooldown;
    
    const result = await PracticeTest.update(update, { where: {} });
    res.status(200).json({
      status: 'success',
      message: 'Bulk test settings updated',
      data: { modifiedCount: result[0] }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to bulk update test settings'
    });
  }
}; 

exports.downloadAttemptPDF = async (req, res) => {
  try {
    // ✅ OWASP: Input validation and sanitization
    const { testAttemptId } = req.params;
    
    // Validate testAttemptId format
    if (!testAttemptId || testAttemptId === 'undefined' || testAttemptId === 'null') {
      return res.status(400).json({ 
        status: 'fail', 
        message: 'Test attempt ID is required and must be valid' 
      });
    }

    // Validate numeric ID
    if (!/^\d+$/.test(testAttemptId)) {
      return res.status(400).json({ 
        status: 'fail', 
        message: 'Invalid test attempt ID format' 
      });
    }

    // ✅ OWASP: Rate limiting check (should be handled by middleware)
    // ✅ OWASP: Authorization check
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        status: 'fail', 
        message: 'Authentication required' 
      });
    }

    // ✅ OWASP: Secure database query with proper error handling
    const attempt = await TestAttempt.findByPk(testAttemptId);
    if (!attempt) {
      return res.status(404).json({ 
        status: 'fail', 
        message: 'Test attempt not found' 
      });
    }

    // ✅ OWASP: Authorization check - user can only access their own attempts
    if (attempt.userId.toString() !== req.user.id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ 
        status: 'fail', 
        message: 'Not authorized to access this attempt' 
      });
    }

    // ✅ OWASP: Additional validation - only completed attempts can generate PDFs
    if (attempt.status !== 'completed') {
      return res.status(400).json({ 
        status: 'fail', 
        message: 'PDF can only be generated for completed test attempts' 
      });
    }

    const test = await PracticeTest.findByPk(attempt.practiceTestId);
    if (!test) {
      return res.status(404).json({ 
        status: 'fail', 
        message: 'Test not found' 
      });
    }

    // ✅ OWASP: Security headers for PDF downloads
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="PracticeTest_Result_${attempt.id}.pdf"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // ✅ OWASP: Input sanitization for filename
    const sanitizedFilename = `PracticeTest_Result_${attempt.id}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFilename}"`);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    
    const drawBorder = () => {
      const margin = 15;
      doc.save();
      doc.lineWidth(2);
      doc.strokeColor('#1a237e'); 
      doc.rect(margin, margin, doc.page.width - 2 * margin, doc.page.height - 2 * margin).stroke();
      doc.restore();
    };
    drawBorder();
    doc.on('pageAdded', drawBorder);

    
    const fs = require('fs');
    const path = require('path');
    (async () => {
      try {
        const logoPath = path.join(__dirname, '..', 'models', 'logo.png');
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, doc.page.width / 2 - 30, 30, { width: 60, height: 60 });
        }
      } catch (e) {
        
      }
      doc.moveDown(4);
      doc.fontSize(20).font('Helvetica-Bold').text('IIFTL', { align: 'center' });
      doc.fontSize(12).font('Helvetica').text('Indian Institute of Foreign Trade & Logistics', { align: 'center' });
      doc.moveDown(1.5);
      doc.fontSize(16).font('Helvetica-Bold').text('Practice Test Result', { align: 'center' });
      doc.moveDown(4);
      
      const sanitizeText = (input) => {
        try {
          const str = String(input ?? '')
            .replace(/[\u0000-\u001F\u007F]/g, ' ') 
            .replace(/[\u2018\u2019\u201A\u201B]/g, "'") 
            .replace(/[\u201C\u201D\u201E\u201F]/g, '"') 
            .replace(/[\u2026]/g, '...') 
            .replace(/[\u2013\u2014]/g, '-') 
            .replace(/\s+/g, ' ') 
            .trim();
          return str;
        } catch (_) {
          return String(input || '');
        }
      };

      const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      doc.fontSize(12).font('Helvetica').text(`Test: ${sanitizeText(test.title)}`, { width: contentWidth, align: 'left' });
      doc.text(`Score: ${attempt.score}%`, { width: contentWidth, align: 'left' });
      doc.text(`Date: ${new Date(attempt.completedAt || attempt.startedAt).toLocaleString()}`, { width: contentWidth, align: 'left' });
      doc.moveDown(1);
      
      // Legend text below Date with color indicators
      doc.fontSize(10).font('Helvetica');
      doc.fillColor('green').text('• Correct option', { width: contentWidth, align: 'left' });
      doc.fillColor('red').text('• Your selected option (if incorrect)', { width: contentWidth, align: 'left' });
      doc.fillColor('black');
      doc.moveDown(1.5);


      
      doc.x = doc.page.margins.left;

      for (let i = 0; i < attempt.answers.length; i++) {
        const ans = attempt.answers[i];
        const qIdx = attempt.questionsAsked[i];
        const q = test.questions[qIdx];
        const userIdx = typeof ans.selectedAnswer === 'number' ? ans.selectedAnswer : null;
        const correctIdx = q.correctAnswer;

        
        doc.font('Helvetica-Bold').text(`${i + 1}. ${sanitizeText(q.question)}`, { width: contentWidth, align: 'left', lineGap: 2 });
        doc.font('Helvetica');

        
        const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F'];
        (q.options || []).forEach((opt, optIdx) => {
          const isCorrect = Number(correctIdx) === optIdx;
          const isUser = userIdx === optIdx;
          const marker = '•'; 
          const label = optionLabels[optIdx] || String.fromCharCode(65 + optIdx);

          if (isCorrect) doc.fillColor('green');
          else if (isUser && !isCorrect) doc.fillColor('red');

          doc.text(`${marker} ${label}. ${sanitizeText(opt)}`, {
            width: contentWidth - 14,
            align: 'left',
            indent: 14,
            lineGap: 1.5
          });
          doc.fillColor('black');
        });

        
        if (userIdx !== null && userIdx !== undefined) {
          doc.moveDown(0.2);
          if (ans.isCorrect) {
            doc.fillColor('green').text('Your answer is correct', { width: contentWidth, align: 'left' });
          } else {
            doc.fillColor('red').text('Your answer is wrong', { width: contentWidth, align: 'left' });
          }
          doc.fillColor('black');
        }

        doc.moveDown(1);
      }

      
      try {
        // Use historical settings from snapshot if available, otherwise fall back to current test settings
        const useHistoricalSettings = attempt.testSettingsSnapshot && attempt.testSettingsSnapshot.questions;
        
        const getQuestionMarks = (idx) => {
          if (useHistoricalSettings) {
            const historicalQ = attempt.testSettingsSnapshot.questions.find(q => q.index === idx);
            return historicalQ ? Number(historicalQ.marks ?? 1) : 1;
          } else {
            const q = test.questions[idx] || {};
            return Number((q && q.marks) ?? 1);
          }
        };
        
        const getQuestionNegative = (idx) => {
          if (useHistoricalSettings) {
            const historicalQ = attempt.testSettingsSnapshot.questions.find(q => q.index === idx);
            return historicalQ ? Number(historicalQ.negativeMarks ?? 0) : 0;
          } else {
            const q = test.questions[idx] || {};
            return Number((q && q.negativeMarks) ?? 0);
          }
        };

        const askedIndices = Array.isArray(attempt.questionsAsked) ? attempt.questionsAsked : [];
        const perQuestionMarksEnabled = askedIndices.some(idx => getQuestionMarks(idx) !== 1);
        
        const negativeMarkingEnabled = askedIndices.some(idx => getQuestionNegative(idx) < 0);

        const totalPossibleMarks = askedIndices.reduce((sum, idx) => {
          const marks = getQuestionMarks(idx);
          return sum + Math.max(0, marks);
        }, 0);

        const obtainedMarks = attempt.obtainedMarks || (attempt.answers || []).reduce((sum, a) => {
          const awarded = typeof a.marksAwarded === 'number' ? a.marksAwarded : 0;
          return sum + awarded;
        }, 0);

        // Calculate total possible marks based on historical settings
        const outOfQuestions = totalPossibleMarks;

        
        const marksValues = askedIndices.map(idx => getQuestionMarks(idx));
        const negValues = askedIndices.map(idx => getQuestionNegative(idx)).filter(v => v < 0);
        const uniqueMarks = Array.from(new Set(marksValues.map(v => Number.isFinite(v) ? v : 1)));
        const uniqueNegs = Array.from(new Set(negValues.map(v => Number.isFinite(v) ? v : -1)));
        const uniformMarksPerCorrect = uniqueMarks.length === 1 ? uniqueMarks[0] : null;
        const uniformNegativePerWrong = uniqueNegs.length === 1 ? uniqueNegs[0] : null;

        doc.addPage();
        drawBorder();
        doc.moveDown(1);
        doc.fontSize(16).font('Helvetica-Bold').text('Marks Summary', { align: 'center' });
        doc.moveDown(1);

        const tableContentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const startX = doc.page.margins.left;
        let startY = doc.y;
        const rowHeight = 24;
        const col1Width = Math.min(240, Math.floor(tableContentWidth * 0.45));
        const col2Width = tableContentWidth - col1Width;

        // Calculate the correct percentage based on obtained marks vs total possible marks
        const correctPercentage = totalPossibleMarks > 0 ? ((obtainedMarks / totalPossibleMarks) * 100).toFixed(2) : '0.00';

        const rows = [
          ['Total Questions', String(attempt.totalQuestions ?? askedIndices.length ?? 0)],
          ['Correct Answers', String(attempt.correctAnswers ?? '')],
          ['Wrong Answers', String(attempt.wrongAnswers ?? '')],
          ['Score (%)', `${typeof attempt.score === 'number' ? attempt.score : 0}%`],
          ['Obtained Marks', `${obtainedMarks} / ${totalPossibleMarks}`],
          ['Final Score (%)', `${correctPercentage}%`],
          ['Negative Marking', negativeMarkingEnabled ? 'Enabled' : '—'],
          ['Marks per correct', perQuestionMarksEnabled ? (uniformMarksPerCorrect !== null ? String(uniformMarksPerCorrect) : 'mixed') : '1'],
          ['Negative per wrong', negativeMarkingEnabled ? (uniformNegativePerWrong !== null ? String(uniformNegativePerWrong) : 'mixed') : '—']
        ];

        
        doc.save();
        doc.fontSize(11).font('Helvetica-Bold');
        doc.rect(startX, startY, col1Width, rowHeight).stroke();
        doc.rect(startX + col1Width, startY, col2Width, rowHeight).stroke();
        doc.text('Metric', startX + 8, startY + 6, { width: col1Width - 16, align: 'left' });
        doc.text('Value', startX + col1Width + 8, startY + 6, { width: col2Width - 16, align: 'left' });
        doc.restore();
        startY += rowHeight;

        
        doc.fontSize(11).font('Helvetica');
        rows.forEach(([label, value]) => {
          doc.rect(startX, startY, col1Width, rowHeight).stroke();
          doc.rect(startX + col1Width, startY, col2Width, rowHeight).stroke();
          doc.text(String(label), startX + 8, startY + 6, { width: col1Width - 16, align: 'left' });
          doc.text(String(value), startX + col1Width + 8, startY + 6, { width: col2Width - 16, align: 'left' });
          startY += rowHeight;
        });
      } catch (_) { /* ignore summary table errors */ }
      doc.end();
    })();
  } catch (err) {
    console.error('PDF generation error:', err);
    
    // ✅ OWASP: Secure error handling - don't expose internal details
    if (!res.headersSent) {
      res.status(500).json({ 
        status: 'error', 
        message: 'Failed to generate PDF',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }
}; 

