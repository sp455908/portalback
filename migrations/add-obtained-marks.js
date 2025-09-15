const { sequelize } = require('../config/database');

async function addObtainedMarksColumn() {
  try {
    console.log('Adding obtainedMarks and testSettingsSnapshot columns to TestAttempts table...');
    
    // Add the obtainedMarks column
    await sequelize.query(`
      ALTER TABLE TestAttempts 
      ADD COLUMN obtainedMarks INTEGER DEFAULT 0
    `);
    
    // Add the testSettingsSnapshot column
    await sequelize.query(`
      ALTER TABLE TestAttempts 
      ADD COLUMN testSettingsSnapshot JSON
    `);
    
    console.log('Columns added successfully!');
    
    // Update existing records to calculate obtainedMarks from answers
    console.log('Updating existing records...');
    
    const [results] = await sequelize.query(`
      SELECT ta.id, ta.answers, ta.questionsAsked, ta.practiceTestId, pt.questions as testQuestions
      FROM TestAttempts ta
      LEFT JOIN PracticeTests pt ON ta.practiceTestId = pt.id
      WHERE ta.answers IS NOT NULL AND JSON_LENGTH(ta.answers) > 0
    `);
    
    for (const record of results) {
      try {
        const answers = JSON.parse(record.answers);
        const obtainedMarks = answers.reduce((sum, answer) => {
          const awarded = typeof answer.marksAwarded === 'number' ? answer.marksAwarded : 0;
          return sum + awarded;
        }, 0);
        
        // Create testSettingsSnapshot for existing records
        let testSettingsSnapshot = null;
        if (record.questionsAsked && record.testQuestions) {
          const questionsAsked = JSON.parse(record.questionsAsked);
          const testQuestions = JSON.parse(record.testQuestions);
          
          testSettingsSnapshot = {
            questions: questionsAsked.map(idx => ({
              index: idx,
              marks: testQuestions[idx]?.marks ?? 1,
              negativeMarks: testQuestions[idx]?.negativeMarks ?? 0
            })),
            snapshotDate: new Date().toISOString(),
            migrated: true
          };
        }
        
        await sequelize.query(`
          UPDATE TestAttempts 
          SET obtainedMarks = ?, testSettingsSnapshot = ?
          WHERE id = ?
        `, {
          replacements: [obtainedMarks, JSON.stringify(testSettingsSnapshot), record.id]
        });
      } catch (err) {
        console.error(`Error updating record ${record.id}:`, err.message);
      }
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await sequelize.close();
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  addObtainedMarksColumn();
}

module.exports = addObtainedMarksColumn;
