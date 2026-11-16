import { parseAmount, unitInfo } from "../lib/units";

/**
 * A small, bundled food table so nutrition estimates work offline and never
 * send recipes anywhere. Values are per 100 g, approximated from USDA
 * FoodData Central (SR Legacy). `density` is grams per millilitre, `each` is
 * grams for one whole item, and `units` holds grams for named units.
 */
type Food = {
  names: string[];
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  density: number;
  each?: number;
  units?: Record<string, number>;
  can?: number;
  perInch?: number;
};

const food = (
  names: string[],
  [kcal, protein, carbs, fat, fiber]: [number, number, number, number, number],
  density: number,
  extra: Partial<Pick<Food, "each" | "units" | "can" | "perInch">> = {}
): Food => ({ names, kcal, protein, carbs, fat, fiber, density, ...extra });

const foods: Food[] = [
  // Grains, flours, and starches (dry weight)
  food(
    [
      "spaghetti",
      "pasta",
      "penne",
      "linguine",
      "fettuccine",
      "macaroni",
      "rigatoni",
      "fusilli",
      "farfalle",
      "noodles",
      "orzo",
      "lasagna",
      "bucatini",
      "tagliatelle",
    ],
    [371, 13, 75, 1.5, 3.2],
    0.45
  ),
  food(["rice", "white rice", "jasmine rice", "basmati rice", "arborio rice"], [365, 7.1, 80, 0.7, 1.3], 0.8),
  food(["brown rice"], [367, 7.5, 76, 2.7, 3.4], 0.8),
  food(["flour", "all-purpose flour", "plain flour", "bread flour"], [364, 10.3, 76, 1, 2.7], 0.53),
  food(["whole wheat flour", "wholemeal flour"], [340, 13, 72, 2.5, 10.7], 0.51),
  food(["bread", "sourdough", "baguette"], [265, 9, 49, 3.2, 2.7], 0.25, { each: 30, units: { slice: 30 } }),
  food(["oats", "rolled oats", "oatmeal"], [379, 13, 68, 6.5, 10], 0.36),
  food(["breadcrumbs", "panko"], [395, 13, 72, 5.3, 4.5], 0.45),
  food(["quinoa"], [368, 14, 64, 6, 7], 0.72),
  food(["couscous"], [376, 12.8, 77, 0.6, 5], 0.73),
  food(["cornstarch", "corn starch", "cornflour"], [381, 0.3, 91, 0.1, 0.9], 0.54),
  food(["tortilla", "tortillas", "flour tortilla"], [312, 8, 52, 8, 3.5], 0.5, { each: 45 }),

  // Sweeteners
  food(["sugar", "granulated sugar", "white sugar", "caster sugar"], [387, 0, 100, 0, 0], 0.85),
  food(["brown sugar"], [380, 0.1, 98, 0, 0], 0.93),
  food(["powdered sugar", "icing sugar", "confectioners sugar"], [389, 0, 100, 0, 0], 0.51),
  food(["honey"], [304, 0.3, 82, 0, 0.2], 1.42),
  food(["maple syrup"], [260, 0, 67, 0.1, 0], 1.32),

  // Fats and oils
  food(["butter"], [717, 0.9, 0.1, 81, 0], 0.96, { units: { stick: 113 } }),
  food(
    [
      "oil",
      "olive oil",
      "vegetable oil",
      "canola oil",
      "sunflower oil",
      "sesame oil",
      "coconut oil",
      "avocado oil",
      "peanut oil",
    ],
    [884, 0, 0, 100, 0],
    0.92
  ),

  // Dairy and eggs
  food(["milk", "whole milk"], [61, 3.2, 4.8, 3.3, 0], 1.03),
  food(["heavy cream", "double cream", "whipping cream", "cream"], [340, 2.8, 2.8, 36, 0], 1),
  food(["sour cream"], [198, 2.4, 4.6, 19, 0], 0.97),
  food(["yogurt", "yoghurt", "plain yogurt"], [61, 3.5, 4.7, 3.3, 0], 1.03),
  food(["greek yogurt"], [59, 10, 3.6, 0.4, 0], 1.03),
  food(["parmesan", "parmigiano reggiano", "parmigiano"], [420, 36, 3.2, 28, 0], 0.42),
  food(["pecorino", "pecorino romano"], [387, 32, 3.6, 27, 0], 0.42),
  food(["cheddar", "cheddar cheese"], [403, 25, 1.3, 33, 0], 0.47),
  food(["mozzarella"], [300, 22, 2.2, 22, 0], 0.47),
  food(["cheese"], [380, 24, 2, 31, 0], 0.47),
  food(["cream cheese"], [342, 6, 4.1, 34, 0], 0.97),
  food(["feta"], [264, 14, 4.1, 21, 0], 0.63),
  food(["ricotta"], [174, 11, 3, 13, 0], 1.02),
  food(["egg", "large egg"], [143, 12.6, 0.7, 9.5, 0], 1.03, { each: 50 }),
  food(["egg yolk"], [322, 16, 3.6, 27, 0], 1.03, { each: 17 }),
  food(["egg white"], [52, 11, 0.7, 0.2, 0], 1.03, { each: 33 }),

  // Meat, fish, and plant proteins (raw)
  food(["chicken", "chicken breast"], [120, 22.5, 0, 2.6, 0], 0.6, { each: 175 }),
  food(["chicken thigh"], [150, 19, 0, 8, 0], 0.6, { each: 110 }),
  food(["ground beef", "beef mince", "minced beef"], [254, 17, 0, 20, 0], 0.9),
  food(["beef", "steak", "sirloin", "chuck"], [190, 20, 0, 12, 0], 0.9),
  food(["pork", "pork shoulder", "pork loin", "pork chop"], [210, 19, 0, 14, 0], 0.9),
  food(["ground pork", "pork mince"], [263, 17, 0, 21, 0], 0.9),
  food(["bacon", "pancetta"], [417, 13, 1.4, 42, 0], 0.6, { each: 28, units: { slice: 28 } }),
  food(["sausage", "sausages", "chorizo"], [268, 14, 1, 23, 0], 0.8, { each: 75 }),
  food(["ground turkey", "turkey mince"], [150, 19.7, 0, 8.3, 0], 0.9),
  food(["salmon"], [208, 20, 0, 13, 0], 0.9, { each: 170 }),
  food(["shrimp", "prawns", "prawn"], [85, 20, 0, 0.5, 0], 0.7, { each: 12 }),
  food(["tuna"], [116, 26, 0, 0.8, 0], 0.8, { can: 140 }),
  food(["tofu"], [76, 8.1, 1.9, 4.8, 0.3], 1, { each: 400 }),
  food(["firm tofu", "extra firm tofu"], [144, 17.3, 2.8, 8.7, 2.3], 1, { each: 400 }),
  food(["soft tofu", "silken tofu"], [61, 6.6, 1.2, 3.7, 0.2], 1, { each: 400 }),
  food(["lentils", "red lentils", "green lentils"], [352, 25, 63, 1.1, 11], 0.82),
  food(["chickpeas", "garbanzo beans"], [139, 7, 22.5, 2.6, 6.6], 0.68, { can: 250 }),
  food(["black beans"], [132, 8.9, 23.7, 0.5, 8.7], 0.72, { can: 250 }),
  food(["kidney beans", "cannellini beans", "white beans", "pinto beans", "beans"], [127, 8.7, 22.8, 0.5, 6.4], 0.72, { can: 250 }),
  food(["peanut butter"], [588, 25, 20, 50, 6], 1.08),
  food(["almonds"], [579, 21, 22, 50, 12.5], 0.6),
  food(["walnuts", "pecans"], [654, 15, 14, 65, 6.7], 0.5),

  // Vegetables
  food(["onion", "yellow onion", "white onion", "red onion"], [40, 1.1, 9.3, 0.1, 1.7], 0.68, { each: 110 }),
  food(["shallot"], [72, 2.5, 17, 0.1, 3.2], 0.68, { each: 25 }),
  food(["scallion", "green onion", "spring onion"], [32, 1.8, 7.3, 0.2, 2.6], 0.42, { each: 15, units: { bunch: 100 } }),
  food(["garlic"], [149, 6.4, 33, 0.5, 2.1], 0.57, { each: 3, units: { clove: 3, head: 40 } }),
  food(["tomato", "cherry tomato", "roma tomato"], [18, 0.9, 3.9, 0.2, 1.2], 0.76, { each: 120 }),
  food(
    ["crushed tomatoes", "diced tomatoes", "canned tomatoes", "whole peeled tomatoes", "chopped tomatoes", "passata"],
    [32, 1.6, 7.3, 0.3, 1.9],
    1.03,
    { can: 400 }
  ),
  food(["tomato sauce", "marinara"], [29, 1.2, 6.6, 0.2, 1.5], 1.03, { can: 425 }),
  food(["tomato paste"], [82, 4.3, 19, 0.5, 4.1], 1.1, { can: 170 }),
  food(["bell pepper", "red pepper", "green pepper", "yellow pepper", "capsicum"], [26, 1, 6, 0.3, 2.1], 0.62, { each: 120 }),
  food(["chili pepper", "jalapeno", "chile", "chili"], [40, 1.9, 8.8, 0.4, 1.5], 0.6, { each: 15 }),
  food(["carrot"], [41, 0.9, 9.6, 0.2, 2.8], 0.54, { each: 60 }),
  food(["celery"], [14, 0.7, 3, 0.2, 1.6], 0.43, { each: 40, units: { stalk: 40 } }),
  food(["potato", "potatoes", "russet potato", "yukon gold potato"], [77, 2, 17, 0.1, 2.2], 0.63, { each: 210 }),
  food(["sweet potato"], [86, 1.6, 20, 0.1, 3], 0.6, { each: 130 }),
  food(["spinach"], [23, 2.9, 3.6, 0.4, 2.2], 0.13, { units: { bunch: 340 } }),
  food(["kale"], [35, 2.9, 4.4, 1.5, 4.1], 0.09, { units: { bunch: 200 } }),
  food(["lettuce", "romaine"], [15, 1.4, 2.9, 0.2, 1.3], 0.2, { each: 500, units: { head: 500 } }),
  food(["broccoli"], [34, 2.8, 6.6, 0.4, 2.6], 0.39, { each: 350, units: { head: 350 } }),
  food(["cauliflower"], [25, 1.9, 5, 0.3, 2], 0.45, { each: 600, units: { head: 600 } }),
  food(["mushroom", "mushrooms", "cremini", "button mushrooms"], [22, 3.1, 3.3, 0.3, 1], 0.3, { each: 18 }),
  food(["zucchini", "courgette"], [17, 1.2, 3.1, 0.3, 1], 0.52, { each: 200 }),
  food(["cucumber"], [15, 0.7, 3.6, 0.1, 0.5], 0.55, { each: 300 }),
  food(["eggplant", "aubergine"], [25, 1, 5.9, 0.2, 3], 0.35, { each: 450 }),
  food(["corn", "sweet corn", "corn kernels"], [86, 3.3, 19, 1.4, 2], 0.65, { each: 90 }),
  food(["peas", "green peas"], [81, 5.4, 14.5, 0.4, 5.1], 0.6),
  food(["green beans"], [31, 1.8, 7, 0.2, 2.7], 0.45),
  food(["cabbage"], [25, 1.3, 5.8, 0.1, 2.5], 0.38, { each: 900, units: { head: 900 } }),
  food(["avocado"], [160, 2, 8.5, 14.7, 6.7], 0.62, { each: 150 }),
  food(["ginger"], [80, 1.8, 18, 0.8, 2], 0.4, { perInch: 10 }),
  food(["lemon"], [29, 1.1, 9.3, 0.3, 2.8], 0.6, { each: 60 }),
  food(["lime"], [30, 0.7, 10.5, 0.2, 2.8], 0.6, { each: 50 }),
  food(["lemon juice"], [22, 0.4, 6.9, 0.2, 0.3], 1.03),
  food(["lime juice"], [25, 0.4, 8.4, 0.1, 0.4], 1.03),
  food(
    ["cilantro", "coriander leaves", "parsley", "basil", "mint", "dill", "chives", "thyme", "rosemary", "oregano", "sage", "tarragon", "herbs"],
    [30, 2.5, 5, 0.6, 3],
    0.15,
    { units: { bunch: 50, sprig: 1 } }
  ),
  food(["wakame", "seaweed", "nori"], [45, 3, 9, 0.6, 0.5], 0.2),

  // Spices, seasonings, and condiments
  food(["black pepper", "white pepper", "peppercorns"], [251, 10.4, 64, 3.3, 25], 0.46),
  food(
    [
      "cumin",
      "paprika",
      "smoked paprika",
      "cinnamon",
      "chili powder",
      "chili flakes",
      "red pepper flakes",
      "turmeric",
      "ground coriander",
      "coriander seeds",
      "garlic powder",
      "onion powder",
      "dried oregano",
      "dried thyme",
      "dried basil",
      "nutmeg",
      "cardamom",
      "cloves ground",
      "allspice",
      "curry powder",
      "garam masala",
      "cayenne",
      "italian seasoning",
      "bay leaf",
      "bay leaves",
    ],
    [300, 12, 55, 10, 25],
    0.45
  ),
  food(["salt", "kosher salt", "sea salt", "flaky salt"], [0, 0, 0, 0, 0], 1.2),
  food(["baking powder"], [53, 0, 28, 0, 0.2], 0.9),
  food(["baking soda", "bicarbonate of soda"], [0, 0, 0, 0, 0], 0.9),
  food(["yeast"], [325, 40, 41, 7.6, 27], 0.6),
  food(["vanilla", "vanilla extract"], [288, 0.1, 12.7, 0.1, 0], 0.88),
  food(["soy sauce", "tamari"], [53, 8, 4.9, 0.6, 0.8], 1.15),
  food(["fish sauce"], [35, 5, 3.6, 0, 0], 1.2),
  food(["vinegar", "white vinegar", "rice vinegar", "red wine vinegar", "apple cider vinegar", "sherry vinegar"], [18, 0, 0.1, 0, 0], 1.01),
  food(["balsamic vinegar"], [88, 0.5, 17, 0, 0], 1.06),
  food(["miso", "white miso", "red miso"], [198, 12, 26, 6, 5.4], 1.15),
  food(["dashi"], [3, 0.4, 0.3, 0, 0], 1),
  food(["stock", "broth", "chicken stock", "chicken broth", "vegetable stock", "vegetable broth", "beef stock", "beef broth"], [6, 0.6, 0.4, 0.2, 0], 1),
  food(["water", "ice"], [0, 0, 0, 0, 0], 1),
  food(["coconut milk"], [197, 2, 2.8, 21, 0], 1, { can: 400 }),
  food(["wine", "white wine", "red wine"], [83, 0.1, 2.6, 0, 0], 0.99),
  food(["beer"], [43, 0.5, 3.6, 0, 0], 1.01),
  food(["mayonnaise", "mayo"], [680, 1, 0.6, 75, 0], 0.93),
  food(["ketchup"], [101, 1, 27, 0.1, 0.3], 1.15),
  food(["mustard", "dijon mustard", "dijon"], [60, 3.7, 5.8, 3.3, 4], 1.05),

  // Fruit, chocolate, and baking extras
  food(["dark chocolate", "chocolate", "chocolate chips"], [598, 7.8, 46, 43, 11], 0.72),
  food(["cocoa powder", "cocoa"], [228, 20, 58, 14, 37], 0.36),
  food(["raisins"], [299, 3, 79, 0.5, 3.7], 0.6),
  food(["banana"], [89, 1.1, 23, 0.3, 2.6], 0.6, { each: 118 }),
  food(["apple"], [52, 0.3, 14, 0.2, 2.4], 0.5, { each: 180 }),
  food(["blueberries"], [57, 0.7, 14.5, 0.3, 2.4], 0.62),
  food(["strawberries"], [32, 0.7, 7.7, 0.3, 2], 0.6, { each: 12 }),
];

