/**
 * A starting pantry, offered as a checklist when someone first opens the staples page.
 *
 * Typing forty ingredients is a wall; ticking the dozen you actually keep takes a
 * moment. Kept to things genuinely likely to already be in a cupboard — anything
 * speculative would be silently subtracted from shopping lists, which is the
 * failure mode worth avoiding.
 */
export const CURATED_STAPLES: { group: string; items: string[] }[] = [
  {
    group: "Cupboard",
    items: ["Salt", "Black pepper", "Olive oil", "Vegetable oil", "Plain flour", "Sugar", "Honey"],
  },
  {
    group: "Aromatics",
    items: ["Onions", "Garlic", "Lemons", "Ginger"],
  },
  {
    group: "Dry goods",
    items: ["Rice", "Pasta", "Lentils", "Breadcrumbs", "Oats"],
  },
  {
    group: "Tins & jars",
    items: ["Tinned tomatoes", "Stock cubes", "Soy sauce", "Vinegar", "Mustard", "Tomato paste"],
  },
  {
    group: "Fridge",
    items: ["Butter", "Eggs", "Milk", "Parmesan", "Yoghurt"],
  },
  {
    group: "Spices",
    items: ["Chilli flakes", "Cumin", "Paprika", "Oregano", "Bay leaves", "Cinnamon"],
  },
  {
    group: "Baking",
    items: ["Baking powder", "Bicarbonate of soda", "Vanilla extract", "Yeast"],
  },
];
