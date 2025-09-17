const { User, Batch, PracticeTest, TestAttempt, Course } = require('../models');
const { sequelize } = require('../config/database');
const { Op, QueryTypes } = require('sequelize');


function average(numbers) {
  if (!numbers || numbers.length === 0) return 0;
  const sum = numbers.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  return Math.round((sum / numbers.length) * 100) / 100;
}



exports.getStudentsProgress = async (req, res) => {
  try {
    const { search = '', batchId, testId, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    
    const userQuery = { role: 'student' };
    if (search) {
      userQuery[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { studentId: { [Op.iLike]: `%${search}%` } }
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

    
    const attemptWhere = { userId: studentIds };
    if (testId) attemptWhere.practiceTestId = testId;
    const attempts = studentIds.length
      ? await TestAttempt.findAll({
          where: attemptWhere,
          attributes: ['userId', 'practiceTestId', 'score', 'status', 'completedAt', 'startedAt'],
          order: [['completedAt', 'DESC'], ['startedAt', 'DESC']]
        })
      : [];

    
    const userIdToAttempts = new Map();
    attempts.forEach(a => {
      const key = String(a.userId);
      if (!userIdToAttempts.has(key)) userIdToAttempts.set(key, []);
      userIdToAttempts.get(key).push(a);
    });

    
    
    let batchAssignedTests = [];
    if (studentIds.length) {
      
      const userBatchRows = await sequelize.query(
        `SELECT DISTINCT bs."userId" AS "userId", bs."batchId" AS "batchId"
         FROM "BatchStudents" bs
         WHERE bs."userId" IN (:studentIds)`,
        { replacements: { studentIds }, type: QueryTypes.SELECT }
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
          { replacements: { batchIds: allBatchIds }, type: QueryTypes.SELECT }
        );
      }

      
      var userIdToAssignedTestIds = new Map();
      students.forEach(s => {
        const uid = String(s.id);
        const batches = Array.from(userIdToBatchIds.get(uid) || []);
        const assigned = batchAssignedTests.filter(x => batches.includes(x.batchId)).map(x => x.testId);
        userIdToAssignedTestIds.set(uid, Array.from(new Set(assigned)));
      });

      
      const summaries = students.map(s => {
        const uid = String(s.id);
        const userAttempts = userIdToAttempts.get(uid) || [];
        const completedAttempts = userAttempts.filter(a => a.status === 'completed');

        
        const averageScore = completedAttempts.length
          ? Math.round(
              completedAttempts.reduce((acc, a) => acc + (Number(a.score) || 0), 0) / completedAttempts.length
            )
          : 0;

        
        const lastAttempt = userAttempts.length ? userAttempts[0] : null;
        const lastActive = lastAttempt ? (lastAttempt.completedAt || lastAttempt.startedAt) : null;

        
        const assignedTestIds = userIdToAssignedTestIds.get(uid) || [];
        const totalAssigned = assignedTestIds.length;
        const completedDistinct = new Set(
          completedAttempts
            .filter(a => assignedTestIds.includes(a.practiceTestId))
            .map(a => String(a.practiceTestId))
        ).size;

        
        const progressPercent = totalAssigned > 0
          ? Math.round((completedDistinct / totalAssigned) * 100)
          : averageScore;

        
        const assignedCategories = new Set(
          batchAssignedTests
            .filter(x => (userIdToAssignedTestIds.get(uid) || []).includes(x.testId))
            .map(x => x.category)
            .filter(Boolean)
        );
        
        const courseCategories = Array.from(assignedCategories);

        
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



exports.getStudentProgressDetail = async (req, res) => {
  try {
    const { userId } = req.params;
    const uidRaw = userId;
    if (!uidRaw) {
      return res.status(400).json({ status: 'fail', message: 'Invalid userId' });
    }
    const uid = /^\d+$/.test(String(uidRaw)) ? Number(uidRaw) : String(uidRaw);

    const user = await User.findByPk(uid, {
      attributes: ['id', 'firstName', 'lastName', 'email', 'studentId', 'isActive']
    });
    if (!user) return res.status(404).json({ status: 'fail', message: 'User not found' });

    
    let batch = null;
    const batchRows = await sequelize.query(
      `SELECT b."batchName" AS "batchName"\n       FROM "BatchStudents" bs\n       INNER JOIN "Batches" b ON b.id = bs."batchId"\n       WHERE bs."userId" = :uid\n       ORDER BY bs."createdAt" DESC\n       LIMIT 1`,
      { replacements: { uid }, type: QueryTypes.SELECT }
    );
    if (batchRows && batchRows.length > 0) {
      batch = { batchName: batchRows[0].batchName };
    }

    const attempts = await TestAttempt.findAll({
      where: { userId: uid },
      attributes: ['id', 'practiceTestId', 'testTitle', 'score', 'status', 'completedAt', 'startedAt', 'attemptsCount', 'batchId'],
      order: [['completedAt', 'DESC'], ['startedAt', 'DESC']]
    });

    const testIds = Array.from(new Set(attempts.map(a => a.practiceTestId)));
    const normalizedIds = testIds
      .map(t => Number(t))
      .filter((n) => Number.isFinite(n));
    const tests = normalizedIds.length ? await PracticeTest.findAll({
      where: {
        id: {
          [Op.in]: normalizedIds
        }
      },
      attributes: ['id', 'title', 'category', 'passingScore']
    }) : [];
    const testMap = new Map(tests.map(t => [String(t.id), t]));

    
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
      const latest = arr[0] || null; 
      
      let assignedAt = null; 
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



exports.getOverviewAnalytics = async (req, res) => {
  try {
    const [totalStudents, activePracticeTests, totalCourses, totalBatches] = await Promise.all([
      User.count({ where: { role: 'student' } }),
      PracticeTest.count({ where: { isActive: true } }),
      Course.count({}),
      Batch.count({})
    ]);

    
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const attempts = await TestAttempt.findAll({
      where: {
        startedAt: {
          [Op.gte]: since
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
            [Op.gte]: start,
            [Op.lt]: end
          }
        }
      });
      return { month: start.toLocaleString('en-US', { month: 'short' }), enrollments: count };
    }));

    
    const activeTests = await PracticeTest.findAll({ where: { isActive: true } });
    const byCategory = new Map();
    activeTests.forEach(t => {
      if (!t.category) return;
      byCategory.set(t.category, (byCategory.get(t.category) || 0) + 1);
    });
    const courseDistribution = Array.from(byCategory.entries()).map(([name, value]) => ({ name, value }));

    
    const since60 = new Date();
    since60.setDate(since60.getDate() - 60);
    const recentAttempts = await TestAttempt.findAll({
      where: {
        completedAt: {
          [Op.gte]: since60
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
      group: ['test.id', 'test.category']
    });
    const examsByCategory = new Map();
    recentAttempts.forEach((e) => {
      const cat = e.test?.category || 'General';
      const prev = examsByCategory.get(cat) || { exam: cat, passed: 0, failed: 0, total: 0 };
      const total = Number(e.get('total')) || 0;
      const passed = Number(e.get('passed')) || 0;
      const failed = Number(e.get('failed')) || 0;
      examsByCategory.set(cat, {
        exam: cat,
        passed: prev.passed + passed,
        failed: prev.failed + failed,
        total: prev.total + total
      });
    });
    const exams = Array.from(examsByCategory.values());

    // Average progress approximation: average score of completed attempts in last 60 days
    const recentScores = await TestAttempt.findAll({
      where: {
        completedAt: { [Op.gte]: since60 },
        status: 'completed'
      },
      attributes: ['score']
    });
    const avgProgress = recentScores.length
      ? Math.round(
          (recentScores.reduce((acc, a) => acc + (Number(a.score) || 0), 0) / recentScores.length)
        )
      : 0;

    res.status(200).json({
      status: 'success',
      data: {
        metrics: {
          totalStudents,
          activeCourses: totalCourses,
          activePracticeTests,
          completionRate,
          avgProgress,
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



exports.getStudentDashboard = async (req, res) => {
  try {
    const userId = req.user.id; 
    
    
    const userBatch = await Batch.findOne({
      where: {
        id: userId,
        status: 'active'
      },
      attributes: ['batchName', 'batchId', 'assignedTests']
    });

    
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

    
    const totalTests = testAttempts.length;
    const passedTests = testAttempts.filter(attempt => attempt.passed).length;
    const successRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
    
    
    const totalScore = testAttempts.reduce((sum, attempt) => sum + attempt.score, 0);
    const averageScore = totalTests > 0 ? Math.round(totalScore / totalTests) : 0;

    
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

