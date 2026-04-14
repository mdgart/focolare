import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { channel, recipe, recipeStep, taxonomyCategory, user } from "./schema";

const DEMO_EMAIL = "demo-kitchen@focolare.local";
const DEMO_USER_ID = "seed_demo_creator_v1";
const DEMO_CHANNEL_SLUG = "demo-kitchen";

type Ingredient = { amount?: string; unit?: string; name: string };

type MockRecipe = {
  slug: string;
  title: string;
  description: string;
  taxonomySlug: string | null;
  ingredients: Ingredient[];
  steps: {
    title: string;
    instruction: string;
    durationSeconds: number | null;
    offsetFromPrevious: number;
  }[];
};

const MOCK_RECIPES: MockRecipe[] = [
  {
    slug: "overnight-country-loaf",
    title: "Overnight country loaf",
    description:
      "A relaxed sourdough-style bread with a long cold ferment for depth and a crackly crust.",
    taxonomySlug: "baking-bread",
    ingredients: [
      { amount: "500", unit: "g", name: "bread flour" },
      { amount: "375", unit: "g", name: "water, lukewarm" },
      { amount: "100", unit: "g", name: "active starter (100% hydration)" },
      { amount: "10", unit: "g", name: "fine sea salt" },
    ],
    steps: [
      {
        title: "Mix",
        instruction:
          "Combine flour and water until no dry spots remain. Rest 30 minutes (autolyse).",
        durationSeconds: null,
        offsetFromPrevious: 0,
      },
      {
        title: "Bulk ferment",
        instruction:
          "Fold in starter and salt. Every 45 minutes, stretch-and-fold until the dough feels strong and billowy, 3–4 folds total.",
        durationSeconds: 2700,
        offsetFromPrevious: 0,
      },
      {
        title: "Shape & cold proof",
        instruction:
          "Preshape, bench rest 20 minutes, then final shape into a banneton. Cover and refrigerate 12–16 hours.",
        durationSeconds: null,
        offsetFromPrevious: 0,
      },
      {
        title: "Bake",
        instruction:
          "Preheat Dutch oven at 475°F (245°C). Score, bake covered 20 minutes, uncovered 20–25 minutes until deeply browned.",
        durationSeconds: 2700,
        offsetFromPrevious: 0,
      },
    ],
  },
  {
    slug: "tomato-basil-soup",
    title: "Tomato basil soup",
    description: "Silky, bright soup with canned San Marzanos when tomatoes are out of season.",
    taxonomySlug: "cooking-soups",
    ingredients: [
      { amount: "2", unit: "tbsp", name: "olive oil" },
      { amount: "1", name: "medium onion, diced" },
      { amount: "3", name: "garlic cloves, sliced" },
      { amount: "2", unit: "× 28 oz", name: "canned whole tomatoes" },
      { amount: "2", unit: "cups", name: "vegetable broth" },
      { amount: "1", unit: "tsp", name: "sugar (optional)" },
      { amount: "½", unit: "cup", name: "heavy cream" },
      { name: "Fresh basil, salt, pepper" },
    ],
    steps: [
      {
        title: "Sweat aromatics",
        instruction: "Warm oil in a pot. Cook onion with a pinch of salt until soft, 8–10 minutes. Add garlic 1 minute.",
        durationSeconds: 600,
        offsetFromPrevious: 0,
      },
      {
        title: "Simmer",
        instruction:
          "Add tomatoes and broth; crush tomatoes with a spoon. Simmer 25 minutes, stirring occasionally.",
        durationSeconds: 1500,
        offsetFromPrevious: 0,
      },
      {
        title: "Blend & finish",
        instruction:
          "Blend until smooth. Return to pot, stir in cream and sugar if needed. Season; finish with torn basil.",
        durationSeconds: null,
        offsetFromPrevious: 0,
      },
    ],
  },
  {
    slug: "lemon-olive-oil-cake",
    title: "Lemon olive oil cake",
    description: "One-bowl, moist crumb with citrus and grassy olive oil—great with tea.",
    taxonomySlug: "baking-pastry",
    ingredients: [
      { amount: "1½", unit: "cups", name: "all-purpose flour" },
      { amount: "1", unit: "tsp", name: "baking powder" },
      { amount: "½", unit: "tsp", name: "baking soda" },
      { amount: "½", unit: "tsp", name: "kosher salt" },
      { amount: "1", unit: "cup", name: "sugar" },
      { amount: "¾", unit: "cup", name: "extra-virgin olive oil" },
      { amount: "¾", unit: "cup", name: "whole milk" },
      { amount: "2", name: "large eggs" },
      { amount: "2", unit: "tbsp", name: "lemon zest" },
      { amount: "¼", unit: "cup", name: "fresh lemon juice" },
    ],
    steps: [
      {
        title: "Prep pan & oven",
        instruction: "Preheat oven to 350°F (175°C). Grease and line a 9-inch round cake pan.",
        durationSeconds: null,
        offsetFromPrevious: 0,
      },
      {
        title: "Whisk dry, then wet",
        instruction:
          "Whisk flour, baking powder, soda, and salt. In another bowl, whisk sugar, oil, milk, eggs, zest, and juice until smooth.",
        durationSeconds: null,
        offsetFromPrevious: 0,
      },
      {
        title: "Combine & bake",
        instruction:
          "Fold dry into wet until just combined. Pour into pan. Bake 40–45 minutes until a skewer is clean. Cool before slicing.",
        durationSeconds: 2700,
        offsetFromPrevious: 0,
      },
    ],
  },
  {
    slug: "weeknight-carbonara",
    title: "Weeknight carbonara",
    description: "Creamy egg-and-cheese sauce with pancetta—no actual cream.",
    taxonomySlug: "cooking",
    ingredients: [
      { amount: "400", unit: "g", name: "spaghetti or bucatini" },
      { amount: "150", unit: "g", name: "diced pancetta or guanciale" },
      { amount: "3", name: "large egg yolks" },
      { amount: "1", name: "whole egg" },
      { amount: "100", unit: "g", name: "Pecorino Romano, finely grated" },
      { amount: "1", unit: "tsp", name: "freshly cracked black pepper" },
    ],
    steps: [
      {
        title: "Render pork",
        instruction: "Cook pancetta in a wide skillet over medium heat until crisp and fat has rendered.",
        durationSeconds: 480,
        offsetFromPrevious: 0,
      },
      {
        title: "Boil pasta",
        instruction: "Salt water aggressively. Cook pasta 1 minute shy of package timing. Reserve 1 cup pasta water.",
        durationSeconds: 600,
        offsetFromPrevious: 0,
      },
      {
        title: "Sauce off heat",
        instruction:
          "Whisk eggs with most of the cheese. Off heat, toss hot pasta with pork, then quickly toss with egg mixture, splashing pasta water until silky. Top with pepper and remaining cheese.",
        durationSeconds: null,
        offsetFromPrevious: 0,
      },
    ],
  },
  {
    slug: "quick-dill-pickles",
    title: "Quick refrigerator dill pickles",
    description: "Crisp pickles in a vinegar brine—ready after a day in the fridge.",
    taxonomySlug: "curing-charcuterie",
    ingredients: [
      { amount: "1", unit: "lb", name: "small cucumbers, washed" },
      { amount: "1", unit: "cup", name: "white vinegar" },
      { amount: "1", unit: "cup", name: "water" },
      { amount: "1", unit: "tbsp", name: "kosher salt" },
      { amount: "1", unit: "tbsp", name: "sugar" },
      { name: "Fresh dill, garlic cloves, mustard seeds, peppercorns" },
    ],
    steps: [
      {
        title: "Pack jars",
        instruction: "Pack cucumbers upright with dill, garlic, and spices in a clean quart jar.",
        durationSeconds: null,
        offsetFromPrevious: 0,
      },
      {
        title: "Hot brine",
        instruction: "Bring vinegar, water, salt, and sugar to a boil. Pour over cucumbers to cover; tap to release air.",
        durationSeconds: 300,
        offsetFromPrevious: 0,
      },
      {
        title: "Cool & rest",
        instruction: "Cool to room temperature, lid, refrigerate at least 24 hours before eating.",
        durationSeconds: null,
        offsetFromPrevious: 0,
      },
    ],
  },
];

