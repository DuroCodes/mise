import { relations } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const recipes = sqliteTable("recipes", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  image: text("image"),
  prepMinutes: integer("prep_minutes"),
  cookMinutes: integer("cook_minutes"),
  servings: integer("servings"),
  favorite: integer("favorite", { mode: "boolean" }).notNull().default(false),
  visibility: text("visibility").notNull().default("public"),
  ownerId: text("owner_id").references((): AnySQLiteColumn => user.id, {
    onDelete: "set null",
  }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const ingredients = sqliteTable(
  "ingredients",
  {
    id: text("id").primaryKey(),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    amount: text("amount").notNull().default(""),
    unit: text("unit").notNull().default(""),
    name: text("name").notNull(),
    note: text("note").notNull().default(""),
  },
  (table) => [index("ingredients_recipe_idx").on(table.recipeId)]
);

export const instructions = sqliteTable(
  "instructions",
  {
    id: text("id").primaryKey(),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    body: text("body").notNull(),
  },
  (table) => [index("instructions_recipe_idx").on(table.recipeId)]
);

export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const recipeTags = sqliteTable(
  "recipe_tags",
  {
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.recipeId, table.tagId] }),
    index("recipe_tags_tag_idx").on(table.tagId),
  ]
);

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull(),
  image: text("image"),
  role: text("role").notNull().default("member"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_idx").on(table.userId)]
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("account_user_idx").on(table.userId)]
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
);

export const recipesRelations = relations(recipes, ({ many, one }) => ({
  ingredients: many(ingredients),
  instructions: many(instructions),
  recipeTags: many(recipeTags),
  owner: one(user, {
    fields: [recipes.ownerId],
    references: [user.id],
  }),
}));

export const ingredientsRelations = relations(ingredients, ({ one }) => ({
  recipe: one(recipes, {
    fields: [ingredients.recipeId],
    references: [recipes.id],
  }),
}));

export const instructionsRelations = relations(instructions, ({ one }) => ({
  recipe: one(recipes, {
    fields: [instructions.recipeId],
    references: [recipes.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  recipeTags: many(recipeTags),
}));

export const recipeTagsRelations = relations(recipeTags, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeTags.recipeId],
    references: [recipes.id],
  }),
  tag: one(tags, {
    fields: [recipeTags.tagId],
    references: [tags.id],
  }),
}));
