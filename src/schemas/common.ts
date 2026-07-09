import { z } from "zod";

/** Standard API response wrapper */
export function okResponse<T>(data: T) {
  return { ok: true as const, data };
}

export function errResponse(code: string, message: string) {
  return { ok: false as const, error: { code, message } };
}

/** Pagination params */
export const paginationSchema = z.object({
  skip: z.coerce.number().int().min(0).default(0),
  take: z.coerce.number().int().min(1).max(100).default(50),
});

/** Common ID param */
export const idParamSchema = z.object({
  id: z.string().min(1),
});

/** Org header — set by client after selecting active org */
export const orgIdSchema = z.string().min(1, "x-org-id header required");
