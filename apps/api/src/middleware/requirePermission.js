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

export function requireAnyPermission(...permissionKeys) {
  const keys = permissionKeys.flat();
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

    const hasAny = keys.some((key) => req.ability.can(key, 'all'));
    if (hasAny) {
      return next();
    }

    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: `You do not have any of the required permissions (${keys.join(', ')}) to perform this action.`,
      },
    });
  };
}
