

exports.healthCheck = async (req, res) => {
  try {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development',
      version: process.version
    };

    res.status(200).json({
      status: 'success',
      data: health
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message
    });
  }
};

exports.detailedHealthCheck = async (req, res) => {
  try {
    const { sequelize } = require('../config/database');
    
    
    let dbStatus = 'unknown';
    try {
      await sequelize.authenticate();
      dbStatus = 'connected';
    } catch (dbError) {
      dbStatus = 'disconnected';
      console.error('Database connection failed:', dbError);
    }

    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development',
      version: process.version,
      database: {
        status: dbStatus,
        dialect: sequelize.getDialect()
      },
      services: {
        captcha: 'available',
        maintenance: 'available'
      }
    };

    res.status(200).json({
      status: 'success',
      data: health
    });
  } catch (error) {
    console.error('Detailed health check failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Detailed health check failed',
      error: error.message
    });
  }
};