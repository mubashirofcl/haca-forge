export function requirePermission(permissionKey) {
  return (req, res, next) => {
    if (!req.user || !req.ability) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required before checking permissions.',
        },
      });
    }

    // Admin has full manage access
    if (req.user.role === 'admin') {
      return next();
    }

    if (req.ability.can(permissionKey, 'all')) {
      return next();
    }

    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: `You do not have the required permission (${permissionKey}) to perform this action.`,
      },
    });
  };
}
