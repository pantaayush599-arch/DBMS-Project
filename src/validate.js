const { HttpError } = require('./errors');

// Field spec: { type: 'string'|'int'|'money'|'date', required?, max?, min? }
// Returns an object containing only the declared fields that were supplied.
function pick(body, spec, { partial = false } = {}) {
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Request body must be a JSON object');
  const out = {};
  for (const [field, rule] of Object.entries(spec)) {
    let value = body[field];
    const missing = value === undefined || value === null || value === '';
    if (missing) {
      if (rule.required && !partial) throw new HttpError(400, `${field} is required`);
      if (value !== undefined && !rule.required) out[field] = null;
      continue;
    }
    switch (rule.type) {
      case 'string':
        value = String(value).trim();
        if (rule.required && !value) throw new HttpError(400, `${field} is required`);
        if (rule.max && value.length > rule.max) throw new HttpError(400, `${field} must be at most ${rule.max} characters`);
        break;
      case 'int':
        value = Number(value);
        if (!Number.isInteger(value)) throw new HttpError(400, `${field} must be an integer`);
        break;
      case 'money':
        value = Number(value);
        if (!Number.isFinite(value)) throw new HttpError(400, `${field} must be a number`);
        value = Math.round(value * 100) / 100;
        break;
      case 'date':
        value = String(value);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)))
          throw new HttpError(400, `${field} must be a date (YYYY-MM-DD)`);
        break;
    }
    if (rule.min !== undefined && value < rule.min) throw new HttpError(400, `${field} must be at least ${rule.min}`);
    out[field] = value;
  }
  return out;
}

function id(param) {
  const n = Number(param);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Invalid id');
  return n;
}

module.exports = { pick, id };
