/**
 * Validate request body against a Zod schema.
 * Usage: router.post('/path', validate(mySchema), handler)
 */
function validate(schema, target = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const errors = result.error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return res.status(400).json({ error: 'Validation failed', code: 'VALIDATION_ERROR', errors });
    }
    req[target] = result.data; // Use parsed/transformed data
    next();
  };
}

module.exports = { validate };
