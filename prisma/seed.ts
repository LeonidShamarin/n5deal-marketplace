/**
 * Demo data.
 *
 * The seed is not decoration — the assignment asks for enough data to walk every
 * flow without typing anything in, and several of the interesting states cannot
 * be produced by clicking around at all. So it deliberately plants:
 *
 *   - a SUSPENDED seller whose listings must vanish from the public catalogue
 *     while keeping their own statuses intact;
 *   - a REMOVED seller, so the "asset of a deleted participant" path has a subject;
 *   - an asset suspended by a manager, with `previousStatus` recorded so that
 *     unsuspending restores exactly what was there before;
 *   - assets in every lifecycle state, so the seller dashboard is not all-green;
 *   - a buyer with a HIDDEN profile, to prove the visibility rule does something;
 *   - existing threads, so the inbox is not empty on first login.
 *
 * Everything is generated from a fixed RNG seed: the same command twice produces
 * the same database, which is what makes the numbers in the README reproducible.
 */

import {
  PrismaClient,
  type AssetBenefit,
  type AssetStatus,
  type BusinessCategory,
  type BusinessStatus,
  type Currency,
  type LicenseType,
} from "@prisma/client";
import { hash } from "bcryptjs";

// The seed talks to the DIRECT endpoint, not the pooler.
//
// A pooler in transaction mode keeps prepared statements alive across sessions,
// so right after a migration changes a column type it can still serve a plan
// built for the old type — which shows up as a baffling "cannot fit value into
// INT4" against a column that is already BIGINT. Maintenance scripts belong on
// the same connection migrations use.
const db = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
});

const DEMO_PASSWORD = "demo1234";

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------

/** mulberry32 — small, fast, and identical across machines and Node versions. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = makeRng(20260819);

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function pickSome<T>(items: readonly T[], min: number, max: number): T[] {
  const count = min + Math.floor(rng() * (max - min + 1));
  const pool = [...items];
  const out: T[] = [];
  for (let i = 0; i < count && pool.length > 0; i += 1) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return out;
}

function intBetween(min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Source material
// ---------------------------------------------------------------------------

const CATEGORIES: BusinessCategory[] = [
  "PAYMENTS",
  "FINTECH",
  "CRYPTO",
  "BANKING",
  "EMONEY",
  "FOREX",
  "LENDING",
  "GAMBLING",
];

const BENEFITS: AssetBenefit[] = [
  "IBAN",
  "SWIFT",
  "SEPA",
  "ACQUIRING",
  "CARD_ISSUING",
  "STAFF",
  "SOFTWARE",
  "CLIENT_BASE",
  "BANK_ACCOUNTS",
  "OFFICE",
];

/**
 * Licence types are not interchangeable across jurisdictions — an EMI is a real
 * thing in Lithuania and not in Singapore. Pairing them properly is what makes
 * the AI "smart validation" feature able to flag a genuine contradiction later.
 */
const JURISDICTIONS: ReadonlyArray<{
  country: string;
  regulator: string;
  licences: LicenseType[];
}> = [
  { country: "LT", regulator: "Bank of Lithuania", licences: ["EMI", "PI", "VASP"] },
  { country: "GB", regulator: "FCA", licences: ["EMI", "API_LICENSE", "SEMI", "MSO"] },
  { country: "MT", regulator: "MFSA", licences: ["EMI", "PI", "VASP"] },
  { country: "CY", regulator: "CySEC", licences: ["PI", "EMI"] },
  { country: "EE", regulator: "Estonian FSA", licences: ["VASP", "PI"] },
  { country: "IE", regulator: "Central Bank of Ireland", licences: ["EMI", "PI"] },
  { country: "LU", regulator: "CSSF", licences: ["EMI", "BANK"] },
  { country: "NL", regulator: "DNB", licences: ["EMI", "PI"] },
  { country: "DE", regulator: "BaFin", licences: ["BANK", "EMI"] },
  { country: "PL", regulator: "KNF", licences: ["SEMI", "PI"] },
  { country: "CZ", regulator: "CNB", licences: ["SEMI", "PI"] },
  { country: "CH", regulator: "FINMA", licences: ["VASP", "BANK"] },
  { country: "AE", regulator: "VARA", licences: ["VASP", "MSO"] },
  { country: "SG", regulator: "MAS", licences: ["MSO", "VASP"] },
  { country: "HK", regulator: "HKMA", licences: ["MSO", "VASP"] },
  { country: "US", regulator: "FinCEN", licences: ["MTL", "MSO"] },
  { country: "CA", regulator: "FINTRAC", licences: ["MSO", "MTL"] },
  { country: "GI", regulator: "GFSC", licences: ["VASP", "EMI"] },
];

