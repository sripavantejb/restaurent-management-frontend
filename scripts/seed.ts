/**
 * Seed RestaurantOS — rich realistic mock data for Tiffinate (Hyderabad).
 * Run: npm run seed
 *
 * SAFETY: refuses to run against production-like URIs unless ALLOW_SEED=1.
 * Demo password for all accounts: demo1234
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const envCandidates = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), ".env.local"),
  resolve(process.cwd(), "../frontend/.env.local"),
  resolve(process.cwd(), "../frontend/.env"),
  resolve(process.cwd(), "frontend/.env.local"),
];
for (const envPath of envCandidates) {
  try {
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
    break;
  } catch {
    /* try next */
  }
}

function assertSeedAllowed(uri: string) {
  const allow = process.env.ALLOW_SEED === "1";
  const looksProd =
    process.env.NODE_ENV === "production" ||
    /prod|production|live/i.test(uri) ||
    process.env.VERCEL_ENV === "production";
  if (looksProd && !allow) {
    console.error(
      "Refusing to seed: set ALLOW_SEED=1 only if you intentionally wipe this database."
    );
    process.exit(1);
  }
  if (!allow && !/127\.0\.0\.1|localhost|cluster0/i.test(uri)) {
    console.warn(
      "Tip: set ALLOW_SEED=1 to confirm seeding a remote MongoDB cluster."
    );
  }
}

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/restaurantos";

function paise(rupees: number) {
  return Math.round(rupees * 100);
}

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

function randInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function daysAgo(n: number, hour = 12, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, randInt(0, 50), 0);
  return d;
}

const CATEGORIES = [
  "Starters",
  "Biryani",
  "Curries",
  "Breads",
  "Rice & Dal",
  "Chinese",
  "Tandoor",
  "Desserts & Drinks",
];

type MenuSeed = {
  category: string;
  name: string;
  description: string;
  price: number;
  isVeg: boolean;
  prepTimeMins: number;
  spiceLevel?: number;
  allergens?: string[];
  hsnCode?: string;
  stationCode?: string;
  tags?: string[];
  variants?: { name: string; priceDelta: number }[];
  addons?: { name: string; price: number }[];
};