async function categoryIdForSlug(slug: string | null): Promise<string | null> {
  if (!slug) return null;
  const [row] = await db.select({ id: taxonomyCategory.id }).from(taxonomyCategory).where(eq(taxonomyCategory.slug, slug)).limit(1);
  return row?.id ?? null;
}

async function ensureDemoUserAndChannel(): Promise<{ channelId: string }> {
  const [existingCh] = await db.select().from(channel).where(eq(channel.slug, DEMO_CHANNEL_SLUG)).limit(1);
  if (existingCh) return { channelId: existingCh.id };

  let ownerId = DEMO_USER_ID;
  const [byEmail] = await db.select().from(user).where(eq(user.email, DEMO_EMAIL)).limit(1);
  if (!byEmail) {
    await db.insert(user).values({
      id: DEMO_USER_ID,
      name: "Demo Kitchen",
      email: DEMO_EMAIL,
      emailVerified: true,
    });
  } else {
    ownerId = byEmail.id;
  }

  const [ch] = await db
    .insert(channel)
    .values({
      ownerUserId: ownerId,
      slug: DEMO_CHANNEL_SLUG,
      title: "Demo Kitchen",
      bio: "Seeded recipes for browsing and cook mode in local development.",
    })
    .returning();
  return { channelId: ch!.id };
}

async function insertRecipeIfMissing(channelId: string, mock: MockRecipe): Promise<"inserted" | "skipped"> {
  const [existing] = await db
    .select({ id: recipe.id })
    .from(recipe)
    .where(and(eq(recipe.channelId, channelId), eq(recipe.slug, mock.slug)))
    .limit(1);
  if (existing) return "skipped";

  const taxonomyCategoryId = mock.taxonomySlug ? await categoryIdForSlug(mock.taxonomySlug) : null;
  const now = new Date();

  const [r] = await db
    .insert(recipe)
    .values({
      channelId,
      taxonomyCategoryId,
      title: mock.title,
      slug: mock.slug,
      description: mock.description,
      ingredients: mock.ingredients,
      visibility: "public",
      publishedAt: now,
    })
    .returning();

  if (!r) throw new Error(`Failed to insert recipe ${mock.slug}`);

  await db.insert(recipeStep).values(
    mock.steps.map((s, i) => ({
      recipeId: r.id,
      position: i,
      title: s.title,
      instruction: s.instruction,
      durationSeconds: s.durationSeconds,
      offsetFromPrevious: i === 0 ? 0 : s.offsetFromPrevious,
    })),
  );

  return "inserted";
}

export async function seedMockRecipes(): Promise<void> {
  const { channelId } = await ensureDemoUserAndChannel();
  let inserted = 0;
  let skipped = 0;
  for (const mock of MOCK_RECIPES) {
    const result = await insertRecipeIfMissing(channelId, mock);
    if (result === "inserted") inserted += 1;
    else skipped += 1;
  }
  console.log(`Mock recipes: ${inserted} inserted, ${skipped} already present (channel /${DEMO_CHANNEL_SLUG}).`);
}
