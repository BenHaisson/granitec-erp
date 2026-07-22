export type ProductType = 'RAW' | 'SUB_ASSEMBLY' | 'FINISHED';
export type OrderStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type MovementReason = 'PRODUCTION' | 'PURCHASE' | 'SHIPMENT' | 'ADJUSTMENT' | 'WASTE' | 'SALE';

export interface Product {
  id: string;
  name: string;
  sku: string;
  type: ProductType;
  category?: string;
  sort_order?: number;
  unit: string;
  stock_level: number;
  min_stock: number;
  cost: number;
  imageUrl?: string;
  unverified_stock?: number; // stock used in production without a backing shipment receipt
  source?: 'catalog' | 'user';
  createdBy?: string;
  createdAt?: string;
}

export interface RecipeItem {
  productId: string;
  quantity: number;
}

export interface Recipe {
  id: string;
  finishedProductId: string;
  components: RecipeItem[];
}

export interface ProductionOrder {
  id: string;
  recipeId: string;
  quantity: number;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  quantity: number;
  reason: MovementReason;
  note?: string;
  createdAt: Date;
}

export interface Sale {
  id: string;
  productId: string;
  quantity: number;
  client: string;
  date: Date;
  totalAmount: number;
}

export interface SalesOrderLine {
  productId: string;
  productName: string;
  sku: string;
  boxes: number;
  qtyPerBox: number;
  totalQty: number;
}

export type PaymentStatus = 'unpaid' | 'partial' | 'paid';
export type DeliveryStatus = 'pending' | 'shipped' | 'delivered';

export interface SalesOrder {
  id: string;
  ref: string;
  client: string;
  date: Date;
  lines: SalesOrderLine[];
  paymentStatus?: PaymentStatus;
  deliveryStatus?: DeliveryStatus;
  reduceStock?: boolean; // whether this order deducts from live inventory (default true)
}

export type MachineType = 'machine' | 'tool';

export interface Machine {
  id: string;
  name: string;
  type: MachineType;
  category?: string;
  capacity?: string;
  settings?: string;
  notes?: string;
  sort_order?: number;
}

export type ProductionStage = 'Press' | 'Tourna' | 'Laser' | 'Pounta' | 'Screw' | 'Gather' | 'Box';

export interface ProductionTarget {
  id: string;
  date: string; // YYYY-MM-DD
  type: 'stage' | 'recipe';
  stage?: ProductionStage;
  discType?: string;
  recipeId?: string;
  recipeName?: string;
  targetQty: number;
  completedQty: number;
  defects?: number;
  startDate?: string; // YYYY-MM-DD
  deadline: string; // YYYY-MM-DD
  materialsDeducted?: boolean;
  finishedGoodsAdded?: boolean;
  autoAddedUnverified?: Record<string, number>; // maps productId → auto-added qty for cancellation
  deadlineTime?: string; // HH:MM
  line?: string;
  status: 'not_started' | 'in_progress' | 'at_risk' | 'complete' | 'cancelled';
  notes?: string;
  createdAt: { toDate: () => Date } | Date;
}

export interface ProductionEntry {
  id: string;
  date: string; // YYYY-MM-DD
  targetId: string;
  stage: ProductionStage;
  discType: string;
  qty: number;
  goodQty?: number;
  defects?: number;
  qualityCheck?: 'passed' | 'review' | 'hold';
  loggedAt: string; // HH:MM
  notes?: string;
  createdAt: { toDate: () => Date } | Date;
}

export type LibraryCategory = 'guide' | 'sop' | 'standard' | 'spec';

export interface LibraryItem {
  id: string;
  title: string;
  category: LibraryCategory;
  subcategory?: string;
  content: string;
  tags?: string[];
  sort_order?: number;
}

export type ShippingOrderStatus = 'PLANNED' | 'PARTIAL' | 'RECEIVED';

export interface ShippingOrderLine {
  productId: string;
  productName: string;
  sku: string;
  qty: number;
  reconcile?: boolean; // if true, receiving backs unverified_stock instead of adding to live stock
}

export interface ShipmentReceiptLine {
  productId: string;
  productName: string;
  sku: string;
  receivedQty: number;
}

export interface ShipmentReceipt {
  id: string;
  date: string; // YYYY-MM-DD
  blNumber?: string;
  remarks?: string;
  documentUrl?: string;          // legacy Firebase Storage download URL
  documentName?: string;
  documentKey?: string;          // Cloudflare R2 object key (new attachments)
  storageProvider?: 'r2';
  lines: ShipmentReceiptLine[];
  addedToInventory: boolean;
  createdAt: Date | { toDate: () => Date };
}

export interface ShippingOrder {
  id: string;
  ref: string;
  supplier?: string;
  date: string;
  status: ShippingOrderStatus;
  lines: ShippingOrderLine[];
  receipts?: ShipmentReceipt[];
  cancelledRemaining?: boolean;
  receivedAt?: Date;
  createdAt: Date;
  blNumber?: string;
  remarks?: string;
  documentUrl?: string;          // legacy Firebase Storage download URL
  documentName?: string;
  documentKey?: string;          // Cloudflare R2 object key (new attachments)
  storageProvider?: 'r2';
  verification?: boolean;
  addedToInventory?: boolean; // whether receipt was added to live inventory stock
}

export interface ShippedSupplyLine {
  productId: string;
  productName: string;
  sku: string;
  qty: number;
}

// Supply that has already physically arrived — logged in one step (no PLANNED/receive workflow).
export interface ShippedSupply {
  id: string;
  ref: string;
  supplier?: string;
  date: string; // YYYY-MM-DD
  description?: string;
  lines: ShippedSupplyLine[];
  documentUrl?: string;          // legacy Firebase Storage download URL
  documentName?: string;
  documentKey?: string;          // Cloudflare R2 object key (new attachments)
  storageProvider?: 'r2';
  addedToInventory: boolean;
  createdAt: Date | { toDate: () => Date };
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  shippingOrderId?: string;   // absent when the invoice is linked directly via a BL/reference (e.g. a shipped supply)
  shippingOrderRef?: string;
  supplier?: string;
  blNumbers: string[];
  amount?: number;
  currency: string;
  date: string;
  remarks?: string;
  documentUrl?: string;          // legacy Firebase Storage download URL
  documentName?: string;
  documentKey?: string;          // Cloudflare R2 object key (new attachments)
  storageProvider?: 'r2';        // set when the attachment lives in R2
  createdAt: Date | { toDate: () => Date };
}

export interface MachineDoc {
  id: string;
  machineName: string;
  title: string;
  body: string;
  remarks?: string;
  category?: string;
  createdAt: Date | { toDate: () => Date };
  updatedAt: Date | { toDate: () => Date };
}

export type SupplyType = 'raw_material' | 'accessory' | 'packaging';

export interface PhoneContact {
  name: string;
  phone: string;
}

export interface Supplier {
  id: string;
  name: string;
  email?: string;
  mainPhone?: string;
  phones?: PhoneContact[];
  address?: string;
  supplyType: SupplyType;
  description?: string;
  ice?: string;
  rc?: string;
  createdAt?: string;
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  mainPhone?: string;
  phones?: PhoneContact[];
  address?: string;
  description?: string;
  createdAt?: string;
}
