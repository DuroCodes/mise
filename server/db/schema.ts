import { relations } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const recipes = sqliteTable(
  "recipes",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    image: text("image"),
    sourceUrl: text("source_url"),
    prepMinutes: integer("prep_minutes"),
    cookMinutes: integer("cook_minutes"),
    servings: integer("servings"),
    visibility: text("visibility").notNull().default("public"),
    shareToken: text("share_token"),
    ownerId: text("owner_id").references((): AnySQLiteColumn => user.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("recipes_share_token_unique").on(table.shareToken)]
);

export const ratings = sqliteTable(
  "ratings",
  {
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: "cascade" }),
    stars: integer("stars").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.recipeId, table.userId] }),
    index("ratings_user_idx").on(table.userId),
  ]
);

export const favorites = sqliteTable(
  "favorites",
  {
    userId: text("user_id")
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: "cascade" }),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.recipeId] }),
    index("favorites_recipe_idx").on(table.recipeId),
  ]
);

export const cookLogs = sqliteTable(
  "cook_logs",
  {
    id: text("id").primaryKey(),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: "cascade" }),
    cookedOn: text("cooked_on").notNull(),
    note: text("note").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("cook_logs_recipe_idx").on(table.recipeId)]
);

export const shoppingItems = sqliteTable(
  "shopping_items",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    amount: text("amount").notNull().default(""),
    unit: text("unit").notNull().default(""),
    note: text("note").notNull().default(""),
    sources: text("sources").notNull().default("[]"),
    checked: integer("checked", { mode: "boolean" }).notNull().default(false),
    position: integer("position").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("shopping_items_user_idx").on(table.userId)]
);

export const mealPlan = sqliteTable(
  "meal_plan",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: "cascade" }),
    day: text("day").notNull(),
    slot: text("slot").notNull(),
    position: integer("position").notNull().default(0),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    servings: integer("servings"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("meal_plan_user_day_idx").on(table.userId, table.day)]
);

export const collections = sqliteTable(
  "collections",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("collections_user_idx").on(table.userId)]
);

export const collectionRecipes = sqliteTable(
  "collection_recipes",
  {
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    addedAt: integer("added_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.collectionId, table.recipeId] }),
    index("collection_recipes_recipe_idx").on(table.recipeId),
  ]
);

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

export const invites = sqliteTable(
  "invites",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull(),
    note: text("note").notNull().default(""),
    createdBy: text("created_by").references((): AnySQLiteColumn => user.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp_ms" }),
    usedBy: text("used_by").references((): AnySQLiteColumn => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [uniqueIndex("invites_token_unique").on(table.token)]
);

export const stores = sqliteTable(
  "stores",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    layout: text("layout").notNull().default("[]"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("stores_user_idx").on(table.userId)]
);

export const pantryItems = sqliteTable(
  "pantry_items",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    amount: text("amount").notNull().default(""),
    unit: text("unit").notNull().default(""),
    note: text("note").notNull().default(""),
    expiresOn: text("expires_on"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("pantry_items_user_idx").on(table.userId)]
);

export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    useSoon: integer("use_soon", { mode: "boolean" }).notNull().default(true),
    tomorrow: integer("tomorrow", { mode: "boolean" }).notNull().default(true),
    lastUseSoon: text("last_use_soon"),
    lastTomorrow: text("last_tomorrow"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("push_subscriptions_endpoint_unique").on(table.endpoint),
    index("push_subscriptions_user_idx").on(table.userId),
  ]
);

/** Per-person preferences. A missing row means every default. */
export const userSettings = sqliteTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references((): AnySQLiteColumn => user.id, { onDelete: "cascade" }),
  aiEnabled: integer("ai_enabled", { mode: "boolean" }).notNull().default(true),
});
