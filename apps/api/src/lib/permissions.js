import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import { ROLE_PERMISSIONS, normalizeRole } from '@mmp/shared';

export function defineAbilityForUser(user) {
  const { can, cannot, build } = new AbilityBuilder(createMongoAbility);

  if (!user || user.status === 'suspended') {
    return build();
  }

  const role = normalizeRole(user.role);

  if (role === 'admin') {
    can('manage', 'all');
  }

  const permissions = ROLE_PERMISSIONS[role] || [];
  for (const perm of permissions) {
    can(perm, 'all');
  }

  return build();
}