const singular = (word: string) => {
  if (word.length <= 3) return word;
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.endsWith("oes")) return word.slice(0, -2);
  if (/(?:ches|shes|sses|xes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("s") && !/(?:ss|us|is)$/.test(word))
    return word.slice(0, -1);
  return word;
};

const tokens = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(singular);

type Alias = { words: string[]; food: Food; length: number };

const aliases: Alias[] = foods.flatMap((entry) =>
  entry.names.map((name) => ({
    words: tokens(name),
    food: entry,
    length: name.length,
  }))
);

const contains = (haystack: string[], needle: string[]) => {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let start = 0; start + needle.length <= haystack.length; start += 1) {
    if (needle.every((word, index) => haystack[start + index] === word))
      return true;
  }
  return false;
};

/** Picks the most specific food whose name appears in the ingredient name. */
export const matchFood = (name: string): Food | null => {
  const words = tokens(name);
  let best: Alias | null = null;
  for (const alias of aliases) {
    if (!contains(words, alias.words)) continue;
    if (
      !best ||
      alias.words.length > best.words.length ||
      (alias.words.length === best.words.length && alias.length > best.length)
    )
      best = alias;
  }
  return best?.food ?? null;
};

const countWords = new Set([
  "",
  "whole",
  "each",
  "piece",
  "pieces",
  "large",
  "medium",
  "small",
  "item",
  "items",
]);

