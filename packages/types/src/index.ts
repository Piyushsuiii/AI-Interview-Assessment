import type { OrgRole } from "@ai-hiring-platform/auth";

export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
};

export type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type PublicUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  emailVerifiedAt: string | null;
};

export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  industry: string | null;
  companySize: string | null;
  timezone: string;
  role: OrgRole;
};

export type AuthSessionPayload = {
  user: PublicUser;
  organizations: OrganizationSummary[];
};
