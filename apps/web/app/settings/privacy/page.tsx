import { Card, CardHeader } from "@/components/ui/card";
import { PreferenceForm } from "@/features/settings/preference-form";
import { requireOnboardedSession } from "@/lib/auth/session";
import { getPrivateAccountView } from "@/lib/auth/user-records";

export default async function PrivacySettingsPage() {
  const session = await requireOnboardedSession("/settings/privacy");
  const { preferences } = await getPrivateAccountView(session.uid);
  return (
    <Card>
      <CardHeader
        eyebrow="Pick privacy"
        title="Upcoming predictions"
        description="Locked picks can be public for transparency. Open picks stay private by default."
      />
      <div className="p-5 sm:p-6">
        <PreferenceForm
          values={{
            hideUpcomingPicks: preferences.hideUpcomingPicks,
            timezone: preferences.timezone,
          }}
        >
          <label className="flex items-start justify-between gap-5 rounded-xl border border-fl-border bg-fl-surface-2 p-4">
            <span>
              <span className="block text-sm font-semibold">
                Hide upcoming picks
              </span>
              <span className="mt-1 block text-xs leading-5 text-fl-text-muted">
                Do not publish future picks unless you explicitly share one.
              </span>
            </span>
            <input
              className="mt-1 accent-fl-accent"
              defaultChecked={preferences.hideUpcomingPicks}
              name="hideUpcomingPicks"
              type="checkbox"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-fl-text-muted">
              Time zone
            </span>
            <input
              className="focus-ring min-h-12 w-full rounded-lg border border-fl-border bg-fl-surface-2 px-4 text-sm"
              defaultValue={preferences.timezone}
              name="timezone"
            />
          </label>
        </PreferenceForm>
      </div>
    </Card>
  );
}