const namedUnit = (unit: string) => {
  const key = unit.toLowerCase().replace(/\./g, "").trim();
  const map: Record<string, string> = {
    cloves: "clove",
    heads: "head",
    bunches: "bunch",
    stalks: "stalk",
    sprigs: "sprig",
    slices: "slice",
    sticks: "stick",
    cans: "can",
    tins: "can",
    tin: "can",
    jar: "can",
    jars: "can",
    pinches: "pinch",
    dashes: "dash",
    packages: "package",
    packets: "package",
    packet: "package",
  };
  return map[key] ?? key;
};

const sizeInText = (text: string, food: Food) => {
  const match = text.match(
    /(\d+(?:\.\d+)?)\s*-?\s*(oz|ounces?|g|grams?|ml|millilit(?:er|re)s?|lb|lbs|pounds?)\b/i
  );
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase() ?? "";
  if (unit.startsWith("oz") || unit.startsWith("ounce")) return amount * 28.35;
  if (unit.startsWith("lb") || unit.startsWith("pound")) return amount * 453.6;
  if (unit.startsWith("ml") || unit.startsWith("millil"))
    return amount * food.density;
  return amount;
};

const amountOf = (raw: string) => {
  const range = raw.trim().match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (range) return (Number(range[1]) + Number(range[2])) / 2;
  return parseAmount(raw);
};

