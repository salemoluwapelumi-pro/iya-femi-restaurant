class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Map well-known database/upload error codes to friendly client errors.
const CODE_MAP = {
  '22P02': [400, 'Invalid request parameter'],
  '23503': [409, 'This record is still linked to other data and cannot be removed'],
  LIMIT_FILE_SIZE: [400, 'Image is too large (maximum size is 3MB)'],
};

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const mapped = err.status ? null : CODE_MAP[err.code];
  const status = err.status || (mapped ? mapped[0] : 500);
  const message = status === 500 ? 'Internal server error' : (mapped ? mapped[1] : err.message);
  if (status === 500) console.error(err);
  res.status(status).json({ success: false, error: message });
}

function notFound(req, res) {
  res.status(404).json({ success: false, error: 'Not found' });
}

module.exports = { ApiError, asyncHandler, errorHandler, notFound };
