import { z } from "zod";
import { attempt, Err, Ok } from "@/lib/result";

export const zodFetch = async <TSchema extends z.ZodType>(
  schema: TSchema,
  error: string,
  ...args: Parameters<typeof fetch>
) => {
  try {
    const res = await fetch(...args);

    if (!res.ok) {
      const text = await res.text();
      console.error(text);
      const body = attempt(() => JSON.parse(text) as { error?: unknown });
      if (body.ok && typeof body.value.error === "string")
        return Err(body.value.error);
      return Err(error);
    }

    const json = (await res.json()) as unknown;
    const parsed = schema.safeParse(json);

    if (!parsed.success) {
      console.error(
        parsed.error.issues
          .map((issue) => `${issue.code} | ${issue.message}`)
          .join("\n")
      );
      return Err(error);
    }

    return Ok(parsed.data);
  } catch (cause) {
    console.error(cause);
    return Err(error);
  }
};