const SELLERS = [
  {
    email: "seller@n5deal.demo",
    name: "Marta Kovalenko",
    company: "Baltic Licence Partners",
    country: "LT",
    verified: true,
    about:
      "Boutique advisory selling regulated payment and e-money entities across the Baltics and the wider EU.",
  },
  {
    email: "sofia.marchetti@n5deal.demo",
    name: "Sofia Marchetti",
    company: "Adriatic Deal House",
    country: "MT",
    verified: true,
    about: "Malta-based brokerage focused on EMI and VASP transfers.",
  },
  {
    email: "james.whitfield@n5deal.demo",
    name: "James Whitfield",
    company: "Whitfield & Rowe",
    country: "GB",
    verified: true,
    about: "UK corporate finance team specialising in FCA-authorised entities.",
  },
  {
    email: "elena.novak@n5deal.demo",
    name: "Elena Novak",
    company: "CE Fintech Exits",
    country: "CZ",
    verified: false,
    about: "Central European seller of small payment institutions and lending books.",
  },
  {
    email: "omar.haddad@n5deal.demo",
    name: "Omar Haddad",
    company: "Gulf Digital Assets",
    country: "AE",
    verified: false,
    about: "VASP and money services businesses in the UAE and wider MENA region.",
  },
  // Suspended by a manager: their listings must disappear from the catalogue
  // without any of the assets changing status.
  {
    email: "victor.brandt@n5deal.demo",
    name: "Victor Brandt",
    company: "Brandt Holdings",
    country: "DE",
    verified: false,
    about: "Portfolio of German and Dutch financial entities.",
    suspend: "Unverifiable ownership documents on three listings.",
  },
  // Removed by a manager: their asset pages must degrade gracefully rather than
  // crash on a missing owner.
  {
    email: "dana.reyes@n5deal.demo",
    name: "Dana Reyes",
    company: "Reyes Capital",
    country: "US",
    verified: false,
    about: "US money transmitter licences.",
    remove: "Repeated misrepresentation of licence scope after two warnings.",
  },
] as const;

