import { useEffect, useState } from 'react';
import { getRecipes } from '@/services/production.service';
import { getProducts } from '@/services/inventory.service';
import type { Recipe, Product } from '@/types';

export default function BOMPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [products, setProducts] = useState<Map<string, Product>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getRecipes(), getProducts()])
      .then(([r, p]) => {
        setRecipes(r);
        setProducts(new Map(p.map(prod => [prod.id, prod])));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">BOM Recipes</h1>
        <p className="text-slate-500 text-sm mt-1">{recipes.length} recipes defined</p>
      </div>

      <div className="space-y-4">
        {recipes.length === 0 && (
          <div className="bg-white rounded-xl p-8 text-center text-slate-400 text-sm shadow-sm border border-slate-100">
            No BOM recipes yet. Add recipes in Firestore to see them here.
          </div>
        )}
        {recipes.map(recipe => {
          const finished = products.get(recipe.finishedProductId);
          return (
            <div key={recipe.id} className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
              <h2 className="text-base font-semibold text-slate-800 mb-1">
                {finished?.name ?? recipe.finishedProductId}
              </h2>
              <p className="text-xs text-slate-400 mb-4">SKU: {finished?.sku ?? '—'}</p>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase pb-2">Component</th>
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase pb-2">Quantity per unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recipe.components.map(c => {
                    const prod = products.get(c.productId);
                    return (
                      <tr key={c.productId}>
                        <td className="py-2 text-sm text-slate-700">{prod?.name ?? c.productId}</td>
                        <td className="py-2 text-sm text-slate-700 text-right">
                          {c.quantity} {prod?.unit ?? ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
