const mongoose = require('mongoose');
const User = require('../models/user.model');
const Batch = require('../models/batch.model');
const PracticeTest = require('../models/practiceTest.model');
const TestAttempt = require('../models/testAttempt.model');
const Course = require('../models/course.model');

function toObjectId(id) {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch {
    return null;
  }
}

// Helper to format safe number average
function average(numbers) {
  if (!numbers || numbers.length === 0) return 0;
  const sum = numbers.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  return Math.round((sum / numbers.length) * 100) / 100;
}

// GET /api/analytics/students-progress
// Admin-only: Returns overview and per-student progress summary with optional filters
exports.getStudentsProgress = async (req, res) => {
  try {
    const { search = '', batchId, testId, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    // 1) Load all students
    const userQuery = { role: 'student' };
    if (search) {
      userQuery.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } }
      ];
    }

    const totalStudents = await User.countDocuments(userQuery);
    const students = await User.find(userQuery)
      .select('firstName lastName email studentId isActive createdAt')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    const studentIds = students.map(s => s._id);

    // 2) Load batches containing these students (most students are in exactly one batch by design)
    const batches = await Batch.find({ students: { $in: studentIds } })
      .select('batchName students assignedTests')
      .lean();

    const studentIdToBatch = new Map();
    const allAssignedTestIds = new Set();
    batches.forEach(b => {
      (b.students || []).forEach(sid => {
        studentIdToBatch.set(String(sid), b);
      });
      (b.assignedTests || []).forEach(at => {
        if (at && at.testId && at.isActive !== false) allAssignedTestIds.add(String(at.testId));
      });
    });

    // 3) Load practice tests referenced by those batches (for titles/categories)
    const uniqueTestIds = Array.from(allAssignedTestIds);
    const tests = await PracticeTest.find({ _id: { $in: uniqueTestIds } })
      .select('title category')
      .lean();
    const testIdToTest = new Map(tests.map(t => [String(t._id), t]));

    // 4) Load attempts for these students (optionally filter by batch/test)
    const attemptsQuery = { userId: { $in: studentIds } };
    if (testId) {
      const tid = toObjectId(testId);
      if (tid) attemptsQuery.practiceTestId = tid;
    }
    if (batchId) {
      const bid = toObjectId(batchId);
      if (bid) attemptsQuery.batchId = bid;
    }
    const attempts = await TestAttempt.find(attemptsQuery)
      .select('userId practiceTestId testTitle score status completedAt startedAt attemptsCount batchId')
      .lean();

    const attemptsByUser = new Map();
    attempts.forEach(a => {
      const key = String(a.userId);
      if (!attemptsByUser.has(key)) attemptsByUser.set(key, []);
      attemptsByUser.get(key).push(a);
    });

    // 5) Compute per-student summaries
    const studentSummaries = students.map(s => {
      const sid = String(s._id);
      const batch = studentIdToBatch.get(sid) || null;
      const assignedActive = (batch?.assignedTests || []).filter(t => t && t.isActive !== false);
      const assignedActiveTestIds = assignedActive.map(t => String(t.testId));
      const totalAssignments = assignedActiveTestIds.length;

      const userAttempts = attemptsByUser.get(sid) || [];
      const completedAttempts = userAttempts.filter(a => a.status === 'completed');
      const completedUniqueTests = new Set(completedAttempts.map(a => String(a.practiceTestId)));
      const completedCount = completedUniqueTests.size;

      const bestScoreByTest = new Map();
      completedAttempts.forEach(a => {
        const tid = String(a.practiceTestId);
        const prev = bestScoreByTest.get(tid) || 0;
        if (typeof a.score === 'number' && a.score > prev) {
          bestScoreByTest.set(tid, a.score);
        }
      });
      const avgBestScore = average(Array.from(bestScoreByTest.values()));

      const lastActiveDate = userAttempts.reduce((max, a) => {
        const cand = a.completedAt || a.startedAt;
        if (!cand) return max;
        const d = new Date(cand);
        return !max || d > max ? d : max;
      }, null);

      // Derive course categories from assigned tests
      const categories = new Set();
      assignedActiveTestIds.forEach(tid => {
        const t = testIdToTest.get(tid);
        if (t?.category) categories.add(t.category);
      });
      const courseCategories = Array.from(categories);

      // Progress: proportion of assigned tests that have at least one completed attempt
      const progress = totalAssignments > 0
        ? Math.round((completedCount / totalAssignments) * 100)
        : 0;

      return {
        userId: s._id,
        name: `${s.firstName} ${s.lastName}`,
        email: s.email,
        studentId: s.studentId,
        isActive: s.isActive,
        batch: batch ? { _id: batch._id, name: batch.batchName } : null,
        primaryCourse: courseCategories.length === 1 ? courseCategories[0] : (courseCategories.length > 1 ? 'Multiple' : 'Unassigned'),
        courseCategories,
        assignments: { total: totalAssignments, completed: completedCount },
        progressPercent: progress,
        averageScore: Math.round(avgBestScore),
        lastActive: lastActiveDate || null
      };
    });

    // 6) Overall metrics
    const overallAssigned = studentSummaries.reduce((acc, s) => acc + s.assignments.total, 0);
    const overallCompleted = studentSummaries.reduce((acc, s) => acc + s.assignments.completed, 0);
    const avgProgress = average(studentSummaries.map(s => s.progressPercent));
    const completionRate = overallAssigned > 0 ? Math.round((overallCompleted / overallAssigned) * 100) : 0;

    // Active courses: count unique categories among active tests
    const activeTests = await PracticeTest.find({ isActive: true }).select('category').lean();
    const activeCourseCategories = new Set(activeTests.map(t => t.category).filter(Boolean));

    res.status(200).json({
      status: 'success',
      data: {
        summary: {
          totalStudents,
          activeCourses: activeCourseCategories.size,
          avgProgress: Math.round(avgProgress),
          completionRate
        },
        students: studentSummaries,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalStudents,
          totalPages: Math.ceil(totalStudents / limitNum)
        }
      }
    });
  } catch (err) {
    console.error('Error in getStudentsProgress:', err);
    res.status(500).json({ status: 'error', message: 'Failed to fetch student progress' });
  }
};

