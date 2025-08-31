require('dotenv').config();
const { sequelize, Course, User } = require('./models');

async function testCourseUpdate() {
  try {
    console.log('Testing database connection...');
    await sequelize.authenticate();
    console.log('✅ Database connection successful');
    
    console.log('\nTesting Course model...');
    const courseCount = await Course.count();
    console.log(`✅ Course count: ${courseCount}`);
    
    if (courseCount > 0) {
      console.log('\nTesting Course findOne...');
      const course = await Course.findOne({
        include: [{
          model: User,
          as: 'instructor',
          attributes: ['firstName', 'lastName', 'email']
        }]
      });
      
      if (course) {
        console.log('✅ Course found:', {
          id: course.id,
          title: course.title,
          instructor: course.instructor
        });
        
        console.log('\nTesting Course update...');
        const updateResult = await course.update({
          title: course.title // Update with same title to test
        });
        console.log('✅ Course update successful:', updateResult.toJSON());
        
        console.log('\nTesting Course findByPk after update...');
        const updatedCourse = await Course.findByPk(course.id, {
          include: [{
            model: User,
            as: 'instructor',
            attributes: ['firstName', 'lastName', 'email']
          }]
        });
        
        if (updatedCourse) {
          console.log('✅ Updated course retrieved:', {
            id: updatedCourse.id,
            title: updatedCourse.title,
            instructor: updatedCourse.instructor
          });
        } else {
          console.log('❌ Failed to retrieve updated course');
        }
      } else {
        console.log('❌ No courses found in database');
      }
    } else {
      console.log('❌ No courses in database to test with');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error stack:', error.stack);
  } finally {
    await sequelize.close();
    console.log('\nDatabase connection closed');
  }
}

testCourseUpdate(); 