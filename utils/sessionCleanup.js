/**
 * Session cleanup utility
 * Periodically cleans up expired sessions to prevent database bloat
 */

const { UserSession } = require('../models');
const cron = require('node-cron');

// Clean up expired sessions every 5 minutes
const cleanupExpiredSessions = async () => {
  try {
    const result = await UserSession.update(
      { isActive: false },
      {
        where: {
          isActive: true,
          expiresAt: { [require('sequelize').Op.lt]: new Date() }
        }
      }
    );
    
    if (result[0] > 0) {
      console.log(`🧹 Cleaned up ${result[0]} expired sessions`);
    }
  } catch (error) {
    console.error('Session cleanup error:', error);
  }
};

// Run cleanup every 5 minutes
const startSessionCleanup = () => {
  cron.schedule('*/5 * * * *', cleanupExpiredSessions);
  console.log('🕐 Session cleanup job started (every 5 minutes)');
};

module.exports = {
  cleanupExpiredSessions,
  startSessionCleanup
};
