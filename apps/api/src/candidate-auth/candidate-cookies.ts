import type { CookieOptions, Response } from "express";

export const CANDIDATE_ACCESS_COOKIE = "candidate_access_token";
export const CANDIDATE_REFRESH_COOKIE = "candidate_refresh_token";

function candidateCookie(path = "/"): CookieOptions {
  const production = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? "none" : "lax",
    path,
    domain: process.env.COOKIE_DOMAIN || undefined,
  };
}

export function setCandidateCookies(response: Response, accessToken: string, refreshToken: string) {
  response.cookie(CANDIDATE_ACCESS_COOKIE, accessToken, {
    ...candidateCookie(),
    maxAge: 15 * 60 * 1000,
  });
  response.cookie(CANDIDATE_REFRESH_COOKIE, refreshToken, {
    ...candidateCookie("/api/v1/candidate/auth"),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearCandidateCookies(response: Response) {
  response.clearCookie(CANDIDATE_ACCESS_COOKIE, candidateCookie());
  response.clearCookie(CANDIDATE_REFRESH_COOKIE, candidateCookie("/api/v1/candidate/auth"));
}
