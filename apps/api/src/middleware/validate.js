export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    try {
      const dataToValidate = req[source];
      req[source] = schema.parse(dataToValidate);
      next();
    } catch (error) {
      next(error);
    }
  };
}