const MENU: MenuSeed[] = [
  { category: "Starters", name: "Paneer Tikka", description: "Tandoor-grilled cottage cheese with mint chutney", price: paise(280), isVeg: true, prepTimeMins: 18, spiceLevel: 2, allergens: ["dairy"], stationCode: "TAND", variants: [{ name: "Half", priceDelta: paise(-80) }, { name: "Full", priceDelta: 0 }], addons: [{ name: "Extra mint chutney", price: paise(20) }] },
  { category: "Starters", name: "Chicken 65", description: "Spicy deep-fried chicken, Hyderabadi style", price: paise(320), isVeg: false, prepTimeMins: 16, spiceLevel: 3, allergens: [], stationCode: "FRY" },
  { category: "Starters", name: "Gobi Manchurian", description: "Crispy cauliflower in Indo-Chinese sauce", price: paise(240), isVeg: true, prepTimeMins: 14, spiceLevel: 2, allergens: ["gluten", "soy"], stationCode: "CHIN" },
  { category: "Starters", name: "Fish Amritsari", description: "Ajwain-spiced battered fish", price: paise(380), isVeg: false, prepTimeMins: 20, spiceLevel: 2, allergens: ["fish", "gluten"], stationCode: "FRY" },
  { category: "Starters", name: "Hara Bhara Kebab", description: "Spinach and green pea patties", price: paise(220), isVeg: true, prepTimeMins: 12, spiceLevel: 1, allergens: ["dairy"], stationCode: "GRILL" },
  { category: "Starters", name: "Mutton Seekh Kebab", description: "Minced mutton on skewers", price: paise(360), isVeg: false, prepTimeMins: 22, spiceLevel: 2, allergens: [], stationCode: "TAND" },
  { category: "Starters", name: "Corn Cheese Balls", description: "Crispy corn-cheese fritters", price: paise(200), isVeg: true, prepTimeMins: 12, spiceLevel: 1, allergens: ["dairy", "gluten"], stationCode: "FRY" },
  { category: "Starters", name: "Chicken Lollipop", description: "Frenched winglets in spicy batter", price: paise(300), isVeg: false, prepTimeMins: 18, spiceLevel: 3, allergens: ["gluten"], stationCode: "FRY" },
  { category: "Starters", name: "Veg Spring Roll", description: "Crispy rolls with mixed veg stuffing", price: paise(180), isVeg: true, prepTimeMins: 12, spiceLevel: 1, allergens: ["gluten", "soy"], stationCode: "CHIN" },
  { category: "Starters", name: "Chilli Chicken Dry", description: "Indo-Chinese chilli chicken", price: paise(340), isVeg: false, prepTimeMins: 16, spiceLevel: 3, allergens: ["soy", "gluten"], stationCode: "CHIN" },
  { category: "Biryani", name: "Hyderabadi Chicken Biryani", description: "Dum-cooked basmati with chicken & saffron", price: paise(350), isVeg: false, prepTimeMins: 28, spiceLevel: 2, allergens: ["dairy"], stationCode: "BIRY", tags: ["bestseller"], variants: [{ name: "Regular", priceDelta: 0 }, { name: "Family pack", priceDelta: paise(450) }], addons: [{ name: "Raita", price: paise(40) }, { name: "Mirchi ka salan", price: paise(50) }] },
  { category: "Biryani", name: "Veg Dum Biryani", description: "Aromatic vegetables and saffron rice", price: paise(280), isVeg: true, prepTimeMins: 25, spiceLevel: 2, allergens: ["dairy"], stationCode: "BIRY", addons: [{ name: "Raita", price: paise(40) }] },
  { category: "Biryani", name: "Mutton Biryani", description: "Slow-cooked mutton dum biryani", price: paise(420), isVeg: false, prepTimeMins: 32, spiceLevel: 2, allergens: ["dairy"], stationCode: "BIRY", tags: ["bestseller"] },
  { category: "Biryani", name: "Egg Biryani", description: "Spiced rice with boiled eggs", price: paise(260), isVeg: false, prepTimeMins: 22, spiceLevel: 2, allergens: ["egg", "dairy"], stationCode: "BIRY" },
  { category: "Biryani", name: "Paneer Biryani", description: "Cottage cheese dum biryani", price: paise(300), isVeg: true, prepTimeMins: 24, spiceLevel: 2, allergens: ["dairy"], stationCode: "BIRY" },
  { category: "Biryani", name: "Prawn Biryani", description: "Coastal-style prawn biryani", price: paise(450), isVeg: false, prepTimeMins: 30, spiceLevel: 2, allergens: ["shellfish", "dairy"], stationCode: "BIRY" },
  { category: "Biryani", name: "Keema Biryani", description: "Minced mutton layered biryani", price: paise(390), isVeg: false, prepTimeMins: 30, spiceLevel: 2, allergens: ["dairy"], stationCode: "BIRY" },
  { category: "Biryani", name: "Special Chicken Biryani", description: "Boneless chicken, extra saffron & fried onions", price: paise(420), isVeg: false, prepTimeMins: 30, spiceLevel: 2, allergens: ["dairy"], stationCode: "BIRY", tags: ["bestseller"] },
  { category: "Curries", name: "Butter Chicken", description: "Tomato-butter gravy with tender chicken", price: paise(340), isVeg: false, prepTimeMins: 20, spiceLevel: 1, allergens: ["dairy"], stationCode: "CURY", tags: ["bestseller"], variants: [{ name: "Half", priceDelta: paise(-100) }, { name: "Full", priceDelta: 0 }] },
  { category: "Curries", name: "Paneer Butter Masala", description: "Creamy tomato paneer curry", price: paise(300), isVeg: true, prepTimeMins: 18, spiceLevel: 1, allergens: ["dairy"], stationCode: "CURY" },
  { category: "Curries", name: "Dal Makhani", description: "Overnight black lentils with cream", price: paise(260), isVeg: true, prepTimeMins: 15, spiceLevel: 1, allergens: ["dairy"], stationCode: "CURY" },
  { category: "Curries", name: "Chicken Chettinad", description: "Peppery South Indian chicken", price: paise(330), isVeg: false, prepTimeMins: 22, spiceLevel: 3, allergens: [], stationCode: "CURY" },
  { category: "Curries", name: "Palak Paneer", description: "Spinach gravy with paneer", price: paise(280), isVeg: true, prepTimeMins: 16, spiceLevel: 1, allergens: ["dairy"], stationCode: "CURY" },
  { category: "Curries", name: "Mutton Rogan Josh", description: "Kashmiri-style mutton curry", price: paise(400), isVeg: false, prepTimeMins: 28, spiceLevel: 2, allergens: ["dairy"], stationCode: "CURY" },
  { category: "Curries", name: "Chana Masala", description: "Punjabi chickpea curry", price: paise(220), isVeg: true, prepTimeMins: 14, spiceLevel: 2, allergens: [], stationCode: "CURY" },
  { category: "Curries", name: "Fish Curry", description: "Tangy coastal fish gravy", price: paise(360), isVeg: false, prepTimeMins: 20, spiceLevel: 2, allergens: ["fish"], stationCode: "CURY" },
  { category: "Curries", name: "Kadai Chicken", description: "Bell pepper & onion kadai gravy", price: paise(340), isVeg: false, prepTimeMins: 20, spiceLevel: 2, allergens: [], stationCode: "CURY" },
  { category: "Curries", name: "Malai Kofta", description: "Cottage cheese dumplings in cream gravy", price: paise(320), isVeg: true, prepTimeMins: 18, spiceLevel: 1, allergens: ["dairy", "nuts"], stationCode: "CURY" },
  { category: "Breads", name: "Butter Naan", description: "Tandoor-baked leavened bread", price: paise(60), isVeg: true, prepTimeMins: 8, spiceLevel: 0, allergens: ["gluten", "dairy"], stationCode: "TAND", addons: [{ name: "Garlic", price: paise(15) }, { name: "Cheese", price: paise(40) }] },
  { category: "Breads", name: "Garlic Naan", description: "Naan brushed with garlic butter", price: paise(75), isVeg: true, prepTimeMins: 8, spiceLevel: 0, allergens: ["gluten", "dairy"], stationCode: "TAND" },
  { category: "Breads", name: "Tandoori Roti", description: "Whole-wheat tandoor roti", price: paise(40), isVeg: true, prepTimeMins: 6, spiceLevel: 0, allergens: ["gluten"], stationCode: "TAND" },
  { category: "Breads", name: "Laccha Paratha", description: "Layered whole-wheat paratha", price: paise(70), isVeg: true, prepTimeMins: 10, spiceLevel: 0, allergens: ["gluten"], stationCode: "TAND" },
  { category: "Breads", name: "Roomali Roti", description: "Handkerchief-thin roti", price: paise(50), isVeg: true, prepTimeMins: 7, spiceLevel: 0, allergens: ["gluten"], stationCode: "TAND" },
  { category: "Breads", name: "Cheese Naan", description: "Stuffed mozzarella cheese naan", price: paise(110), isVeg: true, prepTimeMins: 10, spiceLevel: 0, allergens: ["gluten", "dairy"], stationCode: "TAND" },
  { category: "Breads", name: "Kulcha", description: "Amritsari-style stuffed kulcha", price: paise(90), isVeg: true, prepTimeMins: 12, spiceLevel: 1, allergens: ["gluten", "dairy"], stationCode: "TAND" },
  { category: "Rice & Dal", name: "Jeera Rice", description: "Cumin-tempered basmati", price: paise(150), isVeg: true, prepTimeMins: 12, spiceLevel: 0, allergens: [], stationCode: "CURY" },
  { category: "Rice & Dal", name: "Steamed Rice", description: "Plain basmati rice", price: paise(120), isVeg: true, prepTimeMins: 10, spiceLevel: 0, allergens: [], stationCode: "CURY" },
  { category: "Rice & Dal", name: "Yellow Dal Tadka", description: "Tempered toor dal", price: paise(180), isVeg: true, prepTimeMins: 12, spiceLevel: 1, allergens: [], stationCode: "CURY" },
  { category: "Rice & Dal", name: "Curd Rice", description: "Cooling yogurt rice with tempering", price: paise(140), isVeg: true, prepTimeMins: 8, spiceLevel: 0, allergens: ["dairy"], stationCode: "COLD" },
  { category: "Rice & Dal", name: "Lemon Rice", description: "Tangy tempered rice", price: paise(160), isVeg: true, prepTimeMins: 10, spiceLevel: 1, allergens: [], stationCode: "CURY" },
  { category: "Chinese", name: "Veg Fried Rice", description: "Wok-tossed veg fried rice", price: paise(220), isVeg: true, prepTimeMins: 14, spiceLevel: 1, allergens: ["soy", "gluten"], stationCode: "CHIN" },
  { category: "Chinese", name: "Chicken Fried Rice", description: "Classic chicken fried rice", price: paise(260), isVeg: false, prepTimeMins: 14, spiceLevel: 1, allergens: ["soy", "gluten", "egg"], stationCode: "CHIN" },
  { category: "Chinese", name: "Veg Hakka Noodles", description: "Stir-fried noodles with veggies", price: paise(230), isVeg: true, prepTimeMins: 14, spiceLevel: 1, allergens: ["gluten", "soy"], stationCode: "CHIN" },
  { category: "Chinese", name: "Chicken Manchurian Gravy", description: "Indo-Chinese chicken in gravy", price: paise(320), isVeg: false, prepTimeMins: 16, spiceLevel: 2, allergens: ["soy", "gluten"], stationCode: "CHIN" },
  { category: "Tandoor", name: "Tandoori Chicken", description: "Classic tandoori half / full", price: paise(380), isVeg: false, prepTimeMins: 30, spiceLevel: 2, allergens: ["dairy"], stationCode: "TAND", variants: [{ name: "Half", priceDelta: paise(-120) }, { name: "Full", priceDelta: 0 }] },
  { category: "Tandoor", name: "Malai Paneer Tikka", description: "Creamy white paneer tikka", price: paise(300), isVeg: true, prepTimeMins: 18, spiceLevel: 1, allergens: ["dairy"], stationCode: "TAND" },
  { category: "Tandoor", name: "Tandoori Prawns", description: "Jumbo prawns in tandoor marinade", price: paise(480), isVeg: false, prepTimeMins: 20, spiceLevel: 2, allergens: ["shellfish", "dairy"], stationCode: "TAND" },
  { category: "Desserts & Drinks", name: "Gulab Jamun", description: "Two pieces in warm sugar syrup", price: paise(120), isVeg: true, prepTimeMins: 5, spiceLevel: 0, allergens: ["dairy", "gluten"], stationCode: "COLD" },
  { category: "Desserts & Drinks", name: "Rasmalai", description: "Two soft cheese patties in rabdi", price: paise(140), isVeg: true, prepTimeMins: 5, spiceLevel: 0, allergens: ["dairy"], stationCode: "COLD" },
  { category: "Desserts & Drinks", name: "Kulfi Falooda", description: "Saffron kulfi with vermicelli", price: paise(160), isVeg: true, prepTimeMins: 6, spiceLevel: 0, allergens: ["dairy", "nuts"], stationCode: "COLD" },
  { category: "Desserts & Drinks", name: "Masala Chaas", description: "Spiced buttermilk", price: paise(80), isVeg: true, prepTimeMins: 3, spiceLevel: 1, allergens: ["dairy"], stationCode: "COLD" },
  { category: "Desserts & Drinks", name: "Sweet Lassi", description: "Chilled yogurt drink", price: paise(100), isVeg: true, prepTimeMins: 3, spiceLevel: 0, allergens: ["dairy"], stationCode: "COLD" },
  { category: "Desserts & Drinks", name: "Filter Coffee", description: "South Indian filter coffee", price: paise(90), isVeg: true, prepTimeMins: 4, spiceLevel: 0, allergens: ["dairy"], stationCode: "COLD" },
  { category: "Desserts & Drinks", name: "Fresh Lime Soda", description: "Sweet / salt / mixed", price: paise(90), isVeg: true, prepTimeMins: 3, spiceLevel: 0, allergens: [], stationCode: "COLD", variants: [{ name: "Sweet", priceDelta: 0 }, { name: "Salt", priceDelta: 0 }, { name: "Mixed", priceDelta: paise(10) }] },
  { category: "Desserts & Drinks", name: "Mango Ice Cream", description: "Two scoops seasonal Alphonso", price: paise(130), isVeg: true, prepTimeMins: 2, spiceLevel: 0, allergens: ["dairy"], stationCode: "COLD" },
  { category: "Desserts & Drinks", name: "Irani Chai", description: "Hyderabadi Irani style chai", price: paise(60), isVeg: true, prepTimeMins: 4, spiceLevel: 0, allergens: ["dairy"], stationCode: "COLD" },
  { category: "Desserts & Drinks", name: "Double ka Meetha", description: "Hyderabadi bread pudding dessert", price: paise(150), isVeg: true, prepTimeMins: 5, spiceLevel: 0, allergens: ["dairy", "gluten", "nuts"], stationCode: "COLD", tags: ["local"] },
];

