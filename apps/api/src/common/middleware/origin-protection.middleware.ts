import type { NextFunction, Request, Response } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function originProtection(frontendUrl: string) {
  const allowedOrigin = new URL(frontendUrl).origin;
  return (request: Request, response: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(request.method.toUpperCase())) return next();
    const origin = request.get("origin");
    const fetchSite = request.get("sec-fetch-site");
    if ((origin && origin !== allowedOrigin) || (!origin && fetchSite === "cross-site")) {
      return response.status(403).json({
        success: false,
        error: { code: "ORIGIN_FORBIDDEN", message: "Request origin is not allowed" },
      });
    }
    return next();
  };
}