// GET /api/analytics/student/:userId/progress
// Admin-only: Detailed per-student progress with per-test breakdown and attempts
exports.getStudentProgressDetail = async (req, res) => {
  try {
    const { userId } = req.params;
    const uid = toObjectId(userId);
    if (!uid) {
      return res.status(400).json({ status: 'fail', message: 'Invalid userId' });
    }

    const user = await User.findById(uid).select('firstName lastName email studentId isActive').lean();
    if (!user) return res.status(404).json({ status: 'fail', message: 'User not found' });

    const batch = await Batch.findOne({ students: uid })
      .select('batchName assignedTests')
      .lean();

    const attempts = await TestAttempt.find({ userId: uid })
      .select('practiceTestId testTitle score status completedAt startedAt attemptsCount batchId')
      .sort({ completedAt: -1, startedAt: -1 })
      .lean();

    const testIds = Array.from(new Set(attempts.map(a => String(a.practiceTestId))));
    const tests = await PracticeTest.find({ _id: { $in: testIds } }).select('title category passingScore').lean();
    const testMap = new Map(tests.map(t => [String(t._id), t]));

    // Group attempts by test
    const byTest = new Map();
    attempts.forEach(a => {
      const tid = String(a.practiceTestId);
      if (!byTest.has(tid)) byTest.set(tid, []);
      byTest.get(tid).push(a);
    });

    const testsDetail = Array.from(byTest.entries()).map(([tid, arr]) => {
      const t = testMap.get(tid);
      const completed = arr.filter(a => a.status === 'completed');
      const bestScore = completed.length ? Math.max(...completed.map(a => a.score || 0)) : 0;
      const latest = arr[0] || null; // sorted desc
      // assignedAt from batch assignment if available
      let assignedAt = null;
      if (batch && Array.isArray(batch.assignedTests)) {
        const match = batch.assignedTests.find(x => String(x.testId) === tid);
        if (match && match.assignedAt) assignedAt = match.assignedAt;
      }
      return {
        testId: tid,
        title: t?.title || arr[0]?.testTitle || 'Test',
        category: t?.category || null,
        passingScore: t?.passingScore ?? null,
        attemptsCount: arr.length,
        bestScore,
        passed: t?.passingScore != null ? bestScore >= t.passingScore : null,
        latestScore: latest?.score ?? null,
        lastAttemptAt: latest?.completedAt || latest?.startedAt || null,
        assignedAt,
        attempts: arr.map(a => ({
          attemptId: a._id,
          status: a.status,
          score: a.score,
          attemptsCount: a.attemptsCount,
          startedAt: a.startedAt,
          completedAt: a.completedAt
        }))
      };
    });

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          _id: user._id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          studentId: user.studentId,
          isActive: user.isActive
        },
        batch: batch ? { name: batch.batchName } : null,
        tests: testsDetail
      }
    });
  } catch (err) {
    console.error('Error in getStudentProgressDetail:', err);
    res.status(500).json({ status: 'error', message: 'Failed to fetch student progress detail' });
  }
};

