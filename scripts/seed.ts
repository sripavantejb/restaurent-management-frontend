/**
 * Seed RestaurantOS demo data.
 * Run: npm run seed
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Load .env.local without dotenv package (backend/ or frontend/)
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
      if (m) process.env[m[1].trim()] = m[2].trim();
    }
    break;
  } catch {
    /* try next */
  }
}

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/restaurantos";

function paise(rupees: number) {
  return Math.round(rupees * 100);
}

const CATEGORIES = [
  "Starters",
  "Biryani",
  "Curries",
  "Breads",
  "Rice & Dal",
  "Desserts & Drinks",
];

type MenuSeed = {
  category: string;
  name: string;
  description: string;
  price: number;
  isVeg: boolean;
  prepTimeMins: number;
  variants?: { name: string; priceDelta: number }[];
  addons?: { name: string; price: number }[];
};

const MENU: MenuSeed[] = [
  { category: "Starters", name: "Paneer Tikka", description: "Tandoor-grilled cottage cheese", price: paise(280), isVeg: true, prepTimeMins: 18, variants: [{ name: "Half", priceDelta: paise(-80) }, { name: "Full", priceDelta: 0 }], addons: [{ name: "Extra mint chutney", price: paise(20) }] },
  { category: "Starters", name: "Chicken 65", description: "Spicy deep-fried chicken", price: paise(320), isVeg: false, prepTimeMins: 16 },
  { category: "Starters", name: "Gobi Manchurian", description: "Crispy cauliflower in Indo-Chinese sauce", price: paise(240), isVeg: true, prepTimeMins: 14 },
  { category: "Starters", name: "Fish Amritsari", description: "Ajwain-spiced battered fish", price: paise(380), isVeg: false, prepTimeMins: 20 },
  { category: "Starters", name: "Hara Bhara Kebab", description: "Spinach and pea patties", price: paise(220), isVeg: true, prepTimeMins: 12 },
  { category: "Starters", name: "Mutton Seekh Kebab", description: "Minced mutton on skewers", price: paise(360), isVeg: false, prepTimeMins: 22 },
  { category: "Starters", name: "Corn Cheese Balls", description: "Crispy corn-cheese fritters", price: paise(200), isVeg: true, prepTimeMins: 12 },
  { category: "Biryani", name: "Hyderabadi Chicken Biryani", description: "Dum-cooked basmati with chicken", price: paise(350), isVeg: false, prepTimeMins: 28, variants: [{ name: "Regular", priceDelta: 0 }, { name: "Family pack", priceDelta: paise(450) }], addons: [{ name: "Raita", price: paise(40) }, { name: "Mirchi ka salan", price: paise(50) }] },
  { category: "Biryani", name: "Veg Dum Biryani", description: "Aromatic vegetables and saffron rice", price: paise(280), isVeg: true, prepTimeMins: 25, addons: [{ name: "Raita", price: paise(40) }] },
  { category: "Biryani", name: "Mutton Biryani", description: "Slow-cooked mutton dum biryani", price: paise(420), isVeg: false, prepTimeMins: 32 },
  { category: "Biryani", name: "Egg Biryani", description: "Spiced rice with boiled eggs", price: paise(260), isVeg: false, prepTimeMins: 22 },
  { category: "Biryani", name: "Paneer Biryani", description: "Cottage cheese dum biryani", price: paise(300), isVeg: true, prepTimeMins: 24 },
  { category: "Biryani", name: "Prawn Biryani", description: "Coastal-style prawn biryani", price: paise(450), isVeg: false, prepTimeMins: 30 },
  { category: "Curries", name: "Butter Chicken", description: "Tomato-butter gravy with chicken", price: paise(340), isVeg: false, prepTimeMins: 20, variants: [{ name: "Half", priceDelta: paise(-100) }, { name: "Full", priceDelta: 0 }] },
  { category: "Curries", name: "Paneer Butter Masala", description: "Creamy tomato paneer curry", price: paise(300), isVeg: true, prepTimeMins: 18 },
  { category: "Curries", name: "Dal Makhani", description: "Overnight black lentils", price: paise(260), isVeg: true, prepTimeMins: 15 },
  { category: "Curries", name: "Chicken Chettinad", description: "Peppery South Indian chicken", price: paise(330), isVeg: false, prepTimeMins: 22 },
  { category: "Curries", name: "Palak Paneer", description: "Spinach gravy with paneer", price: paise(280), isVeg: true, prepTimeMins: 16 },
  { category: "Curries", name: "Mutton Rogan Josh", description: "Kashmiri-style mutton curry", price: paise(400), isVeg: false, prepTimeMins: 28 },
  { category: "Curries", name: "Chana Masala", description: "Punjabi chickpea curry", price: paise(220), isVeg: true, prepTimeMins: 14 },
  { category: "Curries", name: "Fish Curry", description: "Tangy coastal fish gravy", price: paise(360), isVeg: false, prepTimeMins: 20 },
  { category: "Breads", name: "Butter Naan", description: "Tandoor-baked leavened bread", price: paise(60), isVeg: true, prepTimeMins: 8, addons: [{ name: "Garlic", price: paise(15) }, { name: "Cheese", price: paise(40) }] },
  { category: "Breads", name: "Garlic Naan", description: "Naan brushed with garlic butter", price: paise(75), isVeg: true, prepTimeMins: 8 },
  { category: "Breads", name: "Tandoori Roti", description: "Whole-wheat tandoor roti", price: paise(40), isVeg: true, prepTimeMins: 6 },
  { category: "Breads", name: "Laccha Paratha", description: "Layered whole-wheat paratha", price: paise(70), isVeg: true, prepTimeMins: 10 },
  { category: "Breads", name: "Roomali Roti", description: "Handkerchief-thin roti", price: paise(50), isVeg: true, prepTimeMins: 7 },
  { category: "Breads", name: "Cheese Naan", description: "Stuffed cheese naan", price: paise(110), isVeg: true, prepTimeMins: 10 },
  { category: "Rice & Dal", name: "Jeera Rice", description: "Cumin-tempered basmati", price: paise(150), isVeg: true, prepTimeMins: 12 },
  { category: "Rice & Dal", name: "Steamed Rice", description: "Plain basmati rice", price: paise(120), isVeg: true, prepTimeMins: 10 },
  { category: "Rice & Dal", name: "Yellow Dal Tadka", description: "Tempered toor dal", price: paise(180), isVeg: true, prepTimeMins: 12 },
  { category: "Rice & Dal", name: "Curd Rice", description: "Cooling yogurt rice", price: paise(140), isVeg: true, prepTimeMins: 8 },
  { category: "Rice & Dal", name: "Lemon Rice", description: "Tangy tempered rice", price: paise(160), isVeg: true, prepTimeMins: 10 },
  { category: "Desserts & Drinks", name: "Gulab Jamun", description: "Two pieces in sugar syrup", price: paise(120), isVeg: true, prepTimeMins: 5 },
  { category: "Desserts & Drinks", name: "Rasmalai", description: "Two soft cheese patties in rabdi", price: paise(140), isVeg: true, prepTimeMins: 5 },
  { category: "Desserts & Drinks", name: "Kulfi Falooda", description: "Saffron kulfi with vermicelli", price: paise(160), isVeg: true, prepTimeMins: 6 },
  { category: "Desserts & Drinks", name: "Masala Chaas", description: "Spiced buttermilk", price: paise(80), isVeg: true, prepTimeMins: 3 },
  { category: "Desserts & Drinks", name: "Sweet Lassi", description: "Chilled yogurt drink", price: paise(100), isVeg: true, prepTimeMins: 3 },
  { category: "Desserts & Drinks", name: "Filter Coffee", description: "South Indian filter coffee", price: paise(90), isVeg: true, prepTimeMins: 4 },
  { category: "Desserts & Drinks", name: "Fresh Lime Soda", description: "Sweet / salt / mixed", price: paise(90), isVeg: true, prepTimeMins: 3, variants: [{ name: "Sweet", priceDelta: 0 }, { name: "Salt", priceDelta: 0 }, { name: "Mixed", priceDelta: paise(10) }] },
  { category: "Desserts & Drinks", name: "Mango Ice Cream", description: "Two scoops seasonal mango", price: paise(130), isVeg: true, prepTimeMins: 2 },
];

