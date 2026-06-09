import { useState, useEffect } from 'react';
import type { Product } from '@/types';
import { subscribeToProducts } from '@/services/inventory.service';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return subscribeToProducts((prods) => {
      setProducts(prods);
      setLoading(false);
    });
  }, []);

  return { products, loading };
}
