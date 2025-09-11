let PracticeTest, TestAttempt, User, sequelize;
try {
  const models = require('../models');
  PracticeTest = models.PracticeTest;
  TestAttempt = models.TestAttempt;
  User = models.User;
  sequelize = models.sequelize;
  console.log('Models imported successfully');
} catch (error) {
  console.error('Error importing models:', error);
  throw error;
}
const PDFDocument = require('pdfkit');
const XLSX = require('xlsx');
const multer = require('multer');

// Helper function to shuffle array (Fisher-Yates algorithm)
const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Create a new practice test (Admin only)
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

    // Validate questions
    if (!questions || questions.length < 10) {
      return res.status(400).json({
        status: 'fail',
        message: 'Practice test must have at least 10 questions'
      });
    }

    // Validate each question
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
      duration: duration || 30, // Default to 30 minutes
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

// Get all practice tests (Admin)
exports.getAllPracticeTests = async (req, res) => {
  try {
    const practiceTests = await PracticeTest.findAll({
      include: [{
        model: User,
        as: 'creator',
        attributes: ['firstName', 'lastName', 'email']
      }],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      status: 'success',
      data: { practiceTests }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch practice tests'
    });
  }
};

// Get practice test by ID (Admin)
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

// Get available practice tests for students and corporate users
exports.getAvailablePracticeTests = async (req, res) => {
  try {
    console.log('=== getAvailablePracticeTests START ===');
    console.log('Request headers:', req.headers);
    console.log('Request user:', req.user ? { id: req.user.id, role: req.user.role, userType: req.user.userType } : 'No user');
    
    console.log('About to query practice tests...');
    const practiceTests = await PracticeTest.findAll({
      where: { isActive: true },
      attributes: ['id', 'title', 'description', 'category', 'totalQuestions', 'questionsPerTest', 'duration', 'passingScore', 'repeatAfterHours', 'enableCooldown', 'questions', 'targetUserType', 'showInPublic'],
      order: [['createdAt', 'DESC']]
    });
    console.log('Practice tests query completed');
    
    // Also check for all practice tests (including inactive ones) for debugging
    console.log('About to query all practice tests...');
    const allPracticeTests = await PracticeTest.findAll({
      attributes: ['id', 'title', 'isActive', 'targetUserType']
    });
    console.log('All practice tests query completed');
    console.log('All practice tests (including inactive):', allPracticeTests.map(t => ({ id: t.id, title: t.title, isActive: t.isActive, targetUserType: t.targetUserType })));
    
    console.log('Found practice tests:', practiceTests.map(t => ({ id: t.id, title: t.title, targetUserType: t.targetUserType })));
    console.log('Total practice tests found:', practiceTests.length);

    let filteredTests = practiceTests;
    let batchAssignedTests = [];
    
    if (req.user) {
      // Handle both userType and role fields
      let userType = req.user.userType;
      if (!userType && req.user.role && req.user.role !== 'admin') {
        userType = req.user.role; // Use role if userType is not available
      }
      
      console.log('User type for filtering:', userType);
      console.log('User object:', { id: req.user.id, role: req.user.role, userType: req.user.userType });
      
      // Get tests assigned to user's batches using a more direct approach
      console.log('About to query user batches and assigned tests...');
      try {
        // First get the user's batch IDs
        const userBatchIds = await sequelize.query(`
          SELECT DISTINCT "batchId" 
          FROM "BatchStudents" 
          WHERE "userId" = :userId
        `, {
          replacements: { userId: req.user.id },
          type: sequelize.QueryTypes.SELECT
        });
        
        console.log('User batch IDs:', userBatchIds);
        
        if (userBatchIds.length > 0) {
          const batchIds = userBatchIds.map(b => b.batchId);
          
          // Get tests assigned to these batches
          const batchTests = await sequelize.query(`
            SELECT DISTINCT pt.* 
            FROM "PracticeTests" pt
            INNER JOIN "BatchAssignedTests" bat ON pt.id = bat."testId"
            WHERE bat."batchId" IN (:batchIds) AND pt."isActive" = true
          `, {
            replacements: { batchIds: batchIds },
            type: sequelize.QueryTypes.SELECT
          });
          
          console.log('Batch assigned tests found:', batchTests.length);
          console.log('Batch assigned tests:', batchTests.map(t => ({ id: t.id, title: t.title, targetUserType: t.targetUserType })));
          
          // Convert to the format expected by the rest of the function
          batchAssignedTests = batchTests.map(test => ({
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
            questions: test.questions,
            targetUserType: test.targetUserType,
            showInPublic: test.showInPublic
          }));
        }
      } catch (batchError) {
        console.error('Error querying user batches:', batchError);
        // Continue without batch tests if there's an error
        batchAssignedTests = [];
      }
      
      // Remove duplicates from batch assigned tests
      const uniqueBatchTests = batchAssignedTests.filter((test, index, self) => 
        index === self.findIndex(t => t.id === test.id)
      );
      
      console.log('Unique batch assigned tests:', uniqueBatchTests.map(t => ({ id: t.id, title: t.title, targetUserType: t.targetUserType })));
      
      if (userType) {
        // For corporate and government users: ONLY show batch-assigned tests
        // For students: show both type-filtered tests AND batch-assigned tests
        if (userType === 'corporate' || userType === 'government') {
          // Corporate and government users must be in batches to see tests
          filteredTests = uniqueBatchTests;
          console.log('Corporate/Government user - showing only batch-assigned tests:', filteredTests.map(t => ({ id: t.id, title: t.title, targetUserType: t.targetUserType })));
        } else if (userType === 'student') {
          // Students can see both type-filtered tests and batch-assigned tests
          const typeFilteredTests = practiceTests.filter(test => test.targetUserType === userType);
          console.log('Student - type filtered tests:', typeFilteredTests.map(t => ({ id: t.id, title: t.title, targetUserType: t.targetUserType })));
          
          // Combine type-filtered tests with batch-assigned tests
          const allAvailableTests = [...typeFilteredTests, ...uniqueBatchTests];
          
          // Remove duplicates
          filteredTests = allAvailableTests.filter((test, index, self) => 
            index === self.findIndex(t => t.id === test.id)
          );
          
          console.log('Student - combined filtered tests (type + batch):', filteredTests.map(t => ({ id: t.id, title: t.title, targetUserType: t.targetUserType })));
        } else {
          // Fallback for any other user types
          filteredTests = uniqueBatchTests;
          console.log('Other user type - showing only batch-assigned tests:', filteredTests.map(t => ({ id: t.id, title: t.title, targetUserType: t.targetUserType })));
        }
      } else {
        // If no userType, just show batch-assigned tests
        filteredTests = uniqueBatchTests;
        console.log('No userType, showing only batch-assigned tests:', filteredTests.map(t => ({ id: t.id, title: t.title, targetUserType: t.targetUserType })));
      }
    } else {
      console.log('No user object found in request');
    }

    let testsWithAvailability;
    const serializeTest = (test) => (test && typeof test.toJSON === 'function' ? test.toJSON() : test);
    if (req.user) {
      console.log('About to query user attempts...');
      const userAttempts = await TestAttempt.findAll({ 
        where: {
          userId: req.user.id,
          status: 'completed'
        },
        attributes: ['practiceTestId', 'completedAt']
      });
      console.log('User attempts query completed');

      testsWithAvailability = filteredTests.map(test => {
        const userTestAttempts = userAttempts.filter(
          attempt => attempt.practiceTestId.toString() === test.id.toString()
        );
        const lastAttempt = userTestAttempts.length > 0 
          ? userTestAttempts.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0]
          : null;
        
        // Check if this test is assigned to user's batch
        const isBatchAssigned = batchAssignedTests.some(bt => bt.id === test.id);
        
        return {
          ...serializeTest(test),
          canTakeTest: true,
          lastAttemptDate: lastAttempt ? lastAttempt.completedAt : null,
          attemptsCount: userTestAttempts.length,
          cooldownHours: 0,
          nextAvailableTime: null,
          isBatchAssigned: isBatchAssigned
        };
      });
    } else {
      // Only show tests marked as public
      const publicTests = filteredTests.filter(test => test.showInPublic);
      testsWithAvailability = publicTests.map(test => {
        const teaserQuestions = (test.questions || []).slice(0, 2).map(q => ({
          question: q.question,
          options: q.options
        }));
        return {
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
          teaserQuestions,
          canTakeTest: false,
          lastAttemptDate: null,
          attemptsCount: 0,
          cooldownHours: 0,
          nextAvailableTime: null,
          isBatchAssigned: false
        };
      });
    }

    console.log('Final response - testsWithAvailability count:', testsWithAvailability.length);
    console.log('=== getAvailablePracticeTests END ===');
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

// Start a practice test (resume if in_progress, else create new)
exports.startPracticeTest = async (req, res) => {
  try {
    const { testId } = req.params;
    console.log('=== startPracticeTest START ===');
    console.log('User:', req.user ? { id: req.user.id, role: req.user.role, userType: req.user.userType } : 'No user');
    console.log('Test ID:', testId);
    
    // Check if test exists and is active
    const practiceTest = await PracticeTest.findByPk(testId);
    if (!practiceTest || !practiceTest.isActive) {
      return res.status(404).json({
        status: 'fail',
        message: 'Practice test not found or inactive'
      });
    }
    
    // Check user type compatibility
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
    
    // Check if user has access to this test through batch assignment
    try {
      const userBatchIds = await sequelize.query(`
        SELECT DISTINCT "batchId" 
        FROM "BatchStudents" 
        WHERE "userId" = :userId
      `, {
        replacements: { userId: req.user.id },
        type: sequelize.QueryTypes.SELECT
      });
      
      if (userBatchIds.length > 0) {
        const batchIds = userBatchIds.map(b => b.batchId);
        
        // Check if this test is assigned to any of the user's batches
        const batchTestAssignment = await sequelize.query(`
          SELECT COUNT(*) as count
          FROM "BatchAssignedTests" 
          WHERE "batchId" IN (:batchIds) AND "testId" = :testId AND "isActive" = true
        `, {
          replacements: { batchIds: batchIds, testId: testId },
          type: sequelize.QueryTypes.SELECT
        });
        
        const hasBatchAccess = batchTestAssignment[0]?.count > 0;
        
        if (!hasBatchAccess) {
          console.log('User batch access check failed:', {
            userId: req.user.id,
            testId: testId,
            userBatches: batchIds,
            testTargetUserType: practiceTest.targetUserType,
            userType: userType
          });
          return res.status(403).json({
            status: 'fail',
            message: `Access Denied: This test is not assigned to your batch. You are in batches [${batchIds.join(', ')}] but test ${testId} is not assigned to any of them. Please contact an administrator.`
          });
        }
      } else {
        // User is not in any batches, check if test is public
        console.log('User not in any batches:', {
          userId: req.user.id,
          userType: userType,
          testId: testId,
          testTitle: practiceTest.title,
          testPublic: practiceTest.showInPublic
        });
        if (!practiceTest.showInPublic) {
          return res.status(403).json({
            status: 'fail',
            message: `Access Denied: You are not enrolled in any batches and test "${practiceTest.title}" is not publicly available. Please contact an administrator to be added to a batch.`
          });
        }
      }
    } catch (batchError) {
      console.error('Error checking batch access:', batchError);
      return res.status(500).json({
        status: 'fail',
        message: 'Error verifying test access. Please try again.'
      });
    }

    // 1. Check for in-progress attempt for this user and test
    let testAttempt = await TestAttempt.findOne({
      where: {
        userId: req.user.id,
        practiceTestId: testId,
        status: 'in_progress'
      }
    });

    if (testAttempt) {
      // Resume unfinished attempt
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

    // 2. Cooldown logic based on test configuration
    const lastAttempt = await TestAttempt.findOne({
      where: {
        userId: req.user.id,
        practiceTestId: testId,
        status: 'completed'
      },
      order: [['completedAt', 'DESC']]
    });
    if (lastAttempt && lastAttempt.completedAt) {
      if (!practiceTest.allowRepeat) {
        return res.status(403).json({
          status: 'fail',
          message: 'Repeat attempts are disabled for this test.'
        });
      }
      if (practiceTest.enableCooldown) {
        const now = new Date();
        const completedAt = new Date(lastAttempt.completedAt);
        const diffMs = now.getTime() - completedAt.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        const cooldownHours = Number(practiceTest.repeatAfterHours || 0);
        if (diffHours < cooldownHours) {
          const nextAvailableTime = new Date(completedAt.getTime() + cooldownHours * 60 * 60 * 1000);
          return res.status(403).json({
            status: 'fail',
            message: `You must wait ${Math.ceil(cooldownHours - diffHours)} hour(s) before retaking this test.`,
            nextAvailableTime
          });
        }
      }
    }

    // 3. Create new attempt with cycling question selection
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
      attemptsCount: (await TestAttempt.count({ where: { userId: req.user.id, practiceTestId: testId } })) + 1
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

// Submit practice test answers
exports.submitPracticeTest = async (req, res) => {
  try {
    const { testAttemptId } = req.params;
    const { answers } = req.body;

    // Get test attempt
    const testAttempt = await TestAttempt.findByPk(testAttemptId);
    if (!testAttempt) {
      return res.status(404).json({
        status: 'fail',
        message: 'Test attempt not found'
      });
    }

    // Verify user owns this attempt
    if (testAttempt.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        status: 'fail',
        message: 'Not authorized to access this test attempt'
      });
    }

    // Check if already completed
    if (testAttempt.status === 'completed') {
      return res.status(400).json({
        status: 'fail',
        message: 'Test already completed'
      });
    }

    // Get practice test for correct answers
    const practiceTest = await PracticeTest.findByPk(testAttempt.practiceTestId);
    if (!practiceTest) {
      return res.status(404).json({
        status: 'fail',
        message: 'Practice test not found'
      });
    }

    // Calculate results
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

    // Always set totalQuestions to the number of questions actually asked in this attempt
    testAttempt.totalQuestions = testAttempt.questionsAsked.length;

    // Compute total possible marks and obtained marks considering negative marking
    let totalPossible = 0;
    let obtained = 0;
    for (let i = 0; i < testAttempt.questionsAsked.length; i++) {
      const qIdx = testAttempt.questionsAsked[i];
      const q = practiceTest.questions[qIdx] || {};
      const marks = Number(q.marks ?? 1);
      const negativeMarks = Number(q.negativeMarks ?? 0);
      totalPossible += Math.max(0, marks); // total possible when all correct
      const ans = detailedAnswers[i];
      if (ans && typeof ans.marksAwarded === 'number') {
        obtained += ans.marksAwarded;
      } else {
        // fallback maintain backwards safety
        const isCorrect = ans ? ans.isCorrect : false;
        obtained += isCorrect ? marks : (negativeMarks ? -Math.abs(negativeMarks) : 0);
      }
    }

    // Score as percentage of totalPossible, clamp to [0,100]
    const score = totalPossible > 0 ? Math.round(Math.max(0, (obtained / totalPossible) * 100)) : 0;
    const passed = score >= practiceTest.passingScore;
    const timeTaken = Math.floor((new Date() - new Date(testAttempt.startedAt)) / 1000);

    // Update test attempt
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
      passed: passed
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
        passingScore: practiceTest.passingScore
      }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to submit practice test'
    });
  }
};

