// Centralized error handling middleware for Express

module.exports = (err, req, res, next) => {
  // Set default status code and message
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  // Log error in development
  if (process.env.NODE_ENV !== "production") {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    // Optionally include stack trace in development
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
};