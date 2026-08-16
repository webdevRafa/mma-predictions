import { Card, CardHeader } from "@/components/ui/card";
import { ProfileSettingsForm } from "@/features/settings/profile-settings-form";
import { requireOnboardedSession } from "@/lib/auth/session";
import { getPrivateAccountView } from "@/lib/auth/user-records";

export default async function ProfileSettingsPage() {
  const session = await requireOnboardedSession("/settings/profile");
  const account = await getPrivateAccountView(session.uid);
  return (
    <Card>
      <CardHeader
        eyebrow="Public identity"
        title="Profile settings"
        description="Only the fields below can appear publicly. Email and provider IDs are never included."
      />
      <div className="p-5 sm:p-6">
        <ProfileSettingsForm
          displayName={account.displayName}
          handle={account.handle}
          profileVisibility={account.profileVisibility}
        />
      </div>
    </Card>
  );
}