async function main() {
  console.log("Connecting to", MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  const db = mongoose.connection.db!;
  const cols = await db.listCollections().toArray();
  for (const c of cols) {
    await db.dropCollection(c.name);
  }
  console.log("Cleared database");

  // Inline schemas to avoid path-alias / plugin issues in seed
  const Restaurant = mongoose.model(
    "Restaurant",
    new mongoose.Schema(
      {
        name: String,
        slug: String,
        status: String,
        contactEmail: String,
        contactPhone: String,
        logoUrl: String,
        gstNumber: String,
        currency: String,
        timezone: String,
        address: String,
        qrSecretVersion: Number,
        qrOrderingEnabled: Boolean,
        qrApprovalMode: Boolean,
        menuVersion: String,
      },
      { timestamps: true }
    )
  );

  const PlatformAdmin = mongoose.model(
    "PlatformAdmin",
    new mongoose.Schema(
      {
        name: String,
        email: String,
        passwordHash: String,
        isActive: Boolean,
      },
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
        status: String,
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
        method: String,
        amount: Number,
        tenderedAmount: Number,
        changeAmount: Number,
        paidAt: Date,
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

  const restaurant = await Restaurant.create({
    name: "Tiffinate",
    slug: "tiffinate",
    status: "ACTIVE",
    contactEmail: "owner@demo.com",
    contactPhone: "",
    logoUrl: "",
    gstNumber: "36AABCU9603R1ZM",
    currency: "INR",
    timezone: "Asia/Kolkata",
    address: "Hyderabad, Telangana",
    qrSecretVersion: 1,
    qrOrderingEnabled: true,
    qrApprovalMode: false,
    menuVersion: "1",
  });

  const [b1, b2] = await Branch.create([
    {
      restaurantId: restaurant._id,
      name: "Banjara Hills",
      code: "B1",
      address: "Road No. 12, Banjara Hills",
      isActive: true,
    },
    {
      restaurantId: restaurant._id,
      name: "Gachibowli",
      code: "B2",
      address: "Financial District, Gachibowli",
      isActive: true,
    },
  ]);

  const users = [
    { name: "Ananya Owner", email: "owner@demo.com", role: "OWNER", branchId: b1._id },
    { name: "Rohan Manager", email: "manager@demo.com", role: "MANAGER", branchId: b1._id },
    { name: "Priya Cashier", email: "cashier@demo.com", role: "CASHIER", branchId: b1._id },
    { name: "Arjun Waiter", email: "waiter@demo.com", role: "WAITER", branchId: b1._id },
    { name: "Chef Meera", email: "chef@demo.com", role: "CHEF", branchId: b1._id },
  ];
  const createdUsers = await User.insertMany(
    users.map((u) => ({
      ...u,
      restaurantId: restaurant._id,
      passwordHash,
      isActive: true,
    }))
  );

  // 12 tables on branch 1 in a grid
  const shapes = ["SQUARE", "ROUND", "RECT"] as const;
  const tables = [];
  for (let i = 0; i < 12; i++) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    tables.push({
      restaurantId: restaurant._id,
      branchId: b1._id,
      number: i + 1,
      capacity: i % 3 === 0 ? 6 : i % 2 === 0 ? 4 : 2,
      shape: shapes[i % 3],
      x: 40 + col * 140,
      y: 40 + row * 120,
      status: "FREE",
    });
  }
  const createdTables = await Table.insertMany(tables);

  // Also a few tables on branch 2
  await Table.insertMany(
    [1, 2, 3, 4].map((n, i) => ({
      restaurantId: restaurant._id,
      branchId: b2._id,
      number: n,
      capacity: 4,
      shape: "SQUARE",
      x: 40 + (i % 2) * 140,
      y: 40 + Math.floor(i / 2) * 120,
      status: "FREE",
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
    const items = await MenuItem.insertMany(
      MENU.map((m) => ({
        restaurantId: restaurant._id,
        branchId,
        categoryId: catMap.get(m.category),
        name: m.name,
        description: m.description,
        price: m.price,
        imageUrl: "",
        isVeg: m.isVeg,
        prepTimeMins: m.prepTimeMins,
        isAvailable: true,
        variants: m.variants ?? [],
        addons: m.addons ?? [],
      }))
    );
    return items;
  }

  const itemsB1 = await seedMenu(b1._id);
  await seedMenu(b2._id);

  const waiter = createdUsers.find((u) => u.role === "WAITER")!;
  const methods = ["CASH", "CARD", "UPI"] as const;

  // 15 historical completed orders over last 7 days on B1
  for (let i = 0; i < 15; i++) {
    const daysAgo = i % 7;
    const hour = 11 + (i % 10);
    const placedAt = new Date();
    placedAt.setDate(placedAt.getDate() - daysAgo);
    placedAt.setHours(hour, (i * 7) % 60, 0, 0);
    const readyAt = new Date(placedAt.getTime() + (12 + (i % 15)) * 60000);
    const completedAt = new Date(readyAt.getTime() + 20 * 60000);

    const pick = [
      itemsB1[i % itemsB1.length],
      itemsB1[(i * 3) % itemsB1.length],
      itemsB1[(i * 5) % itemsB1.length],
    ];
    const orderItems = pick.map((it, idx) => ({
      menuItemId: it._id,
      name: it.name,
      qty: 1 + (idx % 2),
      unitPrice: it.price,
      variant: "",
      addons: [] as string[],
      notes: idx === 0 && i % 4 === 0 ? "Less spicy" : "",
      status: "READY",
    }));
    const subtotal = orderItems.reduce((s, x) => s + x.unitPrice * x.qty, 0);
    const discountAmount = i % 5 === 0 ? paise(50) : 0;
    const taxAmount = Math.round((subtotal - discountAmount) * 0.05);
    const total = subtotal - discountAmount + taxAmount;
    const table = createdTables[i % createdTables.length];
    const type = i % 4 === 0 ? "TAKEAWAY" : "DINE_IN";

    const order = await Order.create({
      restaurantId: restaurant._id,
      branchId: b1._id,
      orderNumber: `B1-${String(i + 1).padStart(4, "0")}`,
      type,
      tableId: type === "DINE_IN" ? table._id : null,
      waiterId: waiter._id,
      status: "COMPLETED",
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

    const method = methods[i % 3];
    const tendered =
      method === "CASH" ? total + paise(100) : total;
    await Payment.create({
      restaurantId: restaurant._id,
      branchId: b1._id,
      orderId: order._id,
      method,
      amount: total,
      tenderedAmount: tendered,
      changeAmount: tendered - total,
      paidAt: completedAt,
    });
  }

  // A few completed orders on B2 so branch switch shows different numbers
  for (let i = 0; i < 4; i++) {
    const placedAt = new Date();
    placedAt.setHours(13 + i, 0, 0, 0);
    const it = itemsB1[i];
    const subtotal = it.price * 2;
    const taxAmount = Math.round(subtotal * 0.05);
    const total = subtotal + taxAmount;
    const order = await Order.create({
      restaurantId: restaurant._id,
      branchId: b2._id,
      orderNumber: `B2-${String(i + 1).padStart(4, "0")}`,
      type: "TAKEAWAY",
      tableId: null,
      waiterId: waiter._id,
      status: "COMPLETED",
      items: [
        {
          menuItemId: it._id,
          name: it.name,
          qty: 2,
          unitPrice: it.price,
          variant: "",
          addons: [],
          notes: "",
          status: "READY",
        },
      ],
      subtotal,
      discountAmount: 0,
      taxAmount,
      total,
      placedAt,
      readyAt: new Date(placedAt.getTime() + 15 * 60000),
      servedAt: new Date(placedAt.getTime() + 25 * 60000),
      completedAt: new Date(placedAt.getTime() + 30 * 60000),
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

  console.log("Seed complete.");
  console.log("Platform admin: admin@restaurantos.com / demo1234 → /admin/login");
  console.log("Restaurant:", restaurant.name, `(${restaurant.slug})`);
  console.log("Branches: Banjara Hills (B1), Gachibowli (B2)");
  console.log("Users: owner/manager/cashier/waiter/chef @demo.com / demo1234");
  console.log("Menu items on B1:", itemsB1.length);
  console.log("Historical orders on B1: 15");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
