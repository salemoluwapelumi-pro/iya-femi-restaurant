const { ApiError } = require('./errors');

const isNonEmptyString = (v, max = 500) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const isOptionalString = (v, max = 2000) => v === undefined || v === null || (typeof v === 'string' && v.length <= max);
const isNigerianPhone = (v) => typeof v === 'string' && /^(\+234|0)[0-9]{10}$/.test(v.replace(/[\s-]/g, ''));
const isPositiveInt = (v) => Number.isInteger(v) && v > 0;
const isPrice = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;

function assert(condition, message) {
  if (!condition) throw new ApiError(400, message);
}

module.exports = { isNonEmptyString, isOptionalString, isNigerianPhone, isPositiveInt, isPrice, assert };