// GET /api/analytics/overview
// Admin-only: High-level metrics for Analytics page
exports.getOverviewAnalytics = async (req, res) => {
  try {
    const [totalStudents, activePracticeTests, totalCourses, totalBatches] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      PracticeTest.countDocuments({ isActive: true }),
      Course.countDocuments({}),
      Batch.countDocuments({})
    ]);

    // Completion rate across completed attempts vs total attempts for last 90 days
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const attempts = await TestAttempt.aggregate([
      { $match: { startedAt: { $gte: since } } },
      { $group: {
          _id: null,
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
        }
      }
    ]);
    const totals = attempts[0] || { total: 0, completed: 0 };
    const completionRate = totals.total > 0 ? Math.round((totals.completed / totals.total) * 100) : 0;

    // Monthly enrollments (approx): number of new students per month for last 6 months
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() });
    }
    const enrollments = await Promise.all(months.map(async (m) => {
      const start = new Date(m.year, m.month, 1);
      const end = new Date(m.year, m.month + 1, 1);
      const count = await User.countDocuments({ role: 'student', createdAt: { $gte: start, $lt: end } });
      return { month: start.toLocaleString('en-US', { month: 'short' }), enrollments: count };
    }));

    // Course distribution by category of active practice tests
    const activeTests = await PracticeTest.find({ isActive: true }).select('category').lean();
    const byCategory = new Map();
    activeTests.forEach(t => {
      if (!t.category) return;
      byCategory.set(t.category, (byCategory.get(t.category) || 0) + 1);
    });
    const courseDistribution = Array.from(byCategory.entries()).map(([name, value]) => ({ name, value }));

    // Exam results: summarize pass/fail by test category for last 60 days
    const since60 = new Date();
    since60.setDate(since60.getDate() - 60);
    const recentAttempts = await TestAttempt.aggregate([
      { $match: { completedAt: { $gte: since60 }, status: 'completed' } },
      { $lookup: { from: 'practicetests', localField: 'practiceTestId', foreignField: '_id', as: 'test' } },
      { $unwind: '$test' },
      { $group: {
          _id: '$test.category',
          total: { $sum: 1 },
          passed: { $sum: { $cond: ['$passed', 1, 0] } },
          failed: { $sum: { $cond: ['$passed', 0, 1] } }
        }
      }
    ]);
    const exams = recentAttempts.map(e => ({ exam: e._id || 'General', passed: e.passed, failed: e.failed, total: e.total }));

    res.status(200).json({
      status: 'success',
      data: {
        metrics: {
          totalStudents,
          activeCourses: totalCourses,
          activePracticeTests,
          completionRate,
          totalBatches
        },
        enrollmentData: enrollments,
        courseDistribution,
        examResults: exams
      }
    });
  } catch (err) {
    console.error('Error in getOverviewAnalytics:', err);
    res.status(500).json({ status: 'error', message: 'Failed to fetch analytics overview' });
  }
};

// GET /api/analytics/dashboard
// Student dashboard analytics
exports.getStudentDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get user's batch information
    const userBatch = await Batch.findOne({
      students: userId,
      status: 'active'
    }).select('batchName batchId assignedTests');

    // Get user's test attempts
    const testAttempts = await TestAttempt.find({ 
      userId: userId,
      status: 'completed'
    }).populate('practiceTestId', 'title category');

    // Calculate statistics
    const totalTests = testAttempts.length;
    const passedTests = testAttempts.filter(attempt => attempt.passed).length;
    const successRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
    
    // Calculate average score
    const totalScore = testAttempts.reduce((sum, attempt) => sum + attempt.score, 0);
    const averageScore = totalTests > 0 ? Math.round(totalScore / totalTests) : 0;

    // Get recent activity
    const recentAttempts = testAttempts
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
      .slice(0, 5)
      .map(attempt => ({
        testTitle: attempt.practiceTestId?.title || 'Unknown Test',
        score: attempt.score,
        passed: attempt.passed,
        completedAt: attempt.completedAt
      }));

    res.status(200).json({
      status: 'success',
      data: {
        batch: userBatch ? {
          name: userBatch.batchName,
          id: userBatch.batchId,
          enrolled: true,
          assignedTests: userBatch.assignedTests?.length || 0
        } : {
          enrolled: false,
          name: null,
          id: null,
          assignedTests: 0
        },
        statistics: {
          totalTests,
          passedTests,
          successRate,
          averageScore
        },
        recentActivity: recentAttempts
      }
    });
  } catch (err) {
    console.error('Error in getStudentDashboard:', err);
    res.status(500).json({ status: 'error', message: 'Failed to fetch student dashboard data' });
  }
};

