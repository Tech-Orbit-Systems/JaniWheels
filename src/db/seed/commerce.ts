/**
 * Monetization seed.
 *
 * Prices below are illustrative starting points, benchmarked roughly against
 * what the incumbent charges. Treat them as hypotheses to test, not settled
 * pricing — the right number is the one your first fifty paying sellers
 * actually convert at.
 *
 * The important structural choice: a free tier that is genuinely usable.
 * Supply is the constraint on a young marketplace, so charging to list at
 * all is how you stay empty. Charge for VISIBILITY, not for existence.
 */

export interface AdPackageSeed {
  slug: string;
  name: string;
  vertical: "car" | "bike" | "part" | null;
  pricePkr: number;
  durationDays: number;
  featuredDays: number;
  bumpCount: number;
  photoLimit: number;
  homepageSlot: boolean;
  sortOrder: number;
}

export const AD_PACKAGES: AdPackageSeed[] = [
  {
    slug: "free",
    name: "Free Ad",
    vertical: null,
    pricePkr: 0,
    durationDays: 30,
    featuredDays: 0,
    bumpCount: 0,
    photoLimit: 8,
    homepageSlot: false,
    sortOrder: 0,
  },
  {
    slug: "bump-up",
    name: "Bump Up",
    vertical: null,
    pricePkr: 500,
    durationDays: 30,
    featuredDays: 0,
    bumpCount: 3,
    photoLimit: 12,
    homepageSlot: false,
    sortOrder: 1,
  },
  {
    slug: "featured-7",
    name: "Featured — 7 Days",
    vertical: null,
    pricePkr: 1500,
    durationDays: 30,
    featuredDays: 7,
    bumpCount: 2,
    photoLimit: 20,
    homepageSlot: false,
    sortOrder: 2,
  },
  {
    slug: "featured-15",
    name: "Featured — 15 Days",
    vertical: null,
    pricePkr: 2500,
    durationDays: 45,
    featuredDays: 15,
    bumpCount: 4,
    photoLimit: 25,
    homepageSlot: true,
    sortOrder: 3,
  },
  {
    slug: "sell-fast",
    name: "Sell Fast Bundle",
    vertical: "car",
    pricePkr: 4500,
    durationDays: 60,
    featuredDays: 30,
    bumpCount: 8,
    photoLimit: 30,
    homepageSlot: true,
    sortOrder: 4,
  },
];

export interface DealerPlanSeed {
  slug: string;
  name: string;
  monthlyPricePkr: number;
  listingQuota: number;
  featuredQuota: number;
  bulkUpload: boolean;
  brandedStorefront: boolean;
  leadAnalytics: boolean;
  prioritySupport: boolean;
}

/**
 * Dealer subscriptions are the recurring revenue line and the reason to
 * build lead analytics early: a dealer renews when you can show them
 * "we sent you 214 phone reveals last month".
 */
export const DEALER_PLANS: DealerPlanSeed[] = [
  {
    slug: "starter",
    name: "Starter",
    monthlyPricePkr: 5000,
    listingQuota: 15,
    featuredQuota: 1,
    bulkUpload: false,
    brandedStorefront: false,
    leadAnalytics: false,
    prioritySupport: false,
  },
  {
    slug: "showroom",
    name: "Showroom",
    monthlyPricePkr: 15000,
    listingQuota: 50,
    featuredQuota: 5,
    bulkUpload: true,
    brandedStorefront: true,
    leadAnalytics: true,
    prioritySupport: false,
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    monthlyPricePkr: 40000,
    listingQuota: 200,
    featuredQuota: 20,
    bulkUpload: true,
    brandedStorefront: true,
    leadAnalytics: true,
    prioritySupport: true,
  },
];

/**
 * Inspection packages. Note these are priced by engine size, matching how
 * the work actually scales — a 660cc Alto takes less time on a lift than a
 * German SUV with more to go wrong.
 *
 * Do not build this until Phase 4. It is a field-operations business with a
 * software front end, not a feature.
 */
export const INSPECTION_PACKAGES = [
  { slug: "basic", name: "Basic (up to 1000cc)", pricePkr: 4500, checkpoints: 200 },
  { slug: "standard", name: "Standard (1001–2000cc)", pricePkr: 6500, checkpoints: 200 },
  { slug: "premium", name: "Premium (SUV / 4x4 / German)", pricePkr: 9500, checkpoints: 200 },
  { slug: "pdi", name: "Pre-Delivery Inspection (new car)", pricePkr: 3500, checkpoints: 120 },
] as const;
