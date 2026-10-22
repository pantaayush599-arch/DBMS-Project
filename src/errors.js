class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Translate MySQL errors (constraints, triggers, FKs) into clean HTTP responses.
// The database is the source of truth for business rules, so most validation
// failures arrive here as SQL errors.
function mapMysqlError(err) {
  switch (err.code) {
    case 'ER_SIGNAL_EXCEPTION': // SIGNAL from a trigger / procedure
      return new HttpError(err.sqlMessage.includes('not found') ? 404 : 400, err.sqlMessage);
    case 'ER_CHECK_CONSTRAINT_VIOLATED': {
      const name = (err.sqlMessage.match(/'([^']+)'/) || [])[1] || 'check';
      return new HttpError(400, `Invalid value (constraint ${name} violated)`);
    }
    case 'ER_NO_REFERENCED_ROW_2': {
      const col = (err.sqlMessage.match(/FOREIGN KEY \(`([^`]+)`\)/) || [])[1];
      return new HttpError(400, `Referenced ${col || 'record'} does not exist`);
    }
    case 'ER_ROW_IS_REFERENCED_2': {
      const table = (err.sqlMessage.match(/`[^`]+`\.`([^`]+)`/) || [])[1];
      return new HttpError(409, `Cannot delete: record is still referenced by ${table || 'another table'}`);
    }
    case 'ER_DUP_ENTRY':
      return new HttpError(409, `Duplicate value: ${err.sqlMessage.replace(/^Duplicate entry /, '')}`);
    case 'ER_BAD_NULL_ERROR':
      return new HttpError(400, err.sqlMessage);
    case 'ER_TRUNCATED_WRONG_VALUE':
    case 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD':
    case 'WARN_DATA_TRUNCATED':
    case 'ER_DATA_TOO_LONG':
    case 'ER_WARN_DATA_OUT_OF_RANGE':
      return new HttpError(400, err.sqlMessage);
    default:
      return null;
  }
}

function errorHandler(err, req, res, next) {
  const mapped = err instanceof HttpError ? err : mapMysqlError(err);
  if (mapped) return res.status(mapped.status).json({ error: mapped.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = { HttpError, errorHandler, mapMysqlError };
