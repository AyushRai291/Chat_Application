export const notFound = (req, res, next) => {
  const err = new Error(`Route not found - ${req.originalUrl}`);
  res.status(404);
  next(err);
};

export const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message || "Internal server error";

  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid resource ID";
  }

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((error) => error.message)
      .join(", ");
  }

  if (err.code === 11000) {
    statusCode = 409;
    const duplicateField = Object.keys(err.keyPattern || {})[0] || "field";
    message = `${duplicateField} already exists`;
  }

  if (err.name === "MulterError") {
    statusCode = 400;

    if (err.code === "LIMIT_FILE_COUNT") {
      message = "Maximum 5 files allowed.";
    }

    if (err.code === "LIMIT_FILE_SIZE") {
      statusCode = 413;
      message = "File size cannot exceed 10MB.";
    }
  }

  if (err.message === "Unsupported file type") {
    statusCode = 400;
    message =
      "Unsupported file type. Allowed: JPG, PNG, WEBP, GIF, PDF, TXT, ZIP, DOC, DOCX.";
  }

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};