/** Grams for one ingredient line, or null when the amount cannot be measured. */
export const gramsFor = (
  item: { amount: string; unit: string; note?: string },
  entry: Food
): number | null => {
  const unit = item.unit.trim();
  const amount = amountOf(item.amount) ?? (item.amount.trim() ? null : 1);
  if (amount === null) return null;

  const known = unitInfo(unit);
  if (known) {
    if (!item.amount.trim()) return null;
    if (known.kind === "weight") return amount * known.toBase;
    if (known.kind === "volume") return amount * known.toBase * entry.density;
    if (known.kind === "length" && entry.perInch)
      return ((amount * known.toBase) / 25.4) * entry.perInch;
    return null;
  }

  const named = namedUnit(unit.replace(/\(.*\)/, ""));
  if (named === "can" || named === "package") {
    const size =
      sizeInText(unit, entry) ?? sizeInText(item.note ?? "", entry) ?? entry.can ?? 400;
    return amount * size;
  }
  if (named === "pinch") return amount * 0.36;
  if (named === "dash") return amount * 0.6;
  const fromUnits = entry.units?.[named];
  if (fromUnits !== undefined) return amount * fromUnits;
  if (countWords.has(named) && item.amount.trim() && entry.each)
    return amount * entry.each;
  return null;
};

