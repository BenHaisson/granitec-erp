import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import InventoryPage from '@/pages/inventory/InventoryPage';
import WarehousePage from '@/pages/warehouse/WarehousePage';
import SalesPage from '@/pages/sales/SalesPage';
import ProductionPage from '@/pages/production/ProductionPage';
import BOMPage from '@/pages/bom/BOMPage';
import MovementsPage from '@/pages/movements/MovementsPage';
import ReportsPage from '@/pages/reports/ReportsPage';
import SettingsPage from '@/pages/settings/SettingsPage';
import AnalyticsPage from '@/pages/analytics/AnalyticsPage';
import LibraryPage from '@/pages/library/LibraryPage';
import ShippingPage from '@/pages/shipping/ShippingPage';
import UnverifiedStockPage from '@/pages/inventory/UnverifiedStockPage';
import SuppliersPage from '@/pages/suppliers/SuppliersPage';
import ClientsPage from '@/pages/clients/ClientsPage';

export default function AppRouter() {
  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/shipping" element={<ShippingPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/unverified-stock" element={<UnverifiedStockPage />} />
        <Route path="/warehouse" element={<WarehousePage />} />
        <Route path="/sales" element={<SalesPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/production" element={<ProductionPage />} />
        <Route path="/bom" element={<BOMPage />} />
        <Route path="/movements" element={<MovementsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </MainLayout>
  );
}
