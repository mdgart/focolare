import { and, eq } from "drizzle-orm";
import { slugify } from "../lib/slug";
import { db } from "./index";
import { channel, mediaAsset, recipe, recipeStep, recipeTag, tag, taxonomyCategory, user } from "./schema";

const DEMO_EMAIL = "demo-kitchen@focolare.local";
const DEMO_USER_ID = "seed_demo_creator_v1";
const DEMO_CHANNEL_SLUG = "demo-kitchen";

type Ingredient = { amount?: string; unit?: string; name: string };

type MockRecipe = {
  slug: string;
  title: string;
  description: string;
  taxonomySlug: string | null;
  /** File name under public/recipes/ used as the cover photo. */
  coverImage: string;
  /** How many days ago the recipe was published (staggers the home feed). */
  daysAgo: number;
  /** Free-form labels; overlapping across recipes so the tag cloud has real weight. */
  tags: string[];
  /** Defaults to metric when omitted. */
  ingredientMeasureSystem?: "metric" | "us";
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
    coverImage: "country-loaf.jpg",
    daysAgo: 1,
    tags: ["sourdough", "bread", "overnight", "dutch oven"],
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
        durationSeconds: 1800,
        offsetFromPrevious: 0,
      },
      {
        title: "Bulk ferment",
        instruction:
          "Fold in starter and salt. Every 45 minutes, stretch-and-fold until the dough feels strong and billowy, 3–4 folds total.",
        durationSeconds: 10800,
        offsetFromPrevious: 0,
      },
      {
        title: "Shape & cold proof",
        instruction:
          "Preshape, bench rest 20 minutes, then final shape into a banneton. Cover and refrigerate 12–16 hours.",
        durationSeconds: 46800,
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
    slug: "butter-croissants",
    title: "Classic butter croissants",
    description:
      "Shatteringly crisp layers from a patient three-fold lamination — a weekend project worth every turn.",
    taxonomySlug: "baking-pastry",
    coverImage: "croissants.jpg",
    daysAgo: 2,
    tags: ["pastry", "laminated", "butter", "weekend", "bread"],
    ingredients: [
      { amount: "500", unit: "g", name: "all-purpose flour" },
      { amount: "140", unit: "g", name: "water" },
      { amount: "140", unit: "g", name: "whole milk, cold" },
      { amount: "55", unit: "g", name: "sugar" },
      { amount: "11", unit: "g", name: "instant yeast" },
      { amount: "12", unit: "g", name: "salt" },
      { amount: "280", unit: "g", name: "European-style butter, for the block" },
      { amount: "1", name: "egg, beaten with a splash of milk" },
    ],
    steps: [
      {
        title: "Make the détrempe",
        instruction:
          "Mix flour, water, milk, sugar, yeast, and salt into a shaggy dough. Knead 3 minutes, wrap flat, refrigerate 1 hour.",
        durationSeconds: 3600,
        offsetFromPrevious: 0,
      },
      {
        title: "Laminate",
        instruction:
          "Pound butter into a 17×17 cm square. Enclose in dough, roll to 60 cm, letter-fold. Rest 30 minutes cold between each of 3 folds.",
        durationSeconds: 5400,
        offsetFromPrevious: 0,
      },
      {
        title: "Shape",
        instruction:
          "Roll to 3–4 mm, cut long triangles, roll from base to tip. Place on lined trays with room to grow.",
        durationSeconds: null,
        offsetFromPrevious: 0,
      },
      {
        title: "Proof",
        instruction:
          "Proof at warm room temperature until jiggly and nearly doubled, 2–2.5 hours. Egg-wash gently.",
        durationSeconds: 8100,
        offsetFromPrevious: 0,
      },
      {
        title: "Bake",
        instruction: "Bake at 400°F (200°C) for 18–20 minutes until deep golden. Cool before tearing in.",
        durationSeconds: 1140,
        offsetFromPrevious: 0,
      },
    ],
  },
  {
    slug: "tomato-basil-soup",
    title: "Tomato basil soup",
    description: "Silky, bright soup with canned San Marzanos when tomatoes are out of season.",
    taxonomySlug: "cooking-soups",
    coverImage: "tomato-basil-soup.jpg",
    daysAgo: 3,
    tags: ["soup", "weeknight", "vegetarian", "tomato"],
    ingredientMeasureSystem: "us",
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
        instruction:
          "Warm oil in a pot. Cook onion with a pinch of salt until soft, 8–10 minutes. Add garlic 1 minute.",
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
    slug: "weeknight-carbonara",
    title: "Weeknight carbonara",
    description: "Creamy egg-and-cheese sauce with pancetta—no actual cream.",
    taxonomySlug: "cooking",
    coverImage: "carbonara.jpg",
    daysAgo: 4,
    tags: ["pasta", "weeknight", "italian", "eggs"],
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
        instruction:
          "Salt water aggressively. Cook pasta 1 minute shy of package timing. Reserve 1 cup pasta water.",
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
    slug: "buttermilk-pancakes",
    title: "Buttermilk pancakes",
    description:
      "Tall, fluffy diner-style pancakes with crisp edges — the batter comes together in one bowl.",
    taxonomySlug: "cooking",
    coverImage: "buttermilk-pancakes.jpg",
    daysAgo: 5,
    tags: ["breakfast", "weekend", "quick"],
    ingredientMeasureSystem: "us",
    ingredients: [
      { amount: "2", unit: "cups", name: "all-purpose flour" },
      { amount: "3", unit: "tbsp", name: "sugar" },
      { amount: "1½", unit: "tsp", name: "baking powder" },
      { amount: "½", unit: "tsp", name: "baking soda" },
      { amount: "1", unit: "tsp", name: "kosher salt" },
      { amount: "2¼", unit: "cups", name: "buttermilk" },
      { amount: "2", name: "large eggs" },
      { amount: "3", unit: "tbsp", name: "melted butter, plus more for the pan" },
      { name: "Maple syrup and sliced banana, to serve" },
    ],
    steps: [
      {
        title: "Mix the batter",
        instruction:
          "Whisk dry ingredients. Whisk buttermilk, eggs, and butter separately, then fold together — lumps are fine. Rest 10 minutes.",
        durationSeconds: 600,
        offsetFromPrevious: 0,
      },
      {
        title: "Griddle",
        instruction:
          "Heat a buttered skillet over medium. Ladle ⅓-cup rounds; flip when bubbles pop and edges set, about 2 minutes per side.",
        durationSeconds: 1200,
        offsetFromPrevious: 0,
      },
      {
        title: "Serve",
        instruction: "Stack high, keep warm in a low oven if needed, and finish with syrup and fruit.",
        durationSeconds: null,
        offsetFromPrevious: 0,
      },
    ],
  },
  {
    slug: "margherita-pizza",
    title: "Home-oven margherita pizza",
    description:
      "A blistered, cheesy pie from a screaming-hot baking steel — 72-hour cold-fermented dough optional but glorious.",
    taxonomySlug: "baking",
    coverImage: "margherita-pizza.jpg",
    daysAgo: 6,
    tags: ["pizza", "italian", "weekend", "dough"],
    ingredients: [
      { amount: "500", unit: "g", name: "00 or bread flour" },
      { amount: "325", unit: "g", name: "water" },
      { amount: "10", unit: "g", name: "salt" },
      { amount: "3", unit: "g", name: "instant yeast" },
      { amount: "1", unit: "can", name: "San Marzano tomatoes, crushed by hand" },
      { amount: "250", unit: "g", name: "fresh mozzarella, torn" },
      { name: "Basil leaves, olive oil, flaky salt" },
    ],
    steps: [
      {
        title: "Make the dough",
        instruction:
          "Mix flour, water, salt, and yeast until smooth. Ball, oil lightly, and refrigerate 24–72 hours.",
        durationSeconds: null,
        offsetFromPrevious: 0,
      },
      {
        title: "Preheat",
        instruction:
          "Divide into 3 balls; rest at room temperature 2 hours. Meanwhile heat a steel or stone on the top rack at max broil for 1 hour.",
        durationSeconds: 7200,
        offsetFromPrevious: 0,
      },
      {
        title: "Stretch & top",
        instruction:
          "Stretch a ball to 12 inches on floured parchment. Sauce sparingly, scatter mozzarella, drizzle oil.",
        durationSeconds: null,
        offsetFromPrevious: 0,
      },
      {
        title: "Bake",
        instruction:
          "Launch onto the steel. Bake 6–8 minutes until leoparded, rotating once. Finish with basil and flaky salt.",
        durationSeconds: 480,
        offsetFromPrevious: 0,
      },
    ],
  },
  {
    slug: "shrimp-miso-ramen",
    title: "Shrimp miso ramen",
    description:
      "A weeknight bowl that tastes slow-simmered: miso-butter broth, jammy eggs, charred snap peas, and plump shrimp.",
    taxonomySlug: "cooking-soups",
    coverImage: "shrimp-ramen.jpg",
    daysAgo: 7,
    tags: ["soup", "noodles", "weeknight", "seafood"],
    ingredients: [
      { amount: "1", unit: "l", name: "chicken or dashi stock" },
      { amount: "3", unit: "tbsp", name: "white miso" },
      { amount: "1", unit: "tbsp", name: "soy sauce" },
      { amount: "2", unit: "tbsp", name: "butter" },
      { amount: "300", unit: "g", name: "shrimp, peeled" },
      { amount: "2", name: "eggs" },
      { amount: "2", unit: "portions", name: "fresh ramen noodles" },
      { amount: "100", unit: "g", name: "snap peas" },
      { name: "Black sesame, scallions" },
    ],
    steps: [
      {
        title: "Jammy eggs",
        instruction: "Boil eggs 6 minutes 30 seconds, then shock in ice water. Peel when cool.",
        durationSeconds: 390,
        offsetFromPrevious: 0,
      },
      {
        title: "Build the broth",
        instruction:
          "Bring stock to a bare simmer. Whisk in miso and soy off the boil; mount with butter. Keep warm, never boiling.",
        durationSeconds: 600,
        offsetFromPrevious: 0,
      },
      {
        title: "Sear",
        instruction:
          "In a hot skillet, blister snap peas 2 minutes; set aside. Sear shrimp 1–2 minutes per side until just pink.",
        durationSeconds: 360,
        offsetFromPrevious: 0,
      },
      {
        title: "Assemble",
        instruction:
          "Cook noodles per package, drain hard. Divide into bowls, ladle broth, arrange shrimp, peas, halved eggs, sesame, and scallions.",
        durationSeconds: null,
        offsetFromPrevious: 0,
      },
    ],
  },
  {
    slug: "chocolate-layer-cake",
    title: "Chocolate fudge layer cake",
    description:
      "Deep cocoa layers, silky ganache drip, and swirls of malted chocolate buttercream — a proper celebration cake.",
    taxonomySlug: "desserts",
    coverImage: "chocolate-layer-cake.jpg",
    daysAgo: 8,
    tags: ["cake", "chocolate", "celebration", "weekend"],
    ingredientMeasureSystem: "us",
    ingredients: [
      { amount: "2", unit: "cups", name: "all-purpose flour" },
      { amount: "¾", unit: "cup", name: "Dutch cocoa" },
      { amount: "2", unit: "cups", name: "sugar" },
      { amount: "2", unit: "tsp", name: "baking soda" },
      { amount: "1", unit: "tsp", name: "salt" },
      { amount: "2", name: "eggs" },
      { amount: "1", unit: "cup", name: "buttermilk" },
      { amount: "½", unit: "cup", name: "neutral oil" },
      { amount: "1", unit: "cup", name: "hot coffee" },
      { amount: "300", unit: "g", name: "dark chocolate, for ganache and frosting" },
      { amount: "250", unit: "g", name: "butter, softened" },
    ],
    steps: [
      {
        title: "Bake the layers",
        instruction:
          "Whisk dry, then wet, then stream in hot coffee. Divide between two 8-inch pans. Bake at 350°F (175°C) 30–34 minutes; cool completely.",
        durationSeconds: 2040,
        offsetFromPrevious: 0,
      },
      {
        title: "Frost & stack",
        instruction:
          "Beat butter with melted, cooled chocolate until fluffy. Fill and crumb-coat; chill 20 minutes, then final coat.",
        durationSeconds: 1200,
        offsetFromPrevious: 0,
      },
      {
        title: "Ganache drip",
        instruction:
          "Pour warm ganache around the chilled edge so it drips, then pipe swirls on top and shower with sprinkles.",
        durationSeconds: null,
        offsetFromPrevious: 0,
      },
    ],
  },
  {
    slug: "napa-kimchi",
    title: "Small-batch napa kimchi",
    description:
      "Crunchy, garlicky baechu kimchi with gochugaru heat — ferments on the counter in under a week.",
    taxonomySlug: "fermenting",
    coverImage: "napa-kimchi.jpg",
    daysAgo: 9,
    tags: ["fermented", "korean", "spicy", "vegetarian"],
    ingredients: [
      { amount: "1", name: "napa cabbage (about 1.2 kg)" },
      { amount: "70", unit: "g", name: "coarse sea salt" },
      { amount: "4", unit: "tbsp", name: "gochugaru" },
      { amount: "1", unit: "tbsp", name: "fish sauce" },
      { amount: "1", unit: "tbsp", name: "grated garlic" },
      { amount: "1", unit: "tsp", name: "grated ginger" },
      { amount: "1", unit: "tsp", name: "sugar" },
      { amount: "4", name: "scallions, in batons" },
    ],
    steps: [
      {
        title: "Salt the cabbage",
        instruction:
          "Quarter cabbage, salt between leaves, and rest 2 hours, turning every 30 minutes, until wilted and bendy. Rinse three times; drain well.",
        durationSeconds: 7200,
        offsetFromPrevious: 0,
      },
      {
        title: "Paste & pack",
        instruction:
          "Mix gochugaru, fish sauce, garlic, ginger, sugar, and scallions into a paste. Work between leaves. Pack tightly into a jar, pressing out air; leave headspace.",
        durationSeconds: null,
        offsetFromPrevious: 0,
      },
      {
        title: "Ferment",
        instruction:
          "Ferment at room temperature 3–5 days, burping daily and pressing solids under brine. Refrigerate when pleasantly sour.",
        durationSeconds: 345600,
        offsetFromPrevious: 0,
      },
    ],
  },
  {
    slug: "mandarin-honey",
    title: "Mandarin-infused honey",
    description:
      "Golden honey steeped with mandarin zest — spoon it over yogurt, cheese, or into winter tea.",
    taxonomySlug: "preserving",
    coverImage: "mandarin-honey.jpg",
    daysAgo: 10,
    tags: ["preserve", "citrus", "no-cook", "gift"],
    ingredients: [
      { amount: "500", unit: "g", name: "mild runny honey" },
      { amount: "2", name: "mandarins, zest in wide strips" },
      { amount: "1", name: "vanilla bean, split (optional)" },
    ],
    steps: [
      {
        title: "Warm gently",
        instruction:
          "Heat honey with zest and vanilla to 45°C — warm to the touch, never simmering — for 10 minutes to wake the oils.",
        durationSeconds: 600,
        offsetFromPrevious: 0,
      },
      {
        title: "Steep",
        instruction: "Pour into a clean jar with the aromatics, lid, and steep 3 days at room temperature.",
        durationSeconds: 259200,
        offsetFromPrevious: 0,
      },
      {
        title: "Strain & store",
        instruction:
          "Fish out zest and vanilla (or leave them in for looks). Keeps sealed at room temperature for months.",
        durationSeconds: null,
        offsetFromPrevious: 0,
      },
    ],
  },
  {
    slug: "weekend-charcuterie-board",
    title: "Weekend charcuterie board",
    description:
      "How to build a generous board: balancing cured meats, three cheeses, something briny, something sweet.",
    taxonomySlug: "curing-charcuterie",
    coverImage: "charcuterie-board.jpg",
    daysAgo: 11,
    tags: ["no-cook", "entertaining", "cheese", "weekend"],
    ingredients: [
      { amount: "150", unit: "g", name: "salami, thinly sliced" },
      { amount: "100", unit: "g", name: "prosciutto or coppa" },
      { amount: "1", unit: "wheel", name: "soft-ripened cheese (brie or camembert)" },
      { amount: "150", unit: "g", name: "aged hard cheese, broken into shards" },
      { amount: "100", unit: "g", name: "marinated olives" },
      { amount: "1", unit: "handful", name: "cornichons" },
      { amount: "1", unit: "bunch", name: "grapes" },
      { name: "Baguette, pistachios, quince paste or membrillo" },
    ],
    steps: [
      {
        title: "Anchor the board",
        instruction:
          "Place cheeses first at triangle points, bowls of olives and pistachios next. Big items set the geography.",
        durationSeconds: null,
        offsetFromPrevious: 0,
      },
      {
        title: "River the meats",
        instruction:
          "Fold and ribbon the salami and prosciutto in flowing lines between the anchors — height beats flatness.",
        durationSeconds: null,
        offsetFromPrevious: 0,
      },
      {
        title: "Fill every gap",
        instruction:
          "Tuck grapes, cornichons, quince paste, and torn baguette into the gaps until the board disappears. Serve at room temperature, 30 minutes out of the fridge.",
        durationSeconds: 1800,
        offsetFromPrevious: 0,
      },
    ],
  },
  {
    slug: "rainbow-harvest-bowl",
    title: "Rainbow harvest bowl",
    description:
      "Roasted sweet potato, chickpeas, avocado, and crunchy vegetables over greens with a lemon-tahini drizzle.",
    taxonomySlug: "cooking",
    coverImage: "harvest-bowl.jpg",
    daysAgo: 12,
    tags: ["vegetarian", "healthy", "weeknight", "no-cook"],
    ingredients: [
      { amount: "2", name: "sweet potatoes, in 2 cm cubes" },
      { amount: "1", unit: "can", name: "chickpeas, drained" },
      { amount: "1", name: "avocado, fanned" },
      { amount: "2", unit: "handfuls", name: "lettuce or mixed greens" },
      { amount: "100", unit: "g", name: "cherry tomatoes" },
      { amount: "½", unit: "small", name: "red cabbage, shredded" },
      { amount: "3", unit: "tbsp", name: "tahini" },
      { amount: "1", name: "lemon, juiced" },
      { name: "Microgreens, watermelon radish, olive oil, salt" },
    ],
    steps: [
      {
        title: "Roast",
        instruction:
          "Toss sweet potato and chickpeas with oil and salt on a sheet pan. Roast at 425°F (220°C) for 25 minutes until browned at the edges.",
        durationSeconds: 1500,
        offsetFromPrevious: 0,
      },
      {
        title: "Whisk the dressing",
        instruction:
          "Whisk tahini with lemon juice, a pinch of salt, and cold water a spoonful at a time until pourable.",
        durationSeconds: null,
        offsetFromPrevious: 0,
      },
      {
        title: "Compose",
        instruction:
          "Pile greens, then arrange everything in bands of color. Drizzle dressing and finish with microgreens.",
        durationSeconds: null,
        offsetFromPrevious: 0,
      },
    ],
  },
];