const BUYERS = [
  {
    email: "buyer@n5deal.demo",
    name: "Anders Holm",
    company: "Nordkap Ventures",
    country: "SE",
    thesis:
      "Acquiring an EU e-money institution with live IBAN issuing to launch a Nordic business banking product. Prefers a clean licence with a small operating team we can keep.",
    categories: ["EMONEY", "PAYMENTS", "FINTECH"],
    countries: ["LT", "MT", "IE", "NL"],
    licences: ["EMI", "PI"],
    ticket: [1_000_000, 6_000_000],
    needsActive: false,
    visibility: "PUBLIC",
  },
  {
    email: "hannah.li@n5deal.demo",
    name: "Hannah Li",
    company: "Meridian Growth",
    country: "SG",
    thesis:
      "Looking for an operating payments business in APAC with existing merchant volume; licence alone is not interesting to us.",
    categories: ["PAYMENTS", "FINTECH"],
    countries: ["SG", "HK", "AE"],
    licences: ["MSO", "MTL"],
    ticket: [3_000_000, 12_000_000],
    needsActive: true,
    visibility: "PUBLIC",
  },
  {
    email: "tomas.berg@n5deal.demo",
    name: "Tomas Berg",
    company: "Fjord Digital",
    country: "EE",
    thesis: "Crypto exchange or VASP with a working compliance stack in the EU.",
    categories: ["CRYPTO"],
    countries: ["EE", "LT", "MT", "CH"],
    licences: ["VASP"],
    ticket: [400_000, 2_500_000],
    needsActive: false,
    visibility: "PUBLIC",
  },
  {
    email: "clara.dubois@n5deal.demo",
    name: "Clara Dubois",
    company: "Rive Gauche Capital",
    country: "FR",
    thesis: "Consolidating small EU payment institutions into one platform.",
    categories: ["PAYMENTS", "EMONEY"],
    countries: ["FR", "NL", "LU", "IE"],
    licences: ["PI", "EMI", "SEMI"],
    ticket: [800_000, 4_000_000],
    needsActive: false,
    visibility: "PUBLIC",
  },
  {
    email: "raj.mehta@n5deal.demo",
    name: "Raj Mehta",
    company: "Anvil Partners",
    country: "GB",
    thesis: "UK-authorised entity with acquiring capability and staff in place.",
    categories: ["PAYMENTS", "FINTECH"],
    countries: ["GB", "IE"],
    licences: ["API_LICENSE", "EMI"],
    ticket: [2_000_000, 9_000_000],
    needsActive: true,
    visibility: "PUBLIC",
  },
  {
    email: "isabel.ortiz@n5deal.demo",
    name: "Isabel Ortiz",
    company: "Sierra Lending",
    country: "ES",
    thesis: "Consumer lending books in southern Europe, with the licence attached.",
    categories: ["LENDING"],
    countries: ["ES", "PT", "IT"],
    licences: ["PI"],
    ticket: [500_000, 3_000_000],
    needsActive: true,
    visibility: "PUBLIC",
  },
  {
    email: "lukas.weber@n5deal.demo",
    name: "Lukas Weber",
    company: "Weber Industrie Beteiligungen",
    country: "DE",
    thesis:
      "First financial-services acquisition for a family office; banking licence preferred.",
    categories: ["BANKING", "EMONEY"],
    countries: ["DE", "LU", "CH"],
    licences: ["BANK", "EMI"],
    ticket: [8_000_000, 40_000_000],
    needsActive: false,
    visibility: "VERIFIED_ONLY",
  },
  {
    email: "marek.jasinski@n5deal.demo",
    name: "Marek Jasinski",
    company: "Vistula Fintech",
    country: "PL",
    thesis: "Small payment institution in CEE to serve our existing merchant base.",
    categories: ["PAYMENTS"],
    countries: ["PL", "CZ", "SK", "LT"],
    licences: ["SEMI", "PI"],
    ticket: [200_000, 1_200_000],
    needsActive: false,
    visibility: "PUBLIC",
  },
  {
    email: "nour.aziz@n5deal.demo",
    name: "Nour Aziz",
    company: "Levant Payments",
    country: "AE",
    thesis: "MENA money services business with SWIFT connectivity.",
    categories: ["PAYMENTS", "FINTECH"],
    countries: ["AE", "GI"],
    licences: ["MSO"],
    ticket: [1_500_000, 7_000_000],
    needsActive: true,
    visibility: "PUBLIC",
  },
  {
    email: "peter.olsen@n5deal.demo",
    name: "Peter Olsen",
    company: "Kattegat Holdings",
    country: "DK",
    thesis: "Opportunistic — any EU licence at the right price.",
    categories: ["PAYMENTS", "EMONEY", "CRYPTO", "FINTECH"],
    countries: ["LT", "EE", "MT", "CY", "PL"],
    licences: ["EMI", "PI", "SEMI", "VASP"],
    ticket: [100_000, 1_500_000],
    needsActive: false,
    visibility: "PUBLIC",
  },
  {
    email: "grace.okafor@n5deal.demo",
    name: "Grace Okafor",
    company: "Harmattan Capital",
    country: "GB",
    thesis: "Cross-border remittance business serving African corridors.",
    categories: ["PAYMENTS"],
    countries: ["GB", "AE", "US"],
    licences: ["MSO", "MTL"],
    ticket: [1_000_000, 5_000_000],
    needsActive: true,
    visibility: "PUBLIC",
  },
  {
    email: "yuki.tanaka@n5deal.demo",
    name: "Yuki Tanaka",
    company: "Shinsei Digital",
    country: "SG",
    thesis: "Regulated crypto custody and exchange, APAC or EU.",
    categories: ["CRYPTO"],
    countries: ["SG", "HK", "CH", "MT"],
    licences: ["VASP"],
    ticket: [2_000_000, 15_000_000],
    needsActive: false,
    visibility: "PUBLIC",
  },
  {
    email: "andrea.rossi@n5deal.demo",
    name: "Andrea Rossi",
    company: "Po Valley Partners",
    country: "IT",
    thesis: "Italian or Maltese e-money institution with card issuing.",
    categories: ["EMONEY"],
    countries: ["IT", "MT"],
    licences: ["EMI"],
    ticket: [1_200_000, 5_500_000],
    needsActive: false,
    visibility: "PUBLIC",
  },
  {
    email: "sean.murphy@n5deal.demo",
    name: "Sean Murphy",
    company: "Liffey Forex",
    country: "IE",
    thesis: "FX brokerage with an EU passport and an existing client book.",
    categories: ["FOREX"],
    countries: ["IE", "CY", "MT"],
    licences: ["PI"],
    ticket: [600_000, 3_500_000],
    needsActive: true,
    visibility: "PUBLIC",
  },
  // Hidden on purpose: sellers must not see this one in the buyer catalogue.
  {
    email: "quiet.buyer@n5deal.demo",
    name: "Confidential Mandate",
    company: "Undisclosed Family Office",
    country: "CH",
    thesis: "Mandate withheld while a competing process is running.",
    categories: ["BANKING", "EMONEY", "PAYMENTS"],
    countries: ["CH", "LU", "LI"],
    licences: ["BANK", "EMI"],
    ticket: [10_000_000, 60_000_000],
    needsActive: false,
    visibility: "HIDDEN",
  },
] as const;

