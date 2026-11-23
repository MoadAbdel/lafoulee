import type { CookieOptions, Response } from "express";
import { ACCESS_TTL_SECONDS } from "./token.service.js";

export const ACCESS_COOKIE = "lf_at";
export const REFRESH_COOKIE = "lf_rt";
export const REFRESH_TTL_SECONDS = 30 * 24 * 3600;

// Le jeton de rafraîchissement n'est envoyé qu'aux routes d'authentification.
const REFRESH_PATH = "/api/v1/auth";

function base(secure: boolean): CookieOptions {
  return { httpOnly: true, secure, sameSite: "lax" };
}

export function setSessionCookies(res: Response, access: string, refresh: string, secure: boolean): void {
  res.cookie(ACCESS_COOKIE, access, { ...base(secure), path: "/", maxAge: ACCESS_TTL_SECONDS * 1000 });
  res.cookie(REFRESH_COOKIE, refresh, { ...base(secure), path: REFRESH_PATH, maxAge: REFRESH_TTL_SECONDS * 1000 });
}

export function clearSessionCookies(res: Response, secure: boolean): void {
  res.clearCookie(ACCESS_COOKIE, { ...base(secure), path: "/" });
  res.clearCookie(REFRESH_COOKIE, { ...base(secure), path: REFRESH_PATH });
}