// Get user's test attempts
exports.getUserTestAttempts = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        status: 'fail',
        message: 'User not authenticated'
      });
    }

    // Check if user has a valid role
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

// Admin: Reset user's test cooldown for a specific test
exports.resetUserTestCooldown = async (req, res) => {
  try {
    const { userId, testId } = req.params;

    // Check if admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'Only admins can reset test cooldowns'
      });
    }

    // If userId is "all", reset cooldown for all users
    const query = userId === "all" 
      ? { practiceTestId: testId, status: 'completed' }
      : { userId, practiceTestId: testId, status: 'completed' };

    // Delete all completed attempts for this test
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

// Get test statistics (Admin)
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

    // Track question usage
    attempts.forEach(attempt => {
      if (attempt.questionsAsked && Array.isArray(attempt.questionsAsked)) {
        attempt.questionsAsked.forEach(qIndex => {
          stats.questionUsage[qIndex] = (stats.questionUsage[qIndex] || 0) + 1;
        });
      }
    });

    // Check if all questions have been used
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

// Update practice test (Admin)
exports.updatePracticeTest = async (req, res) => {
  try {
    const { testId } = req.params;
    const updates = req.body;
    // If questions are being updated, validate them
    if (updates.questions) {
      if (updates.questions.length < 10) {
        return res.status(400).json({
          status: 'fail',
          message: 'Practice test must have at least 10 questions'
        });
      }

      // Validate each question
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

      // Update totalQuestions to match the new questions array length
      updates.totalQuestions = updates.questions.length;
    }

    // If targetUserType is being updated, validate it
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

// Delete practice test (Admin)
// Note: We do NOT delete test attempts/history here. This is intentional to preserve student analytics/history even after the test is deleted.
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

// Reset question usage for a test (Admin)
exports.resetQuestionUsage = async (req, res) => {
  try {
    const { testId } = req.params;

    // Delete all attempts for this test
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

// Import questions from JSON (Admin)
exports.importQuestionsFromJSON = async (req, res) => {
  try {
    const { title, description, category, questionsPerTest, duration, passingScore, questionsData } = req.body;

    // Validate required fields
    if (!title || !category || !questionsData || !Array.isArray(questionsData)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Missing required fields: title, category, and questionsData array'
      });
    }

    // Transform the questions data to match our schema
    const questions = questionsData.map((q, index) => {
      // Handle different JSON formats
      let questionText, options, correctAnswer;
      
      if (q.question && q.options && q.answer) {
        // Format: { question: "...", options: { a: "...", b: "...", c: "...", d: "..." }, answer: "a" }
        questionText = q.question;
        options = [q.options.a, q.options.b, q.options.c, q.options.d];
        correctAnswer = q.answer === 'a' ? 0 : q.answer === 'b' ? 1 : q.answer === 'c' ? 2 : 3;
      } else if (q.question && Array.isArray(q.options) && typeof q.correctAnswer === 'number') {
        // Format: { question: "...", options: ["...", "...", "...", "..."], correctAnswer: 0 }
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

    // Validate questions
    if (questions.length < 10) {
      return res.status(400).json({
        status: 'fail',
        message: 'Practice test must have at least 10 questions'
      });
    }

    // Check if test with same title already exists
    const existingTest = await PracticeTest.findOne({ title });
    if (existingTest) {
      return res.status(400).json({
        status: 'fail',
        message: 'A practice test with this title already exists. Please use a different title.'
      });
    }

    // Create new practice test
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

// Import questions from Excel file (Admin)
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

    // Read the Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Skip header row and process data
    const questions = [];
    const headers = jsonData[0];
    
    // Validate headers
    const requiredHeaders = ['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer'];
    const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
    
    if (missingHeaders.length > 0) {
      return res.status(400).json({
        status: 'fail',
        message: `Missing required headers: ${missingHeaders.join(', ')}. Expected headers: ${requiredHeaders.join(', ')}`
      });
    }

    // Process each row (skip header)
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (row.length < 6) continue; // Skip empty rows
      
      const question = row[headers.indexOf('Question')];
      const optionA = row[headers.indexOf('Option A')];
      const optionB = row[headers.indexOf('Option B')];
      const optionC = row[headers.indexOf('Option C')];
      const optionD = row[headers.indexOf('Option D')];
      const correctAnswer = row[headers.indexOf('Correct Answer')];
      
      // Validate required fields
      if (!question || !optionA || !optionB || !optionC || !optionD || !correctAnswer) {
        continue; // Skip invalid rows
      }
      
      // Validate correct answer format
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
        continue; // Skip invalid answer format
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

    // Validate minimum questions
    if (questions.length < 10) {
      return res.status(400).json({
        status: 'fail',
        message: `Practice test must have at least 10 questions. Found ${questions.length} valid questions.`
      });
    }

    // Check if test with same title already exists
    const existingTest = await PracticeTest.findOne({ title });
    if (existingTest) {
      return res.status(400).json({
        status: 'fail',
        message: 'A practice test with this title already exists. Please use a different title.'
      });
    }

    // Validate targetUserType
    if (!targetUserType || !['student', 'corporate', 'government'].includes(targetUserType)) {
      return res.status(400).json({
        status: 'fail',
        message: 'targetUserType is required and must be student, corporate, or government.'
      });
    }

    // Create new practice test
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

// Parse Excel and return questions without saving (Admin)
exports.parseExcelPreview = async (req, res) => {
  try {
    const { category } = req.body;

    if (!req.file) {
      return res.status(400).json({
        status: 'fail',
        message: 'No Excel file uploaded'
      });
    }

    // Read the Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
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

// Update practice test with Excel data (Admin)
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

    // Find the existing test
    const practiceTest = await PracticeTest.findByPk(testId);
    if (!practiceTest) {
      return res.status(404).json({
        status: 'fail',
        message: 'Practice test not found'
      });
    }

    // Read the Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Skip header row and process data
    const questions = [];
    const headers = jsonData[0];
    
    // Validate headers
    const requiredHeaders = ['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer'];
    const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
    
    if (missingHeaders.length > 0) {
      return res.status(400).json({
        status: 'fail',
        message: `Missing required headers: ${missingHeaders.join(', ')}. Expected headers: ${requiredHeaders.join(', ')}`
      });
    }

    // Process each row (skip header)
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (row.length < 6) continue; // Skip empty rows
      
      const question = row[headers.indexOf('Question')];
      const optionA = row[headers.indexOf('Option A')];
      const optionB = row[headers.indexOf('Option B')];
      const optionC = row[headers.indexOf('Option C')];
      const optionD = row[headers.indexOf('Option D')];
      const correctAnswer = row[headers.indexOf('Correct Answer')];
      
      // Validate required fields
      if (!question || !optionA || !optionB || !optionC || !optionD || !correctAnswer) {
        continue; // Skip invalid rows
      }
      
      // Validate correct answer format
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
        continue; // Skip invalid answer format
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

    // Validate minimum questions
    if (questions.length < 10) {
      return res.status(400).json({
        status: 'fail',
        message: `Practice test must have at least 10 questions. Found ${questions.length} valid questions.`
      });
    }

    // Update the test
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

// Update practice test with JSON data (Admin)
exports.updateTestWithJSON = async (req, res) => {
  try {
    const { testId } = req.params;
    const { questionsData, questionsPerTest, duration, passingScore } = req.body;

    // Find the existing test
    const practiceTest = await PracticeTest.findByPk(testId);
    if (!practiceTest) {
      return res.status(404).json({
        status: 'fail',
        message: 'Practice test not found'
      });
    }

    // Transform the questions data
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

    // Update the test
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

 

// Admin: Update test active status (archive/unarchive)
exports.updateTestActiveStatus = async (req, res) => {
  try {
    const { testId } = req.params;
    const { isActive } = req.body;

    // Check if admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'Only admins can update test active status'
      });
    }

    // Find and update the test active status
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

// Admin: Set user-specific cooldown for a test
exports.setUserCooldown = async (req, res) => {
  try {
    const { userId, testId } = req.params;
    const { cooldownHours } = req.body;

    // Check if admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'Only admins can set user cooldowns'
      });
    }

    // Check if user and test exist
    const user = await User.findByPk(userId);
    const test = await PracticeTest.findByPk(testId);
    
    if (!user || !test) {
      return res.status(404).json({
        status: 'fail',
        message: 'User or test not found'
      });
    }

    // Create or update user-specific cooldown setting
    // Cooldown functionality has been removed

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

// Admin: Get users who have taken a specific test
exports.getTestUsers = async (req, res) => {
  try {
    const { testId } = req.params;

    // Check if admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'Only admins can view test users'
      });
    }

    // Get all attempts for this test with user details
    const attempts = await TestAttempt.findAll({
      where: { practiceTestId: testId },
      include: [{
        model: User,
        as: 'user',
        attributes: ['firstName', 'lastName', 'email']
      }]
    });

    // Group by user and get latest attempt
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

// Admin: Update test settings
exports.updateTestSettings = async (req, res) => {
  try {
    const { testId } = req.params;
    const { allowRepeat, repeatAfterHours, enableCooldown } = req.body;

    // Check if admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'Only admins can update test settings'
      });
    }

    // Find and update test settings
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

// Update a specific question in a practice test (Admin)
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
    // Validate update
    if (!update.question || !update.options || update.options.length !== 4) {
      return res.status(400).json({ status: 'fail', message: 'Each question must have exactly 4 options.' });
    }
    if (update.correctAnswer < 0 || update.correctAnswer > 3) {
      return res.status(400).json({ status: 'fail', message: 'Correct answer index must be 0-3.' });
    }
    // Update the question
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

// Delete a test attempt by ID (for in-progress cleanup)
exports.deleteAttempt = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const attempt = await TestAttempt.findByPk(attemptId);
    if (!attempt) {
      return res.status(404).json({ status: 'fail', message: 'Attempt not found' });
    }
    // Only allow the user who owns the attempt to delete it
    if (String(attempt.userId) !== String(req.user._id)) {
      return res.status(403).json({ status: 'fail', message: 'Not authorized' });
    }
    await TestAttempt.destroy({ where: { id: attemptId } });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to delete attempt' });
  }
}; 

// Admin: Bulk update test settings (e.g., allowRepeat for all tests)
exports.bulkUpdateTestSettings = async (req, res) => {
  try {
    const { allowRepeat, repeatAfterHours, enableCooldown } = req.body;
    // Check if admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'Only admins can bulk update test settings'
      });
    }
    // Update all tests
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
    const { testAttemptId } = req.params;
    const attempt = await TestAttempt.findByPk(testAttemptId);
    if (!attempt) return res.status(404).json({ status: 'fail', message: 'Attempt not found' });

    const test = await PracticeTest.findByPk(attempt.practiceTestId);
    if (!test) return res.status(404).json({ status: 'fail', message: 'Test not found' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="PracticeTest_Result_${attempt.id}.pdf"`);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    // Draw a border on each page
    const drawBorder = () => {
      const margin = 15;
      doc.save();
      doc.lineWidth(2);
      doc.strokeColor('#1a237e'); // Deep blue
      doc.rect(margin, margin, doc.page.width - 2 * margin, doc.page.height - 2 * margin).stroke();
      doc.restore();
    };
    drawBorder();
    doc.on('pageAdded', drawBorder);

    // Add logo and full name at the top (use local logo file)
    const fs = require('fs');
    const path = require('path');
    (async () => {
      try {
        const logoPath = path.join(__dirname, '..', 'models', 'logo.png');
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, doc.page.width / 2 - 30, 30, { width: 60, height: 60 });
        }
      } catch (e) {
        // If logo fails, skip silently
      }
      doc.moveDown(4);
      doc.fontSize(20).font('Helvetica-Bold').text('IIFTL', { align: 'center' });
      doc.fontSize(12).font('Helvetica').text('Indian Institute of Foreign Trade & Logistics', { align: 'center' });
      doc.moveDown(1.5);
      doc.fontSize(16).font('Helvetica-Bold').text('Practice Test Result', { align: 'center' });
      doc.moveDown(4);
      // Helper to sanitize text (remove control chars and normalize spacing/quotes)
      const sanitizeText = (input) => {
        try {
          const str = String(input ?? '')
            .replace(/[\u0000-\u001F\u007F]/g, ' ') // remove control chars
            .replace(/[\u2018\u2019\u201A\u201B]/g, "'") // smart single quotes to '
            .replace(/[\u201C\u201D\u201E\u201F]/g, '"') // smart double quotes to "
            .replace(/[\u2026]/g, '...') // ellipsis
            .replace(/[\u2013\u2014]/g, '-') // dashes
            .replace(/\s+/g, ' ') // normalize spaces
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
      doc.moveDown(1.5);

      // Legend in the header (top-right)
      try {
        const legendWidth = 240;
        const legendX = doc.page.width - doc.page.margins.right - legendWidth;
        const legendY = doc.y - 36; // place slightly above current y, aligned with header block
        doc.save();
        doc.fontSize(9);
        doc.fillColor('green').text('• Correct option', legendX, legendY, { width: legendWidth, align: 'right' });
        doc.fillColor('red').text('• Your selected option (if incorrect)', legendX, legendY + 12, { width: legendWidth, align: 'right' });
        doc.fillColor('black');
        doc.restore();
      } catch (_) { /* ignore legend placement errors */ }

      doc.moveDown();

      // Ensure text cursor starts at left margin for body content
      doc.x = doc.page.margins.left;

      for (let i = 0; i < attempt.answers.length; i++) {
        const ans = attempt.answers[i];
        const qIdx = attempt.questionsAsked[i];
        const q = test.questions[qIdx];
        const userIdx = typeof ans.selectedAnswer === 'number' ? ans.selectedAnswer : null;
        const correctIdx = q.correctAnswer;

        // Question text
        doc.font('Helvetica-Bold').text(`${i + 1}. ${sanitizeText(q.question)}`, { width: contentWidth, align: 'left', lineGap: 2 });
        doc.font('Helvetica');

        // Options list with indicators
        const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F'];
        (q.options || []).forEach((opt, optIdx) => {
          const isCorrect = Number(correctIdx) === optIdx;
          const isUser = userIdx === optIdx;
          const marker = '•'; // always show bullet dot
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

        // Show concise correctness line below options
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

      // Add a final page with a marks summary table
      try {
        const getQuestionMarks = (q) => {
          try { return Number((q && q.marks) ?? 1); } catch (_) { return 1; }
        };
        const getQuestionNegative = (q) => {
          try { return Number((q && q.negativeMarks) ?? 0); } catch (_) { return 0; }
        };

        const askedIndices = Array.isArray(attempt.questionsAsked) ? attempt.questionsAsked : [];
        const perQuestionMarksEnabled = askedIndices.some(idx => getQuestionMarks(test.questions[idx]) !== 1);
        const negativeMarkingEnabled = askedIndices.some(idx => getQuestionNegative(test.questions[idx]) > 0);

        const totalPossibleMarks = askedIndices.reduce((sum, idx) => {
          const q = test.questions[idx] || {};
          const marks = getQuestionMarks(q);
          return sum + Math.max(0, marks);
        }, 0);

        const obtainedMarks = (attempt.answers || []).reduce((sum, a) => {
          const awarded = typeof a.marksAwarded === 'number' ? a.marksAwarded : 0;
          return sum + awarded;
        }, 0);

        const outOf = Number(test.questionsPerTest || attempt.totalQuestions || askedIndices.length || 0);

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

        const rows = [
          ['Total Questions', String(attempt.totalQuestions ?? askedIndices.length ?? 0)],
          ['Correct Answers', String(attempt.correctAnswers ?? '')],
          ['Wrong Answers', String(attempt.wrongAnswers ?? '')],
          ['Score (%)', `${typeof attempt.score === 'number' ? attempt.score : 0}%`],
          ['Obtained Marks', `${obtainedMarks}`],
          ['Total Possible Marks', `${totalPossibleMarks}`],
          ['Out of', `${outOf}`],
          ['Negative Marking', negativeMarkingEnabled ? 'Enabled' : '—'],
          ['Per-question Marks', perQuestionMarksEnabled ? 'Enabled' : '—']
        ];

        // Table header
        doc.save();
        doc.fontSize(11).font('Helvetica-Bold');
        doc.rect(startX, startY, col1Width, rowHeight).stroke();
        doc.rect(startX + col1Width, startY, col2Width, rowHeight).stroke();
        doc.text('Metric', startX + 8, startY + 6, { width: col1Width - 16, align: 'left' });
        doc.text('Value', startX + col1Width + 8, startY + 6, { width: col2Width - 16, align: 'left' });
        doc.restore();
        startY += rowHeight;

        // Table rows
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
    res.status(500).json({ status: 'error', message: 'Failed to generate PDF' });
  }
}; 

// Debug endpoint to check user batch and test assignments
exports.debugUserBatchTests = async (req, res) => {
  try {
    console.log('=== debugUserBatchTests START ===');
    console.log('User:', req.user ? { id: req.user.id, role: req.user.role, userType: req.user.userType } : 'No user');
    
    if (!req.user) {
      return res.status(401).json({ status: 'error', message: 'User not authenticated' });
    }
    
    // Get user's batch IDs
    const userBatchIds = await sequelize.query(`
      SELECT DISTINCT "batchId" 
      FROM "BatchStudents" 
      WHERE "userId" = :userId
    `, {
      replacements: { userId: req.user.id },
      type: sequelize.QueryTypes.SELECT
    });
    
    console.log('User batch IDs:', userBatchIds);
    
    let batchDetails = [];
    let assignedTests = [];
    
    if (userBatchIds.length > 0) {
      const batchIds = userBatchIds.map(b => b.batchId);
      
      // Get batch details
      batchDetails = await sequelize.query(`
        SELECT * FROM "Batches" WHERE id IN (:batchIds)
      `, {
        replacements: { batchIds: batchIds },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Get tests assigned to these batches
      assignedTests = await sequelize.query(`
        SELECT pt.*, bat."batchId"
        FROM "PracticeTests" pt
        INNER JOIN "BatchAssignedTests" bat ON pt.id = bat."testId"
        WHERE bat."batchId" IN (:batchIds)
      `, {
        replacements: { batchIds: batchIds },
        type: sequelize.QueryTypes.SELECT
      });
    }
    
    // Get all practice tests for comparison
    const allTests = await PracticeTest.findAll({
      attributes: ['id', 'title', 'isActive', 'targetUserType']
    });
    
    console.log('=== debugUserBatchTests END ===');
    
    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: req.user.id,
          role: req.user.role,
          userType: req.user.userType
        },
        userBatchIds,
        batchDetails,
        assignedTests: assignedTests.map(t => ({
          id: t.id,
          title: t.title,
          isActive: t.isActive,
          targetUserType: t.targetUserType,
          batchId: t.batchId
        })),
        allTests: allTests.map(t => ({
          id: t.id,
          title: t.title,
          isActive: t.isActive,
          targetUserType: t.targetUserType
        }))
      }
    });
  } catch (err) {
    console.error('Error in debugUserBatchTests:', err);
    res.status(500).json({
      status: 'error',
      message: 'Debug failed',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
}; 