export type Nutrients = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

export type NutritionEstimate = {
  total: Nutrients;
  perServing: Nutrients | null;
  counted: string[];
  unmeasured: string[];
  unknown: string[];
};

const zero = (): Nutrients => ({ kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

export const estimateNutrition = (
  ingredients: { amount: string; unit: string; name: string; note: string }[],
  servings: number | null
): NutritionEstimate => {
  const total = zero();
  const counted: string[] = [];
  const unmeasured: string[] = [];
  const unknown: string[] = [];

  for (const item of ingredients) {
    const entry = matchFood(item.name);
    if (!entry) {
      unknown.push(item.name);
      continue;
    }
    const grams = gramsFor(item, entry);
    if (grams === null || !Number.isFinite(grams) || grams < 0) {
      unmeasured.push(item.name);
      continue;
    }
    const factor = grams / 100;
    total.kcal += entry.kcal * factor;
    total.protein += entry.protein * factor;
    total.carbs += entry.carbs * factor;
    total.fat += entry.fat * factor;
    total.fiber += entry.fiber * factor;
    counted.push(item.name);
  }

  const perServing =
    servings && servings > 0
      ? {
          kcal: total.kcal / servings,
          protein: total.protein / servings,
          carbs: total.carbs / servings,
          fat: total.fat / servings,
          fiber: total.fiber / servings,
        }
      : null;

  return { total, perServing, counted, unmeasured, unknown };
};
