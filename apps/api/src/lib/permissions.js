import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import { ROLE_PERMISSIONS } from '@mmp/shared';

export function defineAbilityForUser(user) {
  const { can, cannot, build } = new AbilityBuilder(createMongoAbility);

  if (!user || user.status === 'suspended') {
    return build();
  }

  if (user.role === 'admin') {
    can('manage', 'all');
  }

  const permissions = ROLE_PERMISSIONS[user.role] || [];
  for (const perm of permissions) {
    can(perm, 'all');
  }

  return build();
}
