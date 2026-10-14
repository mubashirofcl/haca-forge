export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    try {
      const parsed = schema.parse(req[source]);
      if (source === 'query') {
        // Express 5: req.query is a getter, mutate in place and attach validatedQuery
        req.validatedQuery = parsed;
        for (const key of Object.keys(req.query)) {
          delete req.query[key];
        }
        Object.assign(req.query, parsed);
      } else {
        req[source] = parsed;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validateQuery(schema) {
  return validate(schema, 'query');
}

export function validateParams(schema) {
  return validate(schema, 'params');
}
