const { User, Batch, PracticeTest, TestAttempt, Course } = require('../models');
const { sequelize } = require('../config/database');

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

    // 1) Load students (filterable)
    const userQuery = { role: 'student' };
    if (search) {
      userQuery[sequelize.Op.or] = [
        { firstName: { [sequelize.Op.iLike]: `%${search}%` } },
        { lastName: { [sequelize.Op.iLike]: `%${search}%` } },
        { email: { [sequelize.Op.iLike]: `%${search}%` } },
        { studentId: { [sequelize.Op.iLike]: `%${search}%` } }
      ];
    }

    const totalStudents = await User.count({ where: userQuery });
    const students = await User.findAll({
      where: userQuery,
      attributes: ['id', 'firstName', 'lastName', 'email', 'studentId', 'isActive', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: limitNum,
      offset: (pageNum - 1) * limitNum
    });

    const studentIds = students.map(s => s.id);

    // 2) Fetch per-student attempts (optional filter by testId)
    const attemptWhere = { userId: studentIds };
    if (testId) attemptWhere.practiceTestId = testId;
    const attempts = studentIds.length
      ? await TestAttempt.findAll({
          where: attemptWhere,
          attributes: ['userId', 'practiceTestId', 'score', 'status', 'completedAt', 'startedAt'],
          order: [['completedAt', 'DESC'], ['startedAt', 'DESC']]
        })
      : [];

    // Group attempts by user
    const userIdToAttempts = new Map();
    attempts.forEach(a => {
      const key = String(a.userId);
      if (!userIdToAttempts.has(key)) userIdToAttempts.set(key, []);
      userIdToAttempts.get(key).push(a);
    });

    // 3) Fetch batch assignments -> number of assigned tests per user
    // Derive user's batches then tests assigned to those batches
    let batchAssignedTests = [];
    if (studentIds.length) {
      // get batchIds for all students
      const userBatchRows = await sequelize.query(
        `SELECT DISTINCT bs."userId" AS "userId", bs."batchId" AS "batchId"
         FROM "BatchStudents" bs
         WHERE bs."userId" IN (:studentIds)`,
        { replacements: { studentIds }, type: sequelize.QueryTypes.SELECT }
      );

      const userIdToBatchIds = new Map();
      userBatchRows.forEach(r => {
        const uid = String(r.userId);
        if (!userIdToBatchIds.has(uid)) userIdToBatchIds.set(uid, new Set());
        userIdToBatchIds.get(uid).add(r.batchId);
      });

      const allBatchIds = Array.from(new Set(userBatchRows.map(r => r.batchId)));
      if (allBatchIds.length) {
        batchAssignedTests = await sequelize.query(
          `SELECT bat."batchId" AS "batchId", bat."testId" AS "testId", pt."category" AS "category", pt."title" AS "title"
           FROM "BatchAssignedTests" bat
           INNER JOIN "PracticeTests" pt ON pt.id = bat."testId"
           WHERE bat."batchId" IN (:batchIds) AND (pt."isActive" = true)`,
          { replacements: { batchIds: allBatchIds }, type: sequelize.QueryTypes.SELECT }
        );
      }

      // Map: user -> assigned testIds (via their batches)
      var userIdToAssignedTestIds = new Map();
      students.forEach(s => {
        const uid = String(s.id);
        const batches = Array.from(userIdToBatchIds.get(uid) || []);
        const assigned = batchAssignedTests.filter(x => batches.includes(x.batchId)).map(x => x.testId);
        userIdToAssignedTestIds.set(uid, Array.from(new Set(assigned)));
      });

      // 4) Compute per-student aggregates
      const summaries = students.map(s => {
        const uid = String(s.id);
        const userAttempts = userIdToAttempts.get(uid) || [];
        const completedAttempts = userAttempts.filter(a => a.status === 'completed');

        // Average score over completed attempts
        const averageScore = completedAttempts.length
          ? Math.round(
              completedAttempts.reduce((acc, a) => acc + (Number(a.score) || 0), 0) / completedAttempts.length
            )
          : 0;

        // Last active time
        const lastAttempt = userAttempts.length ? userAttempts[0] : null;
        const lastActive = lastAttempt ? (lastAttempt.completedAt || lastAttempt.startedAt) : null;

        // Assignments based on batch assigned tests
        const assignedTestIds = userIdToAssignedTestIds.get(uid) || [];
        const totalAssigned = assignedTestIds.length;
        const completedDistinct = new Set(
          completedAttempts
            .filter(a => assignedTestIds.includes(a.practiceTestId))
            .map(a => String(a.practiceTestId))
        ).size;

        // Progress percent: if there are assignments, completed/total * 100; otherwise use avg score as proxy
        const progressPercent = totalAssigned > 0
          ? Math.round((completedDistinct / totalAssigned) * 100)
          : averageScore;

        // Course categories: union of categories from assigned tests and attempted tests
        const assignedCategories = new Set(
          batchAssignedTests
            .filter(x => (userIdToAssignedTestIds.get(uid) || []).includes(x.testId))
            .map(x => x.category)
            .filter(Boolean)
        );
        // If we want to include attempted categories too, we need their tests; fallback to assigned
        const courseCategories = Array.from(assignedCategories);

        // Primary course: pick first category if available
        const primaryCourse = courseCategories.length ? courseCategories[0] : 'Unassigned';

        return {
          userId: s.id,
          name: `${s.firstName} ${s.lastName}`.trim(),
          email: s.email,
          studentId: s.studentId,
          isActive: s.isActive,
          batch: null,
          primaryCourse,
          courseCategories,
          assignments: { total: totalAssigned, completed: completedDistinct },
          progressPercent,
          averageScore,
          lastActive
        };
      });

      // Summary metrics
      const totalCourses = await Course.count();
      const avgProgress = summaries.length
        ? Math.round(summaries.reduce((acc, s) => acc + (Number(s.progressPercent) || 0), 0) / summaries.length)
        : 0;
      const completionFractions = summaries
        .filter(s => s.assignments.total > 0)
        .map(s => s.assignments.completed / s.assignments.total);
      const completionRate = completionFractions.length
        ? Math.round((completionFractions.reduce((a, b) => a + b, 0) / completionFractions.length) * 100)
        : 0;

      return res.status(200).json({
        status: 'success',
        data: {
          summary: {
            totalStudents,
            activeCourses: totalCourses,
            avgProgress,
            completionRate
          },
          students: summaries,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalStudents,
            totalPages: Math.ceil(totalStudents / limitNum)
          }
        }
      });
    }

    // If no students, return empty
    const totalCourses = await Course.count();
    return res.status(200).json({
      status: 'success',
      data: {
        summary: {
          totalStudents: 0,
          activeCourses: totalCourses,
          avgProgress: 0,
          completionRate: 0
        },
        students: [],
        pagination: { page: pageNum, limit: limitNum, total: 0, totalPages: 0 }
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
    const uid = userId; // Sequelize uses 'id' for primary key
    if (!uid) {
      return res.status(400).json({ status: 'fail', message: 'Invalid userId' });
    }

    const user = await User.findByPk(uid, {
      attributes: ['id', 'firstName', 'lastName', 'email', 'studentId', 'isActive']
    });
    if (!user) return res.status(404).json({ status: 'fail', message: 'User not found' });

    const batch = await Batch.findOne({
      where: {
        id: uid
      },
      attributes: ['batchName', 'assignedTests']
    });

    const attempts = await TestAttempt.findAll({
      where: { userId: uid },
      attributes: ['practiceTestId', 'testTitle', 'score', 'status', 'completedAt', 'startedAt', 'attemptsCount', 'batchId'],
      order: [['completedAt', 'DESC'], ['startedAt', 'DESC']]
    });

    const testIds = Array.from(new Set(attempts.map(a => String(a.practiceTestId))));
    const tests = await PracticeTest.findAll({
      where: {
        id: {
          [sequelize.Op.in]: testIds
        }
      },
      attributes: ['id', 'title', 'category', 'passingScore']
    });
    const testMap = new Map(tests.map(t => [String(t.id), t]));

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
          attemptId: a.id,
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
          _id: user.id,
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
      User.count({ where: { role: 'student' } }),
      PracticeTest.count({ where: { isActive: true } }),
      Course.count({}),
      Batch.count({})
    ]);

    // Completion rate across completed attempts vs total attempts for last 90 days
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const attempts = await TestAttempt.findAll({
      where: {
        startedAt: {
          [sequelize.Op.gte]: since
        }
      },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('*')), 'total'],
        [sequelize.fn('SUM', sequelize.literal('CASE WHEN status = \'completed\' THEN 1 ELSE 0 END')), 'completed']
      ],
      group: []
    });
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
      const count = await User.count({
        where: {
          role: 'student',
          createdAt: {
            [sequelize.Op.gte]: start,
            [sequelize.Op.lt]: end
          }
        }
      });
      return { month: start.toLocaleString('en-US', { month: 'short' }), enrollments: count };
    }));

    // Course distribution by category of active practice tests
    const activeTests = await PracticeTest.findAll({ where: { isActive: true } });
    const byCategory = new Map();
    activeTests.forEach(t => {
      if (!t.category) return;
      byCategory.set(t.category, (byCategory.get(t.category) || 0) + 1);
    });
    const courseDistribution = Array.from(byCategory.entries()).map(([name, value]) => ({ name, value }));

    // Exam results: summarize pass/fail by test category for last 60 days
    const since60 = new Date();
    since60.setDate(since60.getDate() - 60);
    const recentAttempts = await TestAttempt.findAll({
      where: {
        completedAt: {
          [sequelize.Op.gte]: since60
        },
        status: 'completed'
      },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('*')), 'total'],
        [sequelize.fn('SUM', sequelize.literal('CASE WHEN passed = true THEN 1 ELSE 0 END')), 'passed'],
        [sequelize.fn('SUM', sequelize.literal('CASE WHEN passed = false THEN 1 ELSE 0 END')), 'failed']
      ],
      include: [{
        model: PracticeTest,
        as: 'test',
        attributes: ['category']
      }],
      group: ['test.category']
    });
    const exams = recentAttempts.map(e => ({ exam: e.test?.category || 'General', passed: e.passed, failed: e.failed, total: e.total }));

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
    const userId = req.user.id; // Sequelize uses 'id' for primary key
    
    // Get user's batch information
    const userBatch = await Batch.findOne({
      where: {
        id: userId,
        status: 'active'
      },
      attributes: ['batchName', 'batchId', 'assignedTests']
    });

    // Get user's test attempts
    const testAttempts = await TestAttempt.findAll({ 
      where: { 
        userId: userId,
        status: 'completed'
      },
      attributes: ['practiceTestId', 'testTitle', 'score', 'passed'],
      include: [{
        model: PracticeTest,
        as: 'practiceTestId',
        attributes: ['title', 'category']
      }]
    });

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

