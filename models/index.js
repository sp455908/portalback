const { sequelize } = require('../config/database');

// Import all models
const User = require('./user.model');
const Course = require('./course.model');
const Enrollment = require('./enrollment.model');
const Application = require('./application.model');
const Alert = require('./alert.model');
const Exam = require('./exam.model');
const Material = require('./material.model');
const PracticeTest = require('./practiceTest.model');
const Batch = require('./batch.model');
const BatchStudent = require('./batchStudent.model');
const BatchAssignedTest = require('./batchAssignedTest.model');
const Settings = require('./settings.model');
const SecurityViolation = require('./securityViolation.model');
const TestAttempt = require('./testAttempt.model');
const UserTestCooldown = require('./userTestCooldown.model');
const Counter = require('./counter.model');
const LoginAttempt = require('./loginAttempt.model');
const UserSession = require('./userSession.model');

// Define associations
// User associations
User.hasMany(Course, { foreignKey: 'instructorId', as: 'courses' });
User.hasMany(Enrollment, { foreignKey: 'userId', as: 'enrollments' });
User.hasMany(Application, { foreignKey: 'userId', as: 'applications' });
User.hasMany(TestAttempt, { foreignKey: 'userId', as: 'testAttempts' });
User.hasMany(UserTestCooldown, { foreignKey: 'userId', as: 'testCooldowns' });
User.hasMany(SecurityViolation, { foreignKey: 'userId', as: 'securityViolations' });
User.hasMany(Batch, { foreignKey: 'adminId', as: 'administeredBatches' });
User.hasMany(UserTestCooldown, { foreignKey: 'setBy', as: 'setCooldowns' });
User.hasMany(LoginAttempt, { foreignKey: 'userId', as: 'loginAttempts' });
User.hasMany(UserSession, { foreignKey: 'userId', as: 'sessions' });

// Course associations
Course.belongsTo(User, { foreignKey: 'instructorId', as: 'instructor' });
Course.hasMany(Enrollment, { foreignKey: 'courseId', as: 'enrollments' });
Course.hasMany(Material, { foreignKey: 'courseId', as: 'materials' });
Course.hasMany(Exam, { foreignKey: 'courseId', as: 'exams' });
Course.hasMany(PracticeTest, { foreignKey: 'courseId', as: 'practiceTests' });

// Enrollment associations
Enrollment.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Enrollment.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });

// Application associations
Application.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// TestAttempt associations
TestAttempt.belongsTo(User, { foreignKey: 'userId', as: 'user' });
TestAttempt.belongsTo(PracticeTest, { foreignKey: 'practiceTestId', as: 'test' });
TestAttempt.hasMany(SecurityViolation, { foreignKey: 'testAttemptId', as: 'securityViolations' });

// UserTestCooldown associations
UserTestCooldown.belongsTo(User, { foreignKey: 'userId', as: 'user' });
UserTestCooldown.belongsTo(User, { foreignKey: 'setBy', as: 'setByUser' });
UserTestCooldown.belongsTo(PracticeTest, { foreignKey: 'testId', as: 'test' });

// SecurityViolation associations
SecurityViolation.belongsTo(User, { foreignKey: 'userId', as: 'user' });
SecurityViolation.belongsTo(TestAttempt, { foreignKey: 'testAttemptId', as: 'testAttempt' });
SecurityViolation.belongsTo(PracticeTest, { foreignKey: 'practiceTestId', as: 'practiceTest' });

// LoginAttempt associations
LoginAttempt.belongsTo(User, { foreignKey: 'userId', as: 'user' });
LoginAttempt.belongsTo(User, { foreignKey: 'unblockedBy', as: 'unblockedByUser' });

// UserSession associations
UserSession.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Material associations
Material.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });
Material.belongsTo(User, { foreignKey: 'uploadedBy', as: 'uploader' });

// Exam associations
Exam.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });
Exam.belongsTo(User, { foreignKey: 'instructorId', as: 'instructor' });

// PracticeTest associations
PracticeTest.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });
PracticeTest.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
PracticeTest.hasMany(TestAttempt, { foreignKey: 'practiceTestId', as: 'attempts' });
PracticeTest.hasMany(UserTestCooldown, { foreignKey: 'testId', as: 'cooldowns' });
PracticeTest.hasMany(SecurityViolation, { foreignKey: 'practiceTestId', as: 'securityViolations' });

// Batch associations
Batch.belongsTo(User, { foreignKey: 'adminId', as: 'admin' });

// Many-to-many relationship between Batch and User (students)
Batch.belongsToMany(User, { 
  through: BatchStudent, 
  foreignKey: 'batchId', 
  otherKey: 'userId',
  as: 'students' 
});
User.belongsToMany(Batch, { 
  through: BatchStudent, 
  foreignKey: 'userId', 
  otherKey: 'batchId',
  as: 'enrolledBatches' 
});

// Many-to-many relationship between Batch and PracticeTest (assignedTests)
Batch.belongsToMany(PracticeTest, { 
  through: BatchAssignedTest, 
  foreignKey: 'batchId', 
  otherKey: 'testId',
  as: 'assignedTests' 
});
PracticeTest.belongsToMany(Batch, { 
  through: BatchAssignedTest, 
  foreignKey: 'testId', 
  otherKey: 'batchId',
  as: 'assignedToBatches' 
});

// Junction table associations
BatchStudent.belongsTo(Batch, { foreignKey: 'batchId', as: 'Batch' });
BatchStudent.belongsTo(User, { foreignKey: 'userId', as: 'User' });
BatchAssignedTest.belongsTo(Batch, { foreignKey: 'batchId' });
BatchAssignedTest.belongsTo(PracticeTest, { foreignKey: 'testId' });
BatchAssignedTest.belongsTo(User, { foreignKey: 'assignedBy', as: 'assignedByUser' });

// Export all models
module.exports = {
  sequelize,
  User,
  Course,
  Enrollment,
  Application,
  Alert,
  Exam,
  Material,
  PracticeTest,
  Batch,
  BatchStudent,
  BatchAssignedTest,
  Settings,
  SecurityViolation,
  TestAttempt,
  UserTestCooldown,
  Counter,
  LoginAttempt,
  UserSession
}; 