/** Attach labels to a recipe, creating any tag rows that don't exist yet. Idempotent. */
async function attachTags(recipeId: string, labels: string[]): Promise<void> {
  for (const label of [...new Set(labels.map((l) => l.trim()).filter(Boolean))]) {
    const slug = slugify(label);
    await db.insert(tag).values({ slug, label }).onConflictDoNothing({ target: tag.slug });
    const [row] = await db.select({ id: tag.id }).from(tag).where(eq(tag.slug, slug)).limit(1);
    if (row) {
      await db.insert(recipeTag).values({ recipeId, tagId: row.id }).onConflictDoNothing();
    }
  }
}

async function categoryIdForSlug(slug: string | null): Promise<string | null> {
  if (!slug) return null;
  const [row] = await db
    .select({ id: taxonomyCategory.id })
    .from(taxonomyCategory)
    .where(eq(taxonomyCategory.slug, slug))
    .limit(1);
  return row?.id ?? null;
}

async function ensureDemoUserAndChannel(): Promise<{ channelId: string; ownerId: string }> {
  const [existingCh] = await db.select().from(channel).where(eq(channel.slug, DEMO_CHANNEL_SLUG)).limit(1);
  if (existingCh) return { channelId: existingCh.id, ownerId: existingCh.ownerUserId };

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
  return { channelId: ch!.id, ownerId };
}

async function insertRecipeIfMissing(
  channelId: string,
  ownerId: string,
  mock: MockRecipe,
): Promise<"inserted" | "skipped"> {
  const [existing] = await db
    .select({ id: recipe.id })
    .from(recipe)
    .where(and(eq(recipe.channelId, channelId), eq(recipe.slug, mock.slug)))
    .limit(1);
  if (existing) return "skipped";

  const taxonomyCategoryId = mock.taxonomySlug ? await categoryIdForSlug(mock.taxonomySlug) : null;
  const publishedAt = new Date(Date.now() - mock.daysAgo * 24 * 60 * 60 * 1000);

  const [cover] = await db
    .insert(mediaAsset)
    .values({
      ownerUserId: ownerId,
      storageKey: `seed:recipes/${mock.coverImage}`,
      publicUrl: `/recipes/${mock.coverImage}`,
      mimeType: "image/jpeg",
      kind: "image",
    })
    .returning();

  const [r] = await db
    .insert(recipe)
    .values({
      channelId,
      taxonomyCategoryId,
      title: mock.title,
      slug: mock.slug,
      description: mock.description,
      ingredients: mock.ingredients,
      ingredientMeasureSystem: mock.ingredientMeasureSystem ?? "metric",
      visibility: "public",
      publishedAt,
      createdAt: publishedAt,
      coverMediaId: cover!.id,
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

  await attachTags(r.id, mock.tags);

  return "inserted";
}

/**
 * Add the catalog's tags to already-seeded recipes without touching anything else.
 * Safe on a live database: only matches the demo channel's own slugs, and never deletes.
 */
export async function backfillMockRecipeTags(): Promise<void> {
  const [ch] = await db.select().from(channel).where(eq(channel.slug, DEMO_CHANNEL_SLUG)).limit(1);
  if (!ch) {
    console.log(`No /${DEMO_CHANNEL_SLUG} channel — nothing to backfill.`);
    return;
  }
  let touched = 0;
  for (const mock of MOCK_RECIPES) {
    const [r] = await db
      .select({ id: recipe.id })
      .from(recipe)
      .where(and(eq(recipe.channelId, ch.id), eq(recipe.slug, mock.slug)))
      .limit(1);
    if (!r) continue;
    await attachTags(r.id, mock.tags);
    touched += 1;
  }
  console.log(`Tagged ${touched} seeded recipes.`);
}

export async function seedMockRecipes(): Promise<void> {
  const { channelId, ownerId } = await ensureDemoUserAndChannel();
  let inserted = 0;
  let skipped = 0;
  for (const mock of MOCK_RECIPES) {
    const result = await insertRecipeIfMissing(channelId, ownerId, mock);
    if (result === "inserted") inserted += 1;
    else skipped += 1;
  }
  console.log(`Mock recipes: ${inserted} inserted, ${skipped} already present (channel /${DEMO_CHANNEL_SLUG}).`);
}
