# Security Specification for Granitec ERP

## Data Invariants
1. A Production Order cannot be marked as COMPLETED unless the stock for its components is actually deducted (verified via existsAfter or batch logic).
2. Stock levels cannot be negative (handled via validation helpers).
3. Every Movement must have a valid `itemId` and `type`.
4. Variants must belong to an existing Product.
5. Recipes must reference existing Products for their components.

## The "Dirty Dozen" Payloads
1. **Unauthorized Product Edit**: Moving price from $10 to $0.01 as a non-admin.
2. **Infinite Stock Injection**: Setting `stock_level` to 9999999.
3. **Ghost Movement**: Creating a movement without a corresponding ProductionOrder or Purchase.
4. **Invalid SKU**: SKU with malicious characters or excessive length (1MB).
5. **Variant Hijack**: Creating a variant for a product that doesn't exist.
6. **BOM Loop**: A recipe that includes itself (cycle detection).
7. **Bypass Reservation**: Marking an order as RESERVED without checking actual stock.
8. **Owner Spoofing**: Setting `lastUpdatedBy` to another user's UID.
9. **Price Manipulation**: Injecting negative costs into raw materials.
10. **Terminal State Break**: Editing a COMPLETED production order.
11. **Packaging Fraud**: Setting conversion factor to 0 or negative.
12. **PII Leak**: Accessing other users' profiles (if any stored).

## Test Runner Plan
I will use `firestore.rules.test.ts` to verify these.