const CUSTOMER_NAMES = [
  ["Rahul", "Sharma"], ["Priya", "Reddy"], ["Aisha", "Khan"], ["Vikram", "Singh"],
  ["Sneha", "Iyer"], ["Karthik", "Nair"], ["Ananya", "Rao"], ["Mohammed", "Ali"],
  ["Divya", "Patel"], ["Rohit", "Mehta"], ["Fatima", "Begum"], ["Suresh", "Goud"],
  ["Lakshmi", "Devi"], ["Arjun", "Varma"], ["Neha", "Kapoor"], ["Imran", "Shaikh"],
  ["Pooja", "Agarwal"], ["Sanjay", "Joshi"], ["Meera", "Krishnan"], ["Aditya", "Menon"],
  ["Kavya", "Choudhary"], ["Nikhil", "Deshmukh"], ["Sara", "Hussain"], ["Vivek", "Bansal"],
  ["Ishita", "Malhotra"], ["Harsha", "Vardhan"], ["Zoya", "Qureshi"], ["Gaurav", "Tiwari"],
];

async function main() {
  assertSeedAllowed(MONGODB_URI);
  console.log("Connecting to", MONGODB_URI.replace(/:[^:@]+@/, ":***@"));
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db!;

  // Drop all collections (ignore system)
  const cols = await db.listCollections().toArray();
  for (const c of cols) {
    if (!c.name.startsWith("system.")) await db.dropCollection(c.name);
  }
  console.log("Cleared database");

  // Clear model cache so re-runs don't conflict
  for (const name of Object.keys(mongoose.models)) {
    delete mongoose.models[name];
  }

  const Restaurant = mongoose.model(
    "Restaurant",
    new mongoose.Schema(
      {
        name: String,
        slug: String,
        status: String,
        plan: String,
        billingStatus: String,
        trialEndsAt: Date,
        contactEmail: String,
        contactPhone: String,
        logoUrl: String,
        gstNumber: String,
        fssaiNumber: String,
        currency: String,
        timezone: String,
        address: String,
        qrSecretVersion: Number,
        qrOrderingEnabled: Boolean,
        qrApprovalMode: Boolean,
        menuVersion: String,
        modules: mongoose.Schema.Types.Mixed,
        limitOverrides: {
          maxBranches: Number,
          maxStaff: Number,
          maxTables: Number,
        },
        taxSettings: { gstRate: Number },
        receiptSettings: { thankYou: String, terms: String },
      },
      { timestamps: true }
    )
  );

  const PlatformAdmin = mongoose.model(
    "PlatformAdmin",
    new mongoose.Schema(
      { name: String, email: String, passwordHash: String, isActive: Boolean },
      { timestamps: true }
    )
  );

  const Branch = mongoose.model(
    "Branch",
    new mongoose.Schema(
      {
        restaurantId: mongoose.Schema.Types.ObjectId,
        name: String,
        code: String,
        address: String,
        isActive: Boolean,
      },
      { timestamps: true }
    )
  );

  const User = mongoose.model(
    "User",
    new mongoose.Schema(
      {
        restaurantId: mongoose.Schema.Types.ObjectId,
        branchId: mongoose.Schema.Types.ObjectId,
        name: String,
        email: String,
        passwordHash: String,
        role: String,
        isActive: Boolean,
      },
      { timestamps: true }
    )
  );

  const Floor = mongoose.model(
    "Floor",
    new mongoose.Schema(
      {
        restaurantId: mongoose.Schema.Types.ObjectId,
        branchId: mongoose.Schema.Types.ObjectId,
        name: String,
        sortOrder: Number,
      },
      { timestamps: true }
    )
  );

  const Table = mongoose.model(
    "Table",
    new mongoose.Schema(
      {
        restaurantId: mongoose.Schema.Types.ObjectId,
        branchId: mongoose.Schema.Types.ObjectId,
        number: Number,
        capacity: Number,
        shape: String,
        x: Number,
        y: Number,
        status: String,
        floorId: mongoose.Schema.Types.ObjectId,
        isVip: Boolean,
        isOutdoor: Boolean,
        currentSessionId: mongoose.Schema.Types.ObjectId,
      },
      { timestamps: true }
    )
  );

  const MenuCategory = mongoose.model(
    "MenuCategory",
    new mongoose.Schema(
      {
        restaurantId: mongoose.Schema.Types.ObjectId,
        branchId: mongoose.Schema.Types.ObjectId,
        name: String,
        sortOrder: Number,
        isActive: Boolean,
      },
      { timestamps: true }
    )
  );

  const MenuItem = mongoose.model(
    "MenuItem",
    new mongoose.Schema(
      {
        restaurantId: mongoose.Schema.Types.ObjectId,
        branchId: mongoose.Schema.Types.ObjectId,
        categoryId: mongoose.Schema.Types.ObjectId,
        name: String,
        description: String,
        price: Number,
        imageUrl: String,
        isVeg: Boolean,
        prepTimeMins: Number,
        isAvailable: Boolean,
        spiceLevel: Number,
        allergens: [String],
        tags: [String],
        hsnCode: String,
        stationCode: String,
        repeatRate: Number,
        variants: [{ name: String, priceDelta: Number }],
        addons: [{ name: String, price: Number }],
      },
      { timestamps: true }
    )
  );

  const Order = mongoose.model(
    "Order",
    new mongoose.Schema(
      {
        restaurantId: mongoose.Schema.Types.ObjectId,
        branchId: mongoose.Schema.Types.ObjectId,
        orderNumber: String,
        type: String,
        tableId: mongoose.Schema.Types.ObjectId,
        waiterId: mongoose.Schema.Types.ObjectId,
        sessionId: mongoose.Schema.Types.ObjectId,
        status: String,
        placedBy: String,
        roundNumber: Number,
        items: [
          {
            menuItemId: mongoose.Schema.Types.ObjectId,
            name: String,
            qty: Number,
            unitPrice: Number,
            variant: String,
            addons: [String],
            notes: String,
            status: String,
          },
        ],
        subtotal: Number,
        discountAmount: Number,
        taxAmount: Number,
        total: Number,
        placedAt: Date,
        readyAt: Date,
        servedAt: Date,
        completedAt: Date,
      },
      { timestamps: true }
    )
  );

  const Payment = mongoose.model(
    "Payment",
    new mongoose.Schema(
      {
        restaurantId: mongoose.Schema.Types.ObjectId,
        branchId: mongoose.Schema.Types.ObjectId,
        orderId: mongoose.Schema.Types.ObjectId,
        sessionId: mongoose.Schema.Types.ObjectId,
        customerId: mongoose.Schema.Types.ObjectId,
        method: String,
        amount: Number,
        tenderedAmount: Number,
        changeAmount: Number,
        isPartial: Boolean,
        paidAt: Date,
      },
      { timestamps: true }
    )
  );

  const InventoryItem = mongoose.model(
    "InventoryItem",
    new mongoose.Schema(
      {
        restaurantId: mongoose.Schema.Types.ObjectId,
        branchId: mongoose.Schema.Types.ObjectId,
        name: String,
        sku: String,
        unit: String,
        quantityOnHand: Number,
        reorderLevel: Number,
        costPerUnit: Number,
        isActive: Boolean,
      },
      { timestamps: true }
    )
  );

  const Recipe = mongoose.model(
    "Recipe",
    new mongoose.Schema(
      {
        restaurantId: mongoose.Schema.Types.ObjectId,
        branchId: mongoose.Schema.Types.ObjectId,
        menuItemId: mongoose.Schema.Types.ObjectId,
        lines: [
          {
            inventoryItemId: mongoose.Schema.Types.ObjectId,
            qtyPerServe: Number,
          },
        ],
      },
      { timestamps: true }
    )
  );

  const Customer = mongoose.model(
    "Customer",
    new mongoose.Schema(
      {
        restaurantId: mongoose.Schema.Types.ObjectId,
        branchId: mongoose.Schema.Types.ObjectId,
        phone: String,
        name: String,
        email: String,
        visitCount: Number,
        loyaltyPoints: Number,
        walletPaise: Number,
        membership: String,
        totalSpendPaise: Number,
        birthday: String,
      },
      { timestamps: true }
    )
  );

  const Coupon = mongoose.model(
    "Coupon",
    new mongoose.Schema(
      {
        restaurantId: mongoose.Schema.Types.ObjectId,
        branchId: mongoose.Schema.Types.ObjectId,
        code: String,
        type: String,
        value: Number,
        minOrderPaise: Number,
        maxRedemptions: Number,
        redeemedCount: Number,
        validFrom: Date,
        validTo: Date,
        isActive: Boolean,
      },
      { timestamps: true }
    )
  );

  const Attendance = mongoose.model(
    "Attendance",
    new mongoose.Schema(
      {
        restaurantId: mongoose.Schema.Types.ObjectId,
        branchId: mongoose.Schema.Types.ObjectId,
        userId: mongoose.Schema.Types.ObjectId,
        date: String,
        checkInAt: Date,
        checkOutAt: Date,
        status: String,
        notes: String,
      },
      { timestamps: true }
    )
  );

  const LeaveRequest = mongoose.model(
    "LeaveRequest",
    new mongoose.Schema(
      {
        restaurantId: mongoose.Schema.Types.ObjectId,
        branchId: mongoose.Schema.Types.ObjectId,
        userId: mongoose.Schema.Types.ObjectId,
        type: String,
        status: String,
        fromDate: String,
        toDate: String,
        days: Number,
        reason: String,
        reviewedBy: mongoose.Schema.Types.ObjectId,
        reviewedAt: Date,
        reviewNote: String,
      },
      { timestamps: true }
    )
  );

  const PayrollEntry = mongoose.model(
    "PayrollEntry",
    new mongoose.Schema(
      {
        restaurantId: mongoose.Schema.Types.ObjectId,
        branchId: mongoose.Schema.Types.ObjectId,
        userId: mongoose.Schema.Types.ObjectId,
        period: String,
        basePaise: Number,
        daysPresent: Number,
        daysLeave: Number,
        netPaise: Number,
        notes: String,
      },
      { timestamps: true }
    )
  );

  const Expense = mongoose.model(
    "Expense",
    new mongoose.Schema(
      {
        restaurantId: mongoose.Schema.Types.ObjectId,
        branchId: mongoose.Schema.Types.ObjectId,
        category: String,
        description: String,
        amountPaise: Number,
        paidAt: Date,
        paymentMethod: String,
        vendor: String,
      },
      { timestamps: true }
    )
  );

  const Reservation = mongoose.model(
    "Reservation",
    new mongoose.Schema(
      {
        restaurantId: mongoose.Schema.Types.ObjectId,
        branchId: mongoose.Schema.Types.ObjectId,
        guestName: String,
        phone: String,
        email: String,
        partySize: Number,
        tableId: mongoose.Schema.Types.ObjectId,
        scheduledAt: Date,
        status: String,
        notes: String,
        source: String,
      },
      { timestamps: true }
    )
  );

  const Supplier = mongoose.model(
    "Supplier",
    new mongoose.Schema(
      {
        restaurantId: mongoose.Schema.Types.ObjectId,
        branchId: mongoose.Schema.Types.ObjectId,
        company: String,
        gstNumber: String,
        phone: String,
        email: String,
        address: String,
        rating: Number,
        outstandingPaise: Number,
        lastPurchaseAt: Date,
        isActive: Boolean,
      },
      { timestamps: true }
    )
  );

  const KitchenStation = mongoose.model(
    "KitchenStation",
    new mongoose.Schema(
      {
        restaurantId: mongoose.Schema.Types.ObjectId,
        branchId: mongoose.Schema.Types.ObjectId,
        name: String,
        code: String,
        isActive: Boolean,
      },
      { timestamps: true }
    )
  );

  const TableSession = mongoose.model(
    "TableSession",
    new mongoose.Schema(
      {
        restaurantId: mongoose.Schema.Types.ObjectId,
        branchId: mongoose.Schema.Types.ObjectId,
        sessionNumber: String,
        tableIds: [mongoose.Schema.Types.ObjectId],
        status: String,
        source: String,
        guestCount: Number,
        guestName: String,
        guestPhone: String,
        orderIds: [mongoose.Schema.Types.ObjectId],
        rounds: Number,
        subtotal: Number,
        discountAmount: Number,
        taxAmount: Number,
        serviceCharge: Number,
        tipAmount: Number,
        total: Number,
        paidAmount: Number,
        dueAmount: Number,
        openedAt: Date,
        lastActivityAt: Date,
      },
      { timestamps: true }
    )
  );

  const GuestRating = mongoose.model(
    "GuestRating",
    new mongoose.Schema(
      {
        restaurantId: mongoose.Schema.Types.ObjectId,
        branchId: mongoose.Schema.Types.ObjectId,
        sessionId: mongoose.Schema.Types.ObjectId,
        stars: Number,
        comment: String,
      },
      { timestamps: true }
    )
  );

  const Campaign = mongoose.model(
    "Campaign",
    new mongoose.Schema(
      {
        restaurantId: mongoose.Schema.Types.ObjectId,
        branchId: mongoose.Schema.Types.ObjectId,
        name: String,
        channel: String,
        status: String,
        message: String,
        audienceCount: Number,
        sentCount: Number,
      },
      { timestamps: true }
    )
  );

  const passwordHash = await bcrypt.hash("demo1234", 10);

  await PlatformAdmin.create({
    name: "Platform Admin",
    email: "admin@restaurantos.com",
    passwordHash,
    isActive: true,
  });

  const allModules = {
    pos: true,
    kds: true,
    tables: true,
    orders: true,
    menu: true,
    inventory: true,
    finance: true,
    crm: true,
    hr: true,
    ai: true,
    qr: true,
    reservations: true,
    marketing: true,
    reports: true,
    staff: true,
  };

  const restaurant = await Restaurant.create({
    name: "Tiffinate",
    slug: "tiffinate",
    status: "ACTIVE",
    plan: "GROWTH",
    billingStatus: "ACTIVE",
    trialEndsAt: null,
    modules: allModules,
    limitOverrides: { maxBranches: null, maxStaff: null, maxTables: null },
    contactEmail: "owner@demo.com",
    contactPhone: "+91 98765 43210",
    logoUrl: "",
    gstNumber: "36AABCU9603R1ZM",
    fssaiNumber: "13624001000123",
    currency: "INR",
    timezone: "Asia/Kolkata",
    address: "Road No. 12, Banjara Hills, Hyderabad, Telangana 500034",
    qrSecretVersion: 1,
    qrOrderingEnabled: true,
    qrApprovalMode: false,
    menuVersion: "2",
    taxSettings: { gstRate: 5 },
    receiptSettings: {
      thankYou: "Thank you for dining at Tiffinate — visit again!",
      terms: "All prices in INR. GST as applicable. No refunds on takeaway.",
    },
  });

  // Second demo tenant — STARTER with fewer modules (for platform admin contrast)
  await Restaurant.create({
    name: "Spice Trail Cafe",
    slug: "spice-trail",
    status: "PENDING",
    plan: "STARTER",
    billingStatus: "TRIAL",
    trialEndsAt: new Date(Date.now() + 5 * 86400000),
    modules: {
      pos: true,
      kds: true,
      tables: true,
      orders: true,
      menu: true,
      inventory: false,
      finance: false,
      crm: false,
      hr: false,
      ai: false,
      qr: true,
      reservations: false,
      marketing: false,
      reports: true,
      staff: true,
    },
    limitOverrides: { maxBranches: 1, maxStaff: 5, maxTables: 20 },
    contactEmail: "hello@spicetrail.demo",
    contactPhone: "+91 90000 11111",
    address: "Gachibowli, Hyderabad",
    currency: "INR",
    timezone: "Asia/Kolkata",
    qrOrderingEnabled: true,
  });

  const [b1, b2] = await Branch.create([
    {
      restaurantId: restaurant._id,
      name: "Banjara Hills",
      code: "B1",
      address: "Road No. 12, Banjara Hills, Hyderabad 500034",
      isActive: true,
    },
    {
      restaurantId: restaurant._id,
      name: "Gachibowli",
      code: "B2",
      address: "Survey No. 78, Financial District, Gachibowli 500032",
      isActive: true,
    },
  ]);

  const staffDefs = [
    { name: "Ananya Owner", email: "owner@demo.com", role: "OWNER", branchId: b1._id },
    { name: "Rohan Manager", email: "manager@demo.com", role: "MANAGER", branchId: b1._id },
    { name: "Priya Cashier", email: "cashier@demo.com", role: "CASHIER", branchId: b1._id },
    { name: "Arjun Waiter", email: "waiter@demo.com", role: "WAITER", branchId: b1._id },
    { name: "Chef Meera", email: "chef@demo.com", role: "CHEF", branchId: b1._id },
    { name: "Sana Waiter", email: "waiter2@demo.com", role: "WAITER", branchId: b1._id },
    { name: "Kabir Waiter", email: "waiter3@demo.com", role: "WAITER", branchId: b1._id },
    { name: "Chef Ravi", email: "chef2@demo.com", role: "CHEF", branchId: b1._id },
    { name: "Nisha Cashier", email: "cashier2@demo.com", role: "CASHIER", branchId: b2._id },
    { name: "Vikram Manager", email: "manager2@demo.com", role: "MANAGER", branchId: b2._id },
    { name: "Leela Waiter", email: "waiter.b2@demo.com", role: "WAITER", branchId: b2._id },
    { name: "Chef Imran", email: "chef.b2@demo.com", role: "CHEF", branchId: b2._id },
  ];
  const createdUsers = await User.insertMany(
    staffDefs.map((u) => ({
      ...u,
      restaurantId: restaurant._id,
      passwordHash,
      isActive: true,
    }))
  );
  const waitersB1 = createdUsers.filter(
    (u) => u.role === "WAITER" && String(u.branchId) === String(b1._id)
  );
  const waiter = waitersB1[0];

  // Floors + tables B1
  const [ground, terrace] = await Floor.create([
    { restaurantId: restaurant._id, branchId: b1._id, name: "Ground", sortOrder: 0 },
    { restaurantId: restaurant._id, branchId: b1._id, name: "Terrace", sortOrder: 1 },
  ]);
  await Floor.create({
    restaurantId: restaurant._id,
    branchId: b2._id,
    name: "Main",
    sortOrder: 0,
  });

  const shapes = ["SQUARE", "ROUND", "RECT"] as const;
  const tablesB1 = [];
  for (let i = 0; i < 18; i++) {
    const col = i % 6;
    const row = Math.floor(i / 6);
    const onTerrace = i >= 12;
    tablesB1.push({
      restaurantId: restaurant._id,
      branchId: b1._id,
      number: i + 1,
      capacity: i % 5 === 0 ? 8 : i % 3 === 0 ? 6 : i % 2 === 0 ? 4 : 2,
      shape: shapes[i % 3],
      x: 40 + col * 130,
      y: 40 + (row % 3) * 120,
      status: "AVAILABLE",
      floorId: onTerrace ? terrace._id : ground._id,
      isVip: i === 0 || i === 5,
      isOutdoor: onTerrace,
    });
  }
  const createdTables = await Table.insertMany(tablesB1);

  const tablesB2 = await Table.insertMany(
    Array.from({ length: 10 }, (_, i) => ({
      restaurantId: restaurant._id,
      branchId: b2._id,
      number: i + 1,
      capacity: i % 2 === 0 ? 4 : 6,
      shape: "SQUARE",
      x: 40 + (i % 5) * 130,
      y: 40 + Math.floor(i / 5) * 120,
      status: "AVAILABLE",
      isVip: i === 0,
      isOutdoor: false,
    }))
  );

  async function seedMenu(branchId: mongoose.Types.ObjectId) {
    const cats = await MenuCategory.insertMany(
      CATEGORIES.map((name, sortOrder) => ({
        restaurantId: restaurant._id,
        branchId,
        name,
        sortOrder,
        isActive: true,
      }))
    );
    const catMap = new Map(cats.map((c) => [c.name, c._id]));
    return MenuItem.insertMany(
      MENU.map((m, idx) => ({
        restaurantId: restaurant._id,
        branchId,
        categoryId: catMap.get(m.category),
        name: m.name,
        description: m.description,
        price: m.price,
        imageUrl: "",
        isVeg: m.isVeg,
        prepTimeMins: m.prepTimeMins,
        isAvailable: idx === 8 ? false : true, // one sold-out for realism
        spiceLevel: m.spiceLevel ?? 0,
        allergens: m.allergens ?? [],
        tags: m.tags ?? [],
        hsnCode: m.hsnCode || "996331",
        stationCode: m.stationCode || "",
        repeatRate: m.tags?.includes("bestseller") ? 0.55 : 0.12 + (idx % 7) * 0.04,
        variants: m.variants ?? [],
        addons: m.addons ?? [],
      }))
    );
  }

  const itemsB1 = await seedMenu(b1._id);
  const itemsB2 = await seedMenu(b2._id);

  for (const branchId of [b1._id, b2._id]) {
    await KitchenStation.insertMany(
      [
        { name: "Tandoor", code: "TAND" },
        { name: "Biryani", code: "BIRY" },
        { name: "Curry", code: "CURY" },
        { name: "Chinese", code: "CHIN" },
        { name: "Fryer", code: "FRY" },
        { name: "Cold / Bar", code: "COLD" },
      ].map((s) => ({
        restaurantId: restaurant._id,
        branchId,
        ...s,
        isActive: true,
      }))
    );
  }

  const stockDefs = [
    { name: "Paneer", sku: "PN-01", unit: "KG", quantityOnHand: 14, reorderLevel: 4, costPerUnit: paise(420) },
    { name: "Chicken", sku: "CK-01", unit: "KG", quantityOnHand: 28, reorderLevel: 8, costPerUnit: paise(280) },
    { name: "Mutton", sku: "MT-01", unit: "KG", quantityOnHand: 12, reorderLevel: 4, costPerUnit: paise(620) },
    { name: "Basmati rice", sku: "RC-01", unit: "KG", quantityOnHand: 55, reorderLevel: 15, costPerUnit: paise(120) },
    { name: "Maida", sku: "FL-01", unit: "KG", quantityOnHand: 18, reorderLevel: 5, costPerUnit: paise(45) },
    { name: "Butter", sku: "BT-01", unit: "KG", quantityOnHand: 9, reorderLevel: 3, costPerUnit: paise(550) },
    { name: "Tomato puree", sku: "TM-01", unit: "L", quantityOnHand: 12, reorderLevel: 3, costPerUnit: paise(80) },
    { name: "Cooking oil", sku: "OL-01", unit: "L", quantityOnHand: 22, reorderLevel: 6, costPerUnit: paise(160) },
    { name: "Mint leaves", sku: "MN-01", unit: "KG", quantityOnHand: 1.2, reorderLevel: 0.8, costPerUnit: paise(200) },
    { name: "Onions", sku: "ON-01", unit: "KG", quantityOnHand: 40, reorderLevel: 10, costPerUnit: paise(35) },
    { name: "Yogurt", sku: "YG-01", unit: "KG", quantityOnHand: 8, reorderLevel: 3, costPerUnit: paise(70) },
    { name: "Cream", sku: "CR-01", unit: "L", quantityOnHand: 6, reorderLevel: 2, costPerUnit: paise(180) },
    { name: "Garam masala", sku: "SP-01", unit: "KG", quantityOnHand: 2.5, reorderLevel: 0.5, costPerUnit: paise(900) },
    { name: "Prawns", sku: "PR-01", unit: "KG", quantityOnHand: 4, reorderLevel: 2, costPerUnit: paise(780) },
    { name: "Noodles", sku: "ND-01", unit: "KG", quantityOnHand: 1.5, reorderLevel: 2, costPerUnit: paise(95) }, // low stock
  ];

  for (const branchId of [b1._id, b2._id]) {
    await InventoryItem.insertMany(
      stockDefs.map((s) => ({
        ...s,
        restaurantId: restaurant._id,
        branchId,
        isActive: true,
        quantityOnHand:
          String(branchId) === String(b2._id)
            ? Math.max(1, Math.round(s.quantityOnHand * 0.7))
            : s.quantityOnHand,
      }))
    );
  }

  const recipeLinks: { menu: string; lines: { inv: string; qty: number }[] }[] = [
    { menu: "Paneer Tikka", lines: [{ inv: "Paneer", qty: 0.18 }, { inv: "Mint leaves", qty: 0.02 }, { inv: "Yogurt", qty: 0.05 }] },
    { menu: "Butter Chicken", lines: [{ inv: "Chicken", qty: 0.25 }, { inv: "Butter", qty: 0.04 }, { inv: "Tomato puree", qty: 0.12 }, { inv: "Cream", qty: 0.05 }] },
    { menu: "Hyderabadi Chicken Biryani", lines: [{ inv: "Chicken", qty: 0.3 }, { inv: "Basmati rice", qty: 0.2 }, { inv: "Onions", qty: 0.08 }, { inv: "Yogurt", qty: 0.06 }] },
    { menu: "Mutton Biryani", lines: [{ inv: "Mutton", qty: 0.28 }, { inv: "Basmati rice", qty: 0.2 }, { inv: "Onions", qty: 0.1 }] },
    { menu: "Butter Naan", lines: [{ inv: "Maida", qty: 0.08 }, { inv: "Butter", qty: 0.015 }] },
    { menu: "Paneer Butter Masala", lines: [{ inv: "Paneer", qty: 0.2 }, { inv: "Butter", qty: 0.03 }, { inv: "Tomato puree", qty: 0.1 }] },
    { menu: "Chicken Fried Rice", lines: [{ inv: "Chicken", qty: 0.12 }, { inv: "Basmati rice", qty: 0.15 }, { inv: "Cooking oil", qty: 0.02 }] },
  ];

  async function seedRecipes(branchId: mongoose.Types.ObjectId) {
    const stock = await InventoryItem.find({ restaurantId: restaurant._id, branchId });
    const menu = await MenuItem.find({ restaurantId: restaurant._id, branchId });
    const invId = (n: string) => stock.find((s) => s.name === n)!._id;
    const menuId = (n: string) => menu.find((m) => m.name === n)!._id;
    for (const r of recipeLinks) {
      if (!menu.find((m) => m.name === r.menu)) continue;
      await Recipe.create({
        restaurantId: restaurant._id,
        branchId,
        menuItemId: menuId(r.menu),
        lines: r.lines
          .filter((l) => stock.some((s) => s.name === l.inv))
          .map((l) => ({ inventoryItemId: invId(l.inv), qtyPerServe: l.qty })),
      });
    }
  }
  await seedRecipes(b1._id);
  await seedRecipes(b2._id);

  // Suppliers
  await Supplier.insertMany([
    { restaurantId: restaurant._id, branchId: b1._id, company: "Deccan Fresh Meats", gstNumber: "36AAPFD1234A1Z5", phone: "9876501001", email: "orders@deccanmeats.in", address: "Attapur, Hyderabad", rating: 5, outstandingPaise: paise(18500), lastPurchaseAt: daysAgo(2), isActive: true },
    { restaurantId: restaurant._id, branchId: b1._id, company: "Green Valley Produce", gstNumber: "36AAPGV5678B1Z2", phone: "9876501002", email: "sales@greenvalley.in", address: "Bowenpally Market", rating: 4, outstandingPaise: paise(6200), lastPurchaseAt: daysAgo(1), isActive: true },
    { restaurantId: restaurant._id, branchId: b1._id, company: "Spice Route Traders", gstNumber: "36AAPSR9012C1Z8", phone: "9876501003", email: "hello@spiceroute.in", address: "Begum Bazaar", rating: 5, outstandingPaise: 0, lastPurchaseAt: daysAgo(5), isActive: true },
    { restaurantId: restaurant._id, branchId: b2._id, company: "Gachi Foods Pvt Ltd", gstNumber: "36AAPGF3456D1Z1", phone: "9876502001", email: "ops@gachifoods.in", address: "Gachibowli", rating: 4, outstandingPaise: paise(9400), lastPurchaseAt: daysAgo(3), isActive: true },
  ]);

  // Customers
  const customers = await Customer.insertMany(
    CUSTOMER_NAMES.map(([first, last], i) => {
      const visits = randInt(2, 28);
      const spend = paise(visits * randInt(450, 2200));
      return {
        restaurantId: restaurant._id,
        branchId: i % 3 === 0 ? b2._id : b1._id,
        phone: `98${String(76543210 + i).padStart(8, "0")}`,
        name: `${first} ${last}`,
        email: `${first.toLowerCase()}.${last.toLowerCase()}@email.com`,
        visitCount: visits,
        loyaltyPoints: visits * randInt(8, 25),
        walletPaise: i % 4 === 0 ? paise(randInt(200, 1500)) : 0,
        membership: spend > paise(25000) ? "GOLD" : spend > paise(10000) ? "SILVER" : "STANDARD",
        totalSpendPaise: spend,
        birthday: i % 7 === 0 ? `199${i % 10}-0${(i % 9) + 1}-15` : null,
      };
    })
  );

  // Coupons
  const now = new Date();
  await Coupon.insertMany([
    { restaurantId: restaurant._id, branchId: b1._id, code: "TIFFIN10", type: "PERCENT", value: 10, minOrderPaise: paise(500), maxRedemptions: 500, redeemedCount: 87, validFrom: daysAgo(60), validTo: new Date(now.getTime() + 60 * 86400000), isActive: true },
    { restaurantId: restaurant._id, branchId: b1._id, code: "BIRYANI50", type: "FLAT", value: paise(50), minOrderPaise: paise(350), maxRedemptions: 200, redeemedCount: 64, validFrom: daysAgo(20), validTo: new Date(now.getTime() + 40 * 86400000), isActive: true },
    { restaurantId: restaurant._id, branchId: b1._id, code: "WELCOME100", type: "FLAT", value: paise(100), minOrderPaise: paise(799), maxRedemptions: 1000, redeemedCount: 312, validFrom: daysAgo(90), validTo: new Date(now.getTime() + 90 * 86400000), isActive: true },
    { restaurantId: restaurant._id, branchId: b2._id, code: "GACHI15", type: "PERCENT", value: 15, minOrderPaise: paise(600), maxRedemptions: 300, redeemedCount: 41, validFrom: daysAgo(10), validTo: new Date(now.getTime() + 50 * 86400000), isActive: true },
  ]);

  // HR — full calendar month attendance + individual leaves + payroll (B1 + B2)
  const managerUser = createdUsers.find((u) => u.email === "manager@demo.com")!;
  const staffAll = createdUsers.filter((u) => u.role !== "OWNER");
  const leaveTypes = ["CASUAL", "SICK", "EARNED", "UNPAID", "COMP_OFF"] as const;
  const leaveReasons = [
    "Family function",
    "Fever / rest",
    "Personal errand",
    "Medical checkup",
    "Travel",
    "Wedding in family",
    "Comp-off for late shift",
  ];

  // Individual leave requests spanning this month + a few pending
  const leaveDocs: Record<string, unknown>[] = [];
  for (let i = 0; i < staffAll.length; i++) {
    const u = staffAll[i];
    const baseDay = 2 + (i % 18);
    const from = new Date();
    from.setDate(baseDay);
    from.setHours(12, 0, 0, 0);
    const span = i % 3 === 0 ? 2 : 1;
    const to = new Date(from);
    to.setDate(from.getDate() + span - 1);
    const fromDate = from.toISOString().slice(0, 10);
    const toDate = to.toISOString().slice(0, 10);
    const type = leaveTypes[i % leaveTypes.length];
    const status =
      i % 7 === 0 ? "PENDING" : i % 11 === 0 ? "REJECTED" : "APPROVED";
    leaveDocs.push({
      restaurantId: restaurant._id,
      branchId: u.branchId,
      userId: u._id,
      type,
      status,
      fromDate,
      toDate,
      days: span,
      reason: pick(leaveReasons, i),
      reviewedBy: status === "PENDING" ? null : managerUser._id,
      reviewedAt: status === "PENDING" ? null : daysAgo(Math.min(5, i % 5)),
      reviewNote:
        status === "APPROVED"
          ? "Approved by manager"
          : status === "REJECTED"
            ? "Insufficient cover on floor"
            : "",
    });
    // Second leave earlier in year for balance usage
    if (i % 2 === 0) {
      const early = daysAgo(40 + (i % 10));
      const earlyStr = early.toISOString().slice(0, 10);
      leaveDocs.push({
        restaurantId: restaurant._id,
        branchId: u.branchId,
        userId: u._id,
        type: leaveTypes[(i + 2) % leaveTypes.length],
        status: "APPROVED",
        fromDate: earlyStr,
        toDate: earlyStr,
        days: 1,
        reason: pick(leaveReasons, i + 3),
        reviewedBy: managerUser._id,
        reviewedAt: early,
        reviewNote: "Approved",
      });
    }
  }
  // One multi-day leave this month for waiter (individual demo)
  const waiterUser = createdUsers.find((u) => u.email === "waiter@demo.com")!;
  const midFrom = new Date();
  midFrom.setDate(12);
  const midTo = new Date();
  midTo.setDate(14);
  leaveDocs.push({
    restaurantId: restaurant._id,
    branchId: b1._id,
    userId: waiterUser._id,
    type: "CASUAL",
    status: "APPROVED",
    fromDate: midFrom.toISOString().slice(0, 10),
    toDate: midTo.toISOString().slice(0, 10),
    days: 3,
    reason: "Sister wedding — Hyderabad",
    reviewedBy: managerUser._id,
    reviewedAt: daysAgo(2),
    reviewNote: "Covered by waiter2",
  });
  await LeaveRequest.insertMany(leaveDocs);

  const approvedLeaveDates = new Map<string, Set<string>>();
  for (const lr of leaveDocs) {
    if (lr.status !== "APPROVED") continue;
    const uid = String(lr.userId);
    if (!approvedLeaveDates.has(uid)) approvedLeaveDates.set(uid, new Set());
    let d = new Date(String(lr.fromDate) + "T12:00:00");
    const end = new Date(String(lr.toDate) + "T12:00:00");
    while (d <= end) {
      approvedLeaveDates.get(uid)!.add(d.toISOString().slice(0, 10));
      d = new Date(d.getTime() + 86400000);
    }
  }

  // Full month attendance for all non-owner staff (both branches)
  const daysInMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0
  ).getDate();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const attBulk: Record<string, unknown>[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(monthStart);
    date.setDate(day);
    date.setHours(12, 0, 0, 0);
    if (date > now) continue; // don't invent future attendance
    const dateStr = date.toISOString().slice(0, 10);
    const isSunday = date.getDay() === 0;
    for (const u of staffAll) {
      const onApprovedLeave = approvedLeaveDates.get(String(u._id))?.has(dateStr);
      let status: string = "PRESENT";
      if (onApprovedLeave) status = "LEAVE";
      else if (isSunday && u.role !== "CHEF" && day % 2 === 0) status = "LEAVE";
      else if (day % 17 === 3 && u.role === "WAITER") status = "ABSENT";
      else if (day % 9 === 0 && (u.role === "WAITER" || u.role === "CASHIER"))
        status = "LATE";
      const checkIn = new Date(date);
      checkIn.setHours(status === "LATE" ? 10 : 9, randInt(0, 40), 0, 0);
      const checkOut = new Date(date);
      checkOut.setHours(22, randInt(0, 50), 0, 0);
      const isToday = dateStr === now.toISOString().slice(0, 10);
      attBulk.push({
        restaurantId: restaurant._id,
        branchId: u.branchId,
        userId: u._id,
        date: dateStr,
        status,
        checkInAt: status === "ABSENT" || status === "LEAVE" ? null : checkIn,
        checkOutAt:
          status === "ABSENT" || status === "LEAVE" || isToday ? null : checkOut,
        notes:
          status === "LATE"
            ? "Traffic"
            : status === "LEAVE"
              ? "Approved leave"
              : "",
      });
    }
  }
  if (attBulk.length) await Attendance.insertMany(attBulk);

  // Payroll stubs for current month from attendance
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  for (const u of staffAll) {
    const att = attBulk.filter(
      (a) => String(a.userId) === String(u._id) && String(a.date).startsWith(period)
    );
    const daysPresent = att.filter(
      (a) => a.status === "PRESENT" || a.status === "LATE"
    ).length;
    const daysLeave = att.filter((a) => a.status === "LEAVE").length;
    const basePaise =
      u.role === "MANAGER"
        ? 4500000
        : u.role === "CHEF"
          ? 2800000
          : u.role === "CASHIER"
            ? 2200000
            : 1800000;
    const perDay = Math.round(basePaise / 26);
    await PayrollEntry.create({
      restaurantId: restaurant._id,
      branchId: u.branchId,
      userId: u._id,
      period,
      basePaise,
      daysPresent,
      daysLeave,
      netPaise: Math.max(0, perDay * daysPresent),
      notes: "Seeded from month attendance",
    });
  }

  // Expenses last 30 days
  const expenseCats = [
    ["Rent", "Monthly rent — Banjara Hills", 185000, "BANK"],
    ["Utilities", "Electricity bill TSSPDCL", 28400, "UPI"],
    ["Utilities", "Water & gas", 9200, "UPI"],
    ["Payroll", "Weekly wage advance", 45000, "BANK"],
    ["Supplies", "Packaging & takeaway boxes", 6800, "UPI"],
    ["Marketing", "Instagram ads — weekend biryani", 12000, "CARD"],
    ["Maintenance", "AC service — dining hall", 4500, "CASH"],
    ["Supplies", "Cleaning consumables", 3200, "CASH"],
    ["Food cost", "Weekend meat purchase", 42000, "UPI"],
    ["Food cost", "Vegetables — Bowenpally", 15500, "CASH"],
  ] as const;
  for (let i = 0; i < 28; i++) {
    const [category, description, amt, method] = pick([...expenseCats], i);
    await Expense.create({
      restaurantId: restaurant._id,
      branchId: i % 5 === 0 ? b2._id : b1._id,
      category,
      description: `${description} (#${i + 1})`,
      amountPaise: paise(amt * (0.7 + (i % 5) * 0.1)),
      paidAt: daysAgo(i),
      paymentMethod: method,
      vendor: pick(["Landlord", "TSSPDCL", "Deccan Fresh Meats", "Green Valley", "Meta Ads", "Local vendor"], i),
    });
  }

  // Reservations — today + next 5 days
  for (let i = 0; i < 16; i++) {
    const [first, last] = pick(CUSTOMER_NAMES, i + 3);
    const when = new Date();
    when.setDate(when.getDate() + (i % 6));
    when.setHours(19 + (i % 3), (i * 15) % 60, 0, 0);
    await Reservation.create({
      restaurantId: restaurant._id,
      branchId: i % 4 === 0 ? b2._id : b1._id,
      guestName: `${first} ${last}`,
      phone: `99${String(10000000 + i).padStart(8, "0")}`,
      email: `${first.toLowerCase()}@mail.com`,
      partySize: randInt(2, 8),
      tableId: i % 3 === 0 ? createdTables[i % createdTables.length]._id : null,
      scheduledAt: when,
      status: pick(["BOOKED", "CONFIRMED", "CONFIRMED", "WAITLIST"], i),
      notes: i % 5 === 0 ? "Anniversary — window seat preferred" : "",
      source: pick(["PHONE", "WALK_IN", "APP", "INSTAGRAM"], i),
    });
  }

  await Campaign.insertMany([
    { restaurantId: restaurant._id, branchId: b1._id, name: "Weekend Biryani Blast", channel: "SMS", status: "SENT", message: "This weekend: Family biryani @ ₹749. Use BIRYANI50.", audienceCount: 420, sentCount: 418 },
    { restaurantId: restaurant._id, branchId: b1._id, name: "Gold members lunch", channel: "WHATSAPP", status: "DRAFT", message: "Exclusive 15% off weekday lunch for GOLD members.", audienceCount: 86, sentCount: 0 },
  ]);

  const methods = ["CASH", "CARD", "UPI", "UPI", "UPI"] as const;
  const notesPool = ["", "", "Less spicy", "No onion", "Extra raita", "Pack separately", ""];

  function buildOrderItems(
    menu: typeof itemsB1,
    seed: number,
    count: number
  ) {
    const orderItems = [];
    for (let k = 0; k < count; k++) {
      const it = pick(menu, seed * 7 + k * 3);
      const qty = 1 + ((seed + k) % 3 === 0 ? 1 : 0);
      orderItems.push({
        menuItemId: it._id,
        name: it.name,
        qty,
        unitPrice: it.price,
        variant: it.variants?.[0]?.name || "",
        addons: [] as string[],
        notes: pick(notesPool, seed + k),
        status: "READY",
      });
    }
    return orderItems;
  }

  // ~120 completed orders over 30 days on B1 (busier Fri–Sun evenings)
  let orderSeq = 1;
  for (let day = 0; day < 30; day++) {
    const d = daysAgo(day);
    const dow = d.getDay(); // 0 Sun
    const weekendBoost = dow === 0 || dow === 5 || dow === 6 ? 2 : 0;
    const ordersToday = 3 + weekendBoost + (day % 3);
    for (let j = 0; j < ordersToday; j++) {
      const hour = pick([12, 13, 13, 14, 19, 20, 20, 21, 22], day + j);
      const placedAt = daysAgo(day, hour, (j * 11) % 60);
      const prep = 12 + ((day + j) % 18);
      const readyAt = new Date(placedAt.getTime() + prep * 60000);
      const completedAt = new Date(readyAt.getTime() + (15 + (j % 20)) * 60000);
      const itemCount = 2 + ((day + j) % 3);
      const orderItems = buildOrderItems(itemsB1, day * 10 + j, itemCount);
      const subtotal = orderItems.reduce((s, x) => s + x.unitPrice * x.qty, 0);
      const discountAmount = (day + j) % 6 === 0 ? paise(50) : (day + j) % 11 === 0 ? paise(100) : 0;
      const taxAmount = Math.round((subtotal - discountAmount) * 0.05);
      const total = subtotal - discountAmount + taxAmount;
      const type = (day + j) % 5 === 0 ? "TAKEAWAY" : "DINE_IN";
      const table = createdTables[(day + j) % createdTables.length];
      const w = pick(waitersB1, day + j);

      const order = await Order.create({
        restaurantId: restaurant._id,
        branchId: b1._id,
        orderNumber: `B1-${String(orderSeq++).padStart(4, "0")}`,
        type,
        tableId: type === "DINE_IN" ? table._id : null,
        waiterId: w._id,
        status: "COMPLETED",
        placedBy: "STAFF",
        roundNumber: 1,
        items: orderItems,
        subtotal,
        discountAmount,
        taxAmount,
        total,
        placedAt,
        readyAt,
        servedAt: completedAt,
        completedAt,
      });

      const method = pick([...methods], day + j);
      const tendered = method === "CASH" ? total + paise(randInt(0, 2) * 100) : total;
      const cust = pick(customers, day + j);
      await Payment.create({
        restaurantId: restaurant._id,
        branchId: b1._id,
        orderId: order._id,
        customerId: (day + j) % 3 === 0 ? cust._id : null,
        method,
        amount: total,
        tenderedAmount: tendered,
        changeAmount: Math.max(0, tendered - total),
        isPartial: false,
        paidAt: completedAt,
      });

      if ((day + j) % 8 === 0) {
        await GuestRating.create({
          restaurantId: restaurant._id,
          branchId: b1._id,
          stars: pick([5, 5, 5, 4, 4, 3], day + j),
          comment: pick(
            [
              "Biryani was excellent!",
              "Service was quick.",
              "Loved the butter chicken.",
              "A bit spicy for kids.",
              "Will come again.",
              "",
            ],
            day + j
          ),
        });
      }
    }
  }

  // B2 history
  let b2Seq = 1;
  for (let day = 0; day < 20; day++) {
    for (let j = 0; j < 2 + (day % 2); j++) {
      const placedAt = daysAgo(day, 13 + j, 10);
      const orderItems = buildOrderItems(itemsB2, day + j, 2);
      const subtotal = orderItems.reduce((s, x) => s + x.unitPrice * x.qty, 0);
      const taxAmount = Math.round(subtotal * 0.05);
      const total = subtotal + taxAmount;
      const order = await Order.create({
        restaurantId: restaurant._id,
        branchId: b2._id,
        orderNumber: `B2-${String(b2Seq++).padStart(4, "0")}`,
        type: j % 2 === 0 ? "TAKEAWAY" : "DINE_IN",
        tableId: j % 2 === 0 ? null : tablesB2[j % tablesB2.length]._id,
        waiterId: createdUsers.find((u) => u.email === "waiter.b2@demo.com")!._id,
        status: "COMPLETED",
        placedBy: "STAFF",
        items: orderItems,
        subtotal,
        discountAmount: 0,
        taxAmount,
        total,
        placedAt,
        readyAt: new Date(placedAt.getTime() + 18 * 60000),
        servedAt: new Date(placedAt.getTime() + 28 * 60000),
        completedAt: new Date(placedAt.getTime() + 35 * 60000),
      });
      await Payment.create({
        restaurantId: restaurant._id,
        branchId: b2._id,
        orderId: order._id,
        method: "UPI",
        amount: total,
        tenderedAmount: total,
        changeAmount: 0,
        paidAt: order.completedAt,
      });
    }
  }

  // Live floor: occupy a few tables with open sessions + kitchen tickets
  const liveTables = [createdTables[1], createdTables[2], createdTables[4], createdTables[7]];
  for (let i = 0; i < liveTables.length; i++) {
    const t = liveTables[i];
    const openedAt = new Date(Date.now() - (20 + i * 12) * 60000);
    const liveItems = buildOrderItems(itemsB1, 90 + i, 2 + (i % 2)).map((it) => ({
      ...it,
      status: i === 0 ? "QUEUED" : i === 1 ? "COOKING" : "READY",
    }));
    const subtotal = liveItems.reduce((s, x) => s + x.unitPrice * x.qty, 0);
    const taxAmount = Math.round(subtotal * 0.05);
    const total = subtotal + taxAmount;

    const session = await TableSession.create({
      restaurantId: restaurant._id,
      branchId: b1._id,
      sessionNumber: `S-LIVE-${i + 1}`,
      tableIds: [t._id],
      status: i === 3 ? "BILL_REQUESTED" : "OPEN",
      source: i % 2 === 0 ? "QR" : "WAITER",
      guestCount: 2 + i,
      guestName: pick(CUSTOMER_NAMES, i).join(" "),
      guestPhone: customers[i].phone,
      orderIds: [],
      rounds: 1,
      subtotal,
      discountAmount: 0,
      taxAmount,
      serviceCharge: 0,
      tipAmount: 0,
      total,
      paidAmount: 0,
      dueAmount: total,
      openedAt,
      lastActivityAt: new Date(),
    });

    const liveOrder = await Order.create({
      restaurantId: restaurant._id,
      branchId: b1._id,
      orderNumber: `B1-LIVE-${i + 1}`,
      type: "DINE_IN",
      tableId: t._id,
      waiterId: pick(waitersB1, i)._id,
      sessionId: session._id,
      status: i === 0 ? "PLACED" : i === 1 ? "PREPARING" : i === 2 ? "READY" : "SERVED",
      placedBy: i % 2 === 0 ? "GUEST" : "STAFF",
      roundNumber: 1,
      items: liveItems,
      subtotal,
      discountAmount: 0,
      taxAmount,
      total,
      placedAt: openedAt,
      readyAt: i >= 2 ? new Date() : null,
      servedAt: i === 3 ? new Date() : null,
      completedAt: null,
    });

    session.orderIds = [liveOrder._id];
    await session.save();

    t.status = i === 3 ? "PREPARING_BILL" : "OCCUPIED";
    t.currentSessionId = session._id;
    await t.save();
  }

  // One cleaning table
  createdTables[10].status = "CLEANING";
  await createdTables[10].save();

  // A couple takeaway tickets still in kitchen
  for (let i = 0; i < 2; i++) {
    const items = buildOrderItems(itemsB1, 200 + i, 2).map((it) => ({
      ...it,
      status: "QUEUED",
    }));
    const subtotal = items.reduce((s, x) => s + x.unitPrice * x.qty, 0);
    const taxAmount = Math.round(subtotal * 0.05);
    await Order.create({
      restaurantId: restaurant._id,
      branchId: b1._id,
      orderNumber: `B1-TA-${i + 1}`,
      type: "TAKEAWAY",
      tableId: null,
      waiterId: waiter._id,
      status: "PLACED",
      placedBy: "STAFF",
      items,
      subtotal,
      discountAmount: 0,
      taxAmount,
      total: subtotal + taxAmount,
      placedAt: new Date(Date.now() - (5 + i * 3) * 60000),
      readyAt: null,
      servedAt: null,
      completedAt: null,
    });
  }

  const completedB1 = await Order.countDocuments({
    restaurantId: restaurant._id,
    branchId: b1._id,
    status: "COMPLETED",
  });
  const activeB1 = await Order.countDocuments({
    restaurantId: restaurant._id,
    branchId: b1._id,
    status: { $in: ["PLACED", "PREPARING", "READY", "SERVED"] },
  });

  console.log("\n========== Seed complete: Tiffinate ==========");
  console.log("Platform admin: admin@restaurantos.com / demo1234 → /admin/login");
  console.log("Restaurant:", restaurant.name, `(${restaurant.slug})`);
  console.log("Branches: Banjara Hills (B1), Gachibowli (B2)");
  console.log("Staff logins (*@demo.com / demo1234):");
  console.log("  owner, manager, cashier, waiter, chef (+ waiter2, waiter3, chef2, …)");
  console.log("Menu items / branch:", itemsB1.length);
  console.log("Tables B1:", createdTables.length, "| B2:", tablesB2.length);
  console.log("Customers:", customers.length);
  console.log("Completed orders B1:", completedB1, "| Live kitchen/floor tickets:", activeB1);
  console.log("Coupons: TIFFIN10, BIRYANI50, WELCOME100, GACHI15");
  console.log(
    "HR: month attendance + leave requests + payroll for",
    period
  );
  console.log("Platform: Tiffinate (all modules) + Spice Trail Cafe (STARTER trial)");
  console.log("==============================================\n");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
