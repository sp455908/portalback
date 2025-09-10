const { sequelize } = require('./config/database');
const Batch = require('./models/batch.model');
const PracticeTest = require('./models/practiceTest.model');
const BatchAssignedTest = require('./models/batchAssignedTest.model');

async function debugBatches() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Database connected successfully.');

    // Check if there are any test assignments
    console.log('\n=== Checking BatchAssignedTests table ===');
    const assignedTests = await BatchAssignedTest.findAll({
      include: [
        {
          model: PracticeTest,
          attributes: ['id', 'title', 'description']
        }
      ]
    });
    console.log('Found assigned tests:', assignedTests.length);
    assignedTests.forEach((assignment, index) => {
      console.log(`Assignment ${index + 1}:`, {
        id: assignment.id,
        batchId: assignment.batchId,
        testId: assignment.testId,
        testTitle: assignment.PracticeTest?.title || 'No title',
        testDescription: assignment.PracticeTest?.description || 'No description'
      });
    });

    // Check batches with their assigned tests
    console.log('\n=== Checking Batches with assigned tests ===');
    const batches = await Batch.findAll({
      include: [
        {
          model: PracticeTest,
          as: 'assignedTests',
          attributes: ['id', 'title', 'description', 'targetUserType', 'duration', 'passingScore', 'questionsPerTest', 'totalQuestions', 'category'],
          through: { attributes: ['dueDate', 'instructions', 'assignedAt', 'assignedBy', 'isActive'] }
        }
      ]
    });

    console.log('Found batches:', batches.length);
    batches.forEach((batch, index) => {
      console.log(`\nBatch ${index + 1}: ${batch.batchName} (${batch.batchId})`);
      console.log('  Assigned tests:', batch.assignedTests?.length || 0);
      if (batch.assignedTests && batch.assignedTests.length > 0) {
        batch.assignedTests.forEach((test, testIndex) => {
          console.log(`    Test ${testIndex + 1}:`, {
            id: test.id,
            title: test.title,
            description: test.description,
            targetUserType: test.targetUserType
          });
        });
      }
    });

    // Check practice tests
    console.log('\n=== Checking PracticeTests table ===');
    const practiceTests = await PracticeTest.findAll({
      attributes: ['id', 'title', 'description', 'targetUserType', 'isActive']
    });
    console.log('Found practice tests:', practiceTests.length);
    practiceTests.forEach((test, index) => {
      console.log(`Test ${index + 1}:`, {
        id: test.id,
        title: test.title,
        description: test.description,
        targetUserType: test.targetUserType,
        isActive: test.isActive
      });
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

debugBatches();