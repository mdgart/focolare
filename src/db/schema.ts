import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

/* ---------- Better Auth (snake_case columns, adapter camelCase: false) ---------- */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
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
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------- App enums ---------- */

export const taxonomySuggestionStatusEnum = pgEnum("taxonomy_suggestion_status", [
  "pending",
  "approved",
  "rejected",
]);

export const recipeVisibilityEnum = pgEnum("recipe_visibility", ["public", "members"]);

export const mediaKindEnum = pgEnum("media_kind", ["image", "video"]);

export const cookSessionStateEnum = pgEnum("cook_session_state", [
  "planning",
  "active",
  "paused",
  "completed",
  "cancelled",
]);

export const scheduledEventKindEnum = pgEnum("scheduled_event_kind", [
  "timer_end",
  "step_reminder",
]);

export const scheduledEventStatusEnum = pgEnum("scheduled_event_status", [
  "pending",
  "sent",
  "skipped",
  "failed",
]);

/* ---------- Taxonomy ---------- */

export const taxonomyCategory = pgTable(
  "taxonomy_category",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    label: text("label").notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => taxonomyCategory.id),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("taxonomy_category_parent_idx").on(t.parentId),
    index("taxonomy_category_active_idx").on(t.isActive),
  ],
);

export const taxonomySuggestion = pgTable(
  "taxonomy_suggestion",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposerUserId: text("proposer_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    proposedLabel: text("proposed_label").notNull(),
    parentCategoryId: uuid("parent_category_id").references(() => taxonomyCategory.id, {
      onDelete: "set null",
    }),
    synonyms: text("synonyms"),
    status: taxonomySuggestionStatusEnum("status").notNull().default("pending"),
    moderatorNote: text("moderator_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("taxonomy_suggestion_status_idx").on(t.status)],
);

export const mediaAsset = pgTable("media_asset", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: text("owner_user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull(),
  publicUrl: text("public_url").notNull(),
  mimeType: text("mime_type").notNull(),
  kind: mediaKindEnum("kind").notNull().default("image"),
  width: integer("width"),
  height: integer("height"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------- Channels & recipes ---------- */

export const channel = pgTable(
  "channel",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    bio: text("bio"),
    avatarMediaId: uuid("avatar_media_id").references(() => mediaAsset.id, {
      onDelete: "set null",
    }),
    stripeConnectAccountId: text("stripe_connect_account_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("channel_owner_idx").on(t.ownerUserId)],
);

export const recipe = pgTable(
  "recipe",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channel.id, { onDelete: "cascade" }),
    taxonomyCategoryId: uuid("taxonomy_category_id").references(() => taxonomyCategory.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    ingredients: jsonb("ingredients")
      .$type<{ amount?: string; unit?: string; name: string }[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    visibility: recipeVisibilityEnum("visibility").notNull().default("public"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("recipe_channel_slug_uidx").on(t.channelId, t.slug),
    index("recipe_channel_idx").on(t.channelId),
    index("recipe_visibility_idx").on(t.visibility),
    index("recipe_taxonomy_idx").on(t.taxonomyCategoryId),
  ],
);

export const recipeStep = pgTable(
  "recipe_step",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    instruction: text("instruction").notNull(),
    durationSeconds: integer("duration_seconds"),
    offsetFromPrevious: integer("offset_from_previous").notNull().default(0),
    parallelGroupId: integer("parallel_group_id"),
  },
  (t) => [
    uniqueIndex("recipe_step_position_uidx").on(t.recipeId, t.position),
    index("recipe_step_recipe_idx").on(t.recipeId),
  ],
);

export const recipeMedia = pgTable(
  "recipe_media",
  {
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => mediaAsset.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.recipeId, t.mediaId] })],
);

/* ---------- Social ---------- */

export const comment = pgTable(
  "comment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("comment_recipe_idx").on(t.recipeId)],
);

export const rating = pgTable(
  "rating",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    value: integer("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("rating_recipe_user_uidx").on(t.recipeId, t.userId)],
);

export const follow = pgTable(
  "follow",
  {
    followerUserId: text("follower_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channel.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.followerUserId, t.channelId] })],
);

/** Phase-1 demo: toggles access to member-only recipes without Stripe. */
export const channelSubscription = pgTable(
  "channel_subscription",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channel.id, { onDelete: "cascade" }),
    demoActive: boolean("demo_active").notNull().default(false),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("channel_subscription_user_channel_uidx").on(t.userId, t.channelId),
    index("channel_subscription_channel_idx").on(t.channelId),
  ],
);

export const collection = pgTable("collection", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const collectionRecipe = pgTable(
  "collection_recipe",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collection.id, { onDelete: "cascade" }),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.recipeId] })],
);

/* ---------- Cook mode & notifications ---------- */

export const cookSession = pgTable(
  "cook_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    state: cookSessionStateEnum("state").notNull().default("planning"),
    targetReadyAt: timestamp("target_ready_at", { withTimezone: true }),
    plannedStartAt: timestamp("planned_start_at", { withTimezone: true }),
    currentStepIndex: integer("current_step_index").notNull().default(0),
    scale: integer("scale").notNull().default(100),
    startedAt: timestamp("started_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("cook_session_user_idx").on(t.userId),
    index("cook_session_recipe_idx").on(t.recipeId),
    index("cook_session_state_idx").on(t.state),
  ],
);

export const scheduledStepEvent = pgTable(
  "scheduled_step_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cookSessionId: uuid("cook_session_id")
      .notNull()
      .references(() => cookSession.id, { onDelete: "cascade" }),
    recipeStepId: uuid("recipe_step_id").references(() => recipeStep.id, { onDelete: "set null" }),
    stepIndex: integer("step_index").notNull(),
    kind: scheduledEventKindEnum("kind").notNull(),
    fireAt: timestamp("fire_at", { withTimezone: true }).notNull(),
    status: scheduledEventStatusEnum("status").notNull().default("pending"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    pushPayload: jsonb("push_payload").$type<Record<string, unknown>>().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [
    index("scheduled_step_event_fire_idx").on(t.status, t.fireAt),
    index("scheduled_step_event_session_idx").on(t.cookSessionId),
  ],
);

export const pushSubscription = pgTable(
  "push_subscription",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("push_subscription_user_idx").on(t.userId)],
);

/* ---------- Relations (optional, for joins) ---------- */

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const channelRelations = relations(channel, ({ one, many }) => ({
  owner: one(user, { fields: [channel.ownerUserId], references: [user.id] }),
  recipes: many(recipe),
}));

export const recipeRelations = relations(recipe, ({ one, many }) => ({
  channel: one(channel, { fields: [recipe.channelId], references: [channel.id] }),
  steps: many(recipeStep),
}));

export const recipeStepRelations = relations(recipeStep, ({ one }) => ({
  recipe: one(recipe, { fields: [recipeStep.recipeId], references: [recipe.id] }),
}));

export const cookSessionRelations = relations(cookSession, ({ one, many }) => ({
  recipe: one(recipe, { fields: [cookSession.recipeId], references: [recipe.id] }),
  user: one(user, { fields: [cookSession.userId], references: [user.id] }),
  scheduledEvents: many(scheduledStepEvent),
}));
