import { redirect } from "next/navigation";

import { requireAdminPage } from "@/lib/admin/auth";

export default async function AdminDataSyncPage() {
  await requireAdminPage("/admin/data-sync");
  redirect("/admin/sync");
}
