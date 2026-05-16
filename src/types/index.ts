export type ProductType = 'RAW' | 'SUB_ASSEMBLY' | 'FINISHED';
export type OrderStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type MovementReason = 'PRODUCTION' | 'PURCHASE' | 'SHIPMENT' | 'ADJUSTMENT' | 'WASTE' | 'SALE';

export interface Product {
  id: string;
  name: string;
  sku: string;
  type: ProductType;
  unit: string;
  stock_level: number;
  min_stock: number;
  cost: number;
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
