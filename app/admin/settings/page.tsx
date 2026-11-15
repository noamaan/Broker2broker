import { AdminPaymentSettings } from "@/components/admin-payment-settings";
import { TaxonomyManager } from "@/components/developer-settings";

export const metadata = { title: "Admin settings" };

export default function AdminSettingsPage() {
  return (
    <div className="space-y-8">
      <AdminPaymentSettings />
      <TaxonomyManager apiBase="/api/admin" />
    </div>
  );
}
