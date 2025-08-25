const { PracticeTest, TestAttempt, User } = require('../models');
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
    const practiceTests = await PracticeTest.findAll({
      where: { isActive: true },
      attributes: ['id', 'title', 'description', 'category', 'totalQuestions', 'questionsPerTest', 'duration', 'passingScore', 'repeatAfterHours', 'enableCooldown', 'questions', 'targetUserType', 'showInPublic'],
      order: [['createdAt', 'DESC']]
    });

    let filteredTests = practiceTests;
    if (req.user && req.user.userType) {
      // Only show tests for the user's type
      filteredTests = practiceTests.filter(test => test.targetUserType === req.user.userType);
    }

    let testsWithAvailability;
    if (req.user) {
      const userAttempts = await TestAttempt.findAll({ 
        where: {
          userId: req.user.id,
          status: 'completed'
        },
        attributes: ['practiceTestId', 'completedAt']
      });

      testsWithAvailability = filteredTests.map(test => {
        const userTestAttempts = userAttempts.filter(
          attempt => attempt.practiceTestId.toString() === test.id.toString()
        );
        const lastAttempt = userTestAttempts.length > 0 
          ? userTestAttempts.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0]
          : null;
        return {
          ...test.toObject(),
          canTakeTest: true,
          lastAttemptDate: lastAttempt ? lastAttempt.completedAt : null,
          attemptsCount: userTestAttempts.length,
          cooldownHours: 0,
          nextAvailableTime: null
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
          nextAvailableTime: null
        };
      });
    }

    res.status(200).json({
      status: 'success',
      data: { practiceTests: testsWithAvailability }
    });
  } catch (err) {
    console.error('Error in getAvailablePracticeTests:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch available practice tests'
    });
  }
};

// Start a practice test (resume if in_progress, else create new)
exports.startPracticeTest = async (req, res) => {
  try {
    const { testId } = req.params;
    // Check if test exists and is active
    const practiceTest = await PracticeTest.findByPk(testId);
    if (!practiceTest || !practiceTest.isActive) {
      return res.status(404).json({
        status: 'fail',
        message: 'Practice test not found or inactive'
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

    // 2. (existing cooldown logic for completed attempts, if any)
    const lastAttempt = await TestAttempt.findOne({
      where: {
        userId: req.user.id,
        practiceTestId: testId,
        status: 'completed'
      },
      order: [['completedAt', 'DESC']]
    });
    if (lastAttempt && lastAttempt.completedAt) {
      const now = new Date();
      const completedAt = new Date(lastAttempt.completedAt);
      const diffMs = now - completedAt;
      const diffHours = diffMs / (1000 * 60 * 60);
      if (diffHours < 1) {
        const nextAvailableTime = new Date(completedAt.getTime() + 60 * 60 * 1000);
        return res.status(403).json({
          status: 'fail',
          message: 'You must wait 1 hour before retaking this test.',
          nextAvailableTime
        });
      }
    }

    // 3. Create new attempt as before
    // Get questions that user hasn't seen recently
    // (No longer needed: unique question logic, just use first N in order)
    const total = practiceTest.questionsPerTest || practiceTest.totalQuestions;
    const selectedQuestionIndices = Array.from({ length: total }, (_, i) => i);
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
      totalQuestions: total,
      maxTime: practiceTest.duration * 60,
      startedAt: new Date(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      attemptsCount: (await TestAttempt.count({ where: { userId: req.user.id, practiceTestId: testId } })) + 1
    };
    const newTestAttempt = await TestAttempt.create(testAttemptData);
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
    res.status(500).json({
      status: 'error',
      message: 'Failed to start practice test',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
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
      
      if (isCorrect) correctAnswers++;

      detailedAnswers.push({
        questionIndex,
        selectedAnswer: answer.selectedAnswer,
        isCorrect,
        timeSpent: answer.timeSpent || 0
      });
    }

    // Always set totalQuestions to the number of questions actually asked in this attempt
    testAttempt.totalQuestions = testAttempt.questionsAsked.length;

    const score = Math.round((correctAnswers / testAttempt.totalQuestions) * 100);
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
        marks: q.marks || 1
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
        marks: q.marks || 1
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

    // Add logo and full name at the top
    const logoUrl = 'https://res.cloudinary.com/dtsbyvgqx/image/upload/v1753447947/favicon_pegz5v.jpg';
    const https = require('https');
    const getStream = (url) => new Promise((resolve, reject) => {
      https.get(url, (response) => {
        const data = [];
        response.on('data', chunk => data.push(chunk));
        response.on('end', () => resolve(Buffer.concat(data)));
        response.on('error', reject);
      });
    });
    (async () => {
      try {
        const logoBuffer = await getStream(logoUrl);
        doc.image(logoBuffer, doc.page.width / 2 - 30, 30, { width: 60, height: 60 });
      } catch (e) {
        // If logo fails, just skip
      }
      doc.moveDown(4);
      doc.fontSize(20).font('Helvetica-Bold').text('IIFTL', { align: 'center' });
      doc.fontSize(12).font('Helvetica').text('Indian Institute of Foreign Trade & Logistics', { align: 'center' });
      doc.moveDown(1.5);
      doc.fontSize(16).font('Helvetica-Bold').text('Practice Test Result', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).font('Helvetica').text(`Test: ${test.title}`);
      doc.text(`Score: ${attempt.score}%`);
      doc.text(`Date: ${new Date(attempt.completedAt || attempt.startedAt).toLocaleString()}`);
      doc.moveDown();

      for (let i = 0; i < attempt.answers.length; i++) {
        const ans = attempt.answers[i];
        if (typeof ans.selectedAnswer !== 'number') continue; // skip unanswered
        const qIdx = attempt.questionsAsked[i];
        const q = test.questions[qIdx];
        const userIdx = ans.selectedAnswer;
        const correctIdx = q.correctAnswer;
        doc.font('Helvetica-Bold').text(`${i + 1}. ${q.question}`);
        doc.font('Helvetica');
        doc.text(`Your Answer: ${String.fromCharCode(65 + userIdx)}. ${q.options[userIdx]}`);
        if (!ans.isCorrect) {
          doc.text(`Correct Answer: ${String.fromCharCode(65 + correctIdx)}. ${q.options[correctIdx]}`);
          doc.fillColor('red').text('Your answer is wrong').fillColor('black');
        } else {
          doc.fillColor('green').text('Your answer is correct').fillColor('black');
        }
        doc.moveDown();
      }
      doc.end();
    })();
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to generate PDF' });
  }
}; 