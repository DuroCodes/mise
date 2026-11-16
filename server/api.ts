import type { Hono } from "hono";
import type { SessionUser } from "./auth";

export type ApiEnv = { Variables: { user: SessionUser } };
export type Api = Hono<ApiEnv>;

export const readJson = async (request: Request): Promise<unknown> => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

export const isAdmin = (user: SessionUser) => user.role === "admin";
