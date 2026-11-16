import { defineConfig } from "drizzle-kit";

const directory = process.env.DATA_DIR ?? "./data";

export default defineConfig({
  dialect: "sqlite",
  schema: "./server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: `${directory}/mise.db`,
  },
});