const TITLE_PATTERNS: Record<BusinessCategory, readonly string[]> = {
  PAYMENTS: [
    "Payment institution with SEPA and merchant book",
    "Cross-border payments business, corporate clients",
    "Licensed payment provider with acquiring partner",
  ],
  FINTECH: [
    "Neobank platform with licence and core software",
    "B2B fintech with embedded finance stack",
    "Fintech entity with API-first payment rails",
  ],
  CRYPTO: [
    "Regulated crypto exchange with custody",
    "VASP with fiat on-ramp and banking relations",
    "Digital asset broker with compliance stack",
  ],
  BANKING: [
    "Full banking licence with deposit book",
    "Specialist bank, corporate lending focus",
    "Private bank with wealth clients",
  ],
  EMONEY: [
    "E-money institution with IBAN issuing",
    "EMI with card programme and BIN sponsorship",
    "Clean EMI licence, no legacy operations",
  ],
  FOREX: [
    "FX brokerage with EU passporting",
    "Retail forex business with client book",
    "Institutional FX desk with liquidity agreements",
  ],
  LENDING: [
    "Consumer lending business with performing book",
    "SME lender with origination platform",
    "Licensed credit intermediary",
  ],
  GAMBLING: [
    "Licensed gaming operator with payment stack",
    "B2B gaming platform with certifications",
    "Online casino licence with player base",
  ],
};

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

