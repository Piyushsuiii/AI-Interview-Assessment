export const ORG_ROLES = [
  "OWNER",
  "ADMIN",
  "HIRING_MANAGER",
  "RECRUITER",
  "INTERVIEWER",
  "VIEWER",
] as const;

export type OrgRole = (typeof ORG_ROLES)[number];

export const PERMISSIONS = [
  "org:read",
  "org:update",
  "org:delete",
  "team:read",
  "team:invite",
  "team:update_role",
  "team:remove",
  "jobs:read",
  "jobs:write",
  "candidates:read",
  "candidates:write",
  "assessments:read",
  "assessments:write",
  "interviews:read",
  "interviews:write",
  "interviews:assigned",
  "billing:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL_PERMISSIONS = [...PERMISSIONS];

export const ROLE_PERMISSIONS: Record<OrgRole, Permission[]> = {
  OWNER: ALL_PERMISSIONS,
  ADMIN: [
    "org:read",
    "org:update",
    "team:read",
    "team:invite",
    "team:update_role",
    "team:remove",
    "jobs:read",
    "jobs:write",
    "candidates:read",
    "candidates:write",
    "assessments:read",
    "assessments:write",
    "interviews:read",
    "interviews:write",
  ],
  HIRING_MANAGER: [
    "org:read",
    "team:read",
    "jobs:read",
    "jobs:write",
    "candidates:read",
    "candidates:write",
    "assessments:read",
    "assessments:write",
    "interviews:read",
    "interviews:write",
  ],
  RECRUITER: [
    "org:read",
    "team:read",
    "jobs:read",
    "candidates:read",
    "candidates:write",
    "assessments:read",
    "interviews:read",
    "interviews:write",
  ],
  INTERVIEWER: [
    "org:read",
    "team:read",
    "jobs:read",
    "candidates:read",
    "assessments:read",
    "interviews:assigned",
  ],
  VIEWER: [
    "org:read",
    "team:read",
    "jobs:read",
    "candidates:read",
    "assessments:read",
    "interviews:read",
  ],
};

export function hasPermission(role: OrgRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: OrgRole, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function hasAllPermissions(role: OrgRole, permissions: Permission[]): boolean {
  return permissions.every((permission) => hasPermission(role, permission));
}

export function assertAssignableRole(actorRole: OrgRole, targetRole: OrgRole): void {
  if (targetRole === "OWNER" && actorRole !== "OWNER") {
    throw new Error("Only an owner can assign the owner role");
  }
  if (actorRole === "ADMIN" && targetRole === "ADMIN") {
    return;
  }
  if (actorRole !== "OWNER" && actorRole !== "ADMIN") {
    throw new Error("You cannot change member roles");
  }
}
