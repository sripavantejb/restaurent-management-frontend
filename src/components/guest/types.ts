export type Phase = "loading" | "invalid" | "landing" | "menu" | "track" | "paid";

export type Diet = "all" | "veg" | "nonveg" | "egg";

export interface Variant {
  name: string;
  priceDelta: number;
}

export interface Addon {
  name: string;
  price: number;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  isVeg: boolean;
  isEgg: boolean;
  isAvailable: boolean;
  spiceLevel: number;
  variants: Variant[];
  addons: Addon[];
  bestseller?: boolean;
  repeatRate: number;
}

export interface Category {
  id: string;
  name: string;
}

export interface Bootstrap {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    menuVersion: string;
    maxOrderPaise?: number;
    qrOrderingEnabled?: boolean;
  };
  branch: { id: string; name: string; code: string };
  table: { id: string; number: number; status: string };
  openSession: {
    id: string;
    sessionNumber: string;
    status: string;
    guestCount: number;
    rounds: number;
    total: number;
    dueAmount: number;
  } | null;
  categories: Category[];
  items: MenuItem[];
}

export interface CartLine {
  menuItemId: string;
  name: string;
  qty: number;
  unitPrice: number;
  variant: string;
  addons: string[];
  notes: string;
  isVeg: boolean;
}

export interface CheckoutRound {
  id: string;
  orderNumber: string;
  roundNumber: number;
  status: string;
  approvalStatus?: string;
  items: {
    name: string;
    qty: number;
    unitPrice: number;
    notes?: string;
    variant?: string;
    addons?: string[];
    status?: "QUEUED" | "COOKING" | "READY" | string;
  }[];
  total: number;
  placedAt?: string;
  readyAt?: string | null;
  servedAt?: string | null;
  prepEtaMins?: number;
}

export interface CheckoutData {
  session: {
    id: string;
    sessionNumber: string;
    status: string;
    guestCount: number;
    rounds: number;
    subtotal: number;
    taxAmount: number;
    tipAmount: number;
    total: number;
    dueAmount: number;
  };
  rounds: CheckoutRound[];
}