async function main() {
  console.log("Clearing existing data…");
  // Order matters only where a cascade does not already cover it; being explicit
  // keeps the script readable and re-runnable.
  await db.moderationEvent.deleteMany();
  await db.message.deleteMany();
  await db.thread.deleteMany();
  await db.asset.deleteMany();
  await db.buyerProfile.deleteMany();
  await db.sellerProfile.deleteMany();
  await db.user.deleteMany();

  const passwordHash = await hash(DEMO_PASSWORD, 10);

  // --- Manager -------------------------------------------------------------
  const manager = await db.user.create({
    data: {
      email: "manager@n5deal.demo",
      name: "Priya Raman",
      role: "MANAGER",
      passwordHash,
    },
  });

  // --- Sellers -------------------------------------------------------------
  const sellers: Array<{ id: string; email: string; name: string }> = [];
  for (const spec of SELLERS) {
    const suspended = "suspend" in spec ? spec.suspend : undefined;
    const removed = "remove" in spec ? spec.remove : undefined;

    const user = await db.user.create({
      data: {
        email: spec.email,
        name: spec.name,
        role: "SELLER",
        passwordHash,
        status: removed ? "REMOVED" : suspended ? "SUSPENDED" : "ACTIVE",
        statusReason: removed ?? suspended ?? null,
        statusChangedAt: removed || suspended ? daysAgo(intBetween(2, 9)) : null,
        sellerProfile: {
          create: {
            company: spec.company,
            country: spec.country,
            verified: spec.verified,
            about: spec.about,
            website: `https://${spec.company.toLowerCase().replace(/[^a-z]+/g, "-")}.example`,
          },
        },
      },
    });

    if (removed || suspended) {
      await db.moderationEvent.create({
        data: {
          actorId: manager.id,
          targetType: "USER",
          action: removed ? "REMOVE" : "SUSPEND",
          targetUserId: user.id,
          reason: (removed ?? suspended)!,
          previousStatus: "ACTIVE",
          createdAt: daysAgo(intBetween(2, 9)),
        },
      });
    }

    sellers.push(user);
  }

  // --- Buyers --------------------------------------------------------------
  const buyers: Array<{ id: string; email: string; name: string }> = [];
  for (const spec of BUYERS) {
    const user = await db.user.create({
      data: {
        email: spec.email,
        name: spec.name,
        role: "BUYER",
        passwordHash,
        buyerProfile: {
          create: {
            company: spec.company,
            country: spec.country,
            thesis: spec.thesis,
            targetCategories: [...spec.categories] as BusinessCategory[],
            targetCountries: [...spec.countries],
            targetLicenseTypes: [...spec.licences] as LicenseType[],
            ticketMin: BigInt(spec.ticket[0]) * 100n,
            ticketMax: BigInt(spec.ticket[1]) * 100n,
            currency: "EUR" as Currency,
            needsActiveLicense: spec.needsActive,
            visibility: spec.visibility,
          },
        },
      },
    });
    buyers.push(user);
  }

  // --- Assets --------------------------------------------------------------
  //
  // Status mix is chosen so that the seller dashboard shows every lifecycle
  // state and the public catalogue still has enough to filter through.
  const STATUS_MIX: AssetStatus[] = [
    ...Array<AssetStatus>(30).fill("PUBLISHED"),
    "DRAFT",
    "DRAFT",
    "DRAFT",
    "SOLD",
    "SOLD",
    "ARCHIVED",
  ];

  const assets = [];
  for (let i = 0; i < 42; i += 1) {
    // Sellers with a status problem get a couple of listings each, no more —
    // enough to demonstrate the cascade without skewing the catalogue.
    const seller =
      i % 13 === 5
        ? sellers[5] // suspended seller
        : i % 17 === 9
          ? sellers[6] // removed seller
          : sellers[i % 5];

    const jurisdiction = pick(JURISDICTIONS);
    const licenseType = pick(jurisdiction.licences);
    const category = pick(CATEGORIES);
    const businessStatus: BusinessStatus = rng() < 0.45 ? "ACTIVE" : "LICENSE_ONLY";
    const isActiveBusiness = businessStatus === "ACTIVE";

    const priceMajor =
      licenseType === "BANK"
        ? intBetween(8_000_000, 45_000_000)
        : isActiveBusiness
          ? intBetween(700_000, 9_000_000)
          : intBetween(120_000, 3_500_000);

    const status = STATUS_MIX[i % STATUS_MIX.length];

    const asset = await db.asset.create({
      data: {
        sellerId: seller.id,
        title: pick(TITLE_PATTERNS[category]),
        description: buildDescription(category, jurisdiction.country, isActiveBusiness),
        category,
        licenseType,
        country: jurisdiction.country,
        regulator: jurisdiction.regulator,
        businessStatus,
        benefits: pickSome(BENEFITS, isActiveBusiness ? 3 : 1, isActiveBusiness ? 7 : 4),
        askingPrice: BigInt(priceMajor) * 100n,
        currency: "EUR",
        employees: isActiveBusiness
          ? intBetween(3, 90)
          : rng() < 0.4
            ? intBetween(1, 4)
            : null,
        yearOfIssue: intBetween(2013, 2025),
        status,
        publishedAt: status === "DRAFT" ? null : daysAgo(intBetween(1, 180)),
        viewCount: status === "DRAFT" ? 0 : intBetween(4, 480),
        createdAt: daysAgo(intBetween(1, 200)),
      },
    });
    assets.push(asset);
  }

  // One asset suspended by the manager, with the prior status recorded so that
  // unsuspend restores it rather than guessing "PUBLISHED".
  const toSuspend = assets.find(
    (a) => a.status === "PUBLISHED" && a.sellerId === sellers[2].id,
  );
  if (toSuspend) {
    const reason =
      "Asking price and licence scope contradict the uploaded register extract.";
    await db.asset.update({
      where: { id: toSuspend.id },
      data: {
        status: "SUSPENDED",
        previousStatus: toSuspend.status,
        statusReason: reason,
        statusChangedAt: daysAgo(3),
      },
    });
    await db.moderationEvent.create({
      data: {
        actorId: manager.id,
        targetType: "ASSET",
        action: "SUSPEND",
        targetAssetId: toSuspend.id,
        reason,
        previousStatus: toSuspend.status,
        createdAt: daysAgo(3),
      },
    });
  }

  // --- Conversations -------------------------------------------------------
  //
  // Seeded so that the demo buyer and the demo seller both land on a non-empty
  // inbox, and so the "contact again reopens the same thread" rule has an
  // existing thread to be tested against.
  const publishedByActiveSellers = assets.filter(
    (a) =>
      a.status === "PUBLISHED" &&
      a.sellerId !== sellers[5].id &&
      a.sellerId !== sellers[6].id,
  );

  const conversations: Array<{ buyer: number; asset: number; lines: string[] }> = [
    {
      buyer: 0,
      asset: 0,
      lines: [
        "Good afternoon — is the IBAN issuing live today, or does it need reactivation after closing?",
        "It is live. Two of the three payment rails are in production, the third is contracted but not switched on yet.",
        "Understood. Could you share the last two years of regulatory correspondence under NDA?",
      ],
    },
    {
      buyer: 2,
      asset: 1,
      lines: [
        "Is the compliance team staying with the entity, or is this a licence-only transfer?",
        "Three of five stay, including the MLRO. The other two are on notice already.",
      ],
    },
    {
      buyer: 4,
      asset: 2,
      lines: [
        "We are interested but the asking price is above our range. Is there flexibility on an earn-out?",
      ],
    },
    {
      buyer: 1,
      asset: 3,
      lines: [
        "What is the current monthly processing volume?",
        "Around EUR 4.2M, growing about 6% month over month for the last two quarters.",
        "Thanks — sending our indicative terms this week.",
      ],
    },
  ];

  for (const spec of conversations) {
    const asset = publishedByActiveSellers[spec.asset];
    const buyer = buyers[spec.buyer];
    if (!asset || !buyer) continue;

    const key = `${asset.id}:${buyer.id}:${asset.sellerId}`;
    const createdAt = daysAgo(intBetween(4, 30));

    const thread = await db.thread.create({
      data: {
        key,
        assetId: asset.id,
        buyerId: buyer.id,
        sellerId: asset.sellerId,
        createdAt,
        lastMessageAt: createdAt,
      },
    });

    let when = createdAt;
    for (const [index, body] of spec.lines.entries()) {
      when = new Date(when.getTime() + intBetween(2, 40) * 60 * 60 * 1000);
      await db.message.create({
        data: {
          threadId: thread.id,
          // The buyer opens the thread, then the two alternate.
          senderId: index % 2 === 0 ? buyer.id : asset.sellerId,
          body,
          createdAt: when,
          readAt: index < spec.lines.length - 1 ? when : null,
        },
      });
    }

    await db.thread.update({
      where: { id: thread.id },
      data: { lastMessageAt: when },
    });
  }

  const counts = {
    users: await db.user.count(),
    sellers: await db.user.count({ where: { role: "SELLER" } }),
    buyers: await db.user.count({ where: { role: "BUYER" } }),
    assets: await db.asset.count(),
    published: await db.asset.count({
      where: { status: "PUBLISHED", seller: { status: "ACTIVE" } },
    }),
    threads: await db.thread.count(),
    messages: await db.message.count(),
    moderationEvents: await db.moderationEvent.count(),
  };

  console.log("Seeded:", counts);
  console.log(`\nDemo accounts (password: ${DEMO_PASSWORD}):`);
  console.log("  seller@n5deal.demo   — Marta Kovalenko");
  console.log("  buyer@n5deal.demo    — Anders Holm");
  console.log("  manager@n5deal.demo  — Priya Raman");
}

function buildDescription(
  category: BusinessCategory,
  country: string,
  isActive: boolean,
): string {
  const operating = isActive
    ? "The entity is operating, with revenue and a client base in place."
    : "The entity is clean: the licence is in good standing with no operations, no clients and no liabilities.";

  const sector: Record<BusinessCategory, string> = {
    PAYMENTS:
      "Payment services with settlement accounts and an established processing partner.",
    FINTECH: "Technology-led financial services business with its own product stack.",
    CRYPTO: "Digital asset services, registered for exchange and custody activities.",
    BANKING: "Credit institution with a full deposit-taking permission.",
    EMONEY:
      "Electronic money institution authorised to issue e-money and hold client funds.",
    FOREX: "Foreign exchange brokerage with execution and liquidity arrangements.",
    LENDING: "Consumer and SME lending with an originated loan book.",
    GAMBLING: "Licensed gaming operations with certified platform integrations.",
  };

  return `${sector[category]} Registered in ${country}. ${operating} Full data room available to qualified buyers after NDA.`;
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
