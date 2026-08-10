export const organizationRoles = [
  "ADMIN",
  "REVIEWER",
  "ANALYST",
  "VIEWER",
] as const;

export type OrganizationRole = (typeof organizationRoles)[number];
export type Permission =
  | "package:view"
  | "package:manage"
  | "package:delete"
  | "document:upload"
  | "finding:review"
  | "brief:approve"
  | "evidence:export"
  | "membership:manage";

const rolePermissions: Record<OrganizationRole, ReadonlySet<Permission>> = {
  ADMIN: new Set([
    "package:view",
    "package:manage",
    "package:delete",
    "document:upload",
    "finding:review",
    "brief:approve",
    "evidence:export",
    "membership:manage",
  ]),
  REVIEWER: new Set([
    "package:view",
    "package:manage",
    "document:upload",
    "finding:review",
    "brief:approve",
    "evidence:export",
  ]),
  ANALYST: new Set([
    "package:view",
    "document:upload",
    "finding:review",
  ]),
  VIEWER: new Set(["package:view"]),
};

export function hasPermission(role: OrganizationRole, permission: Permission) {
  return rolePermissions[role].has(permission);
}

export function assertPermission(
  role: OrganizationRole,
  permission: Permission,
) {
  if (!hasPermission(role, permission)) {
    throw new Error("FORBIDDEN");
  }
}
