export const notFound = (req, res, next) => {
  const err = new Error(`Route not found - ${req.originalUrl}`);
  res.status(404);
  next(err);
};

export const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal server error",
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};