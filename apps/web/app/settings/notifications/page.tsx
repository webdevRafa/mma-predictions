import { Card, CardHeader } from "@/components/ui/card";
import { PreferenceForm } from "@/features/settings/preference-form";
import { requireOnboardedSession } from "@/lib/auth/session";
import { getPrivateAccountView } from "@/lib/auth/user-records";

export default async function NotificationSettingsPage() {
  const session = await requireOnboardedSession("/settings/notifications");
  const { preferences } = await getPrivateAccountView(session.uid);
  return (
    <Card>
      <CardHeader
        eyebrow="Private preferences"
        title="Notifications"
        description="Delivery arrives in a later engagement pass; these choices establish your consent now."
      />
      <div className="p-5 sm:p-6">
        <PreferenceForm
          values={{
            emailEventReminders: preferences.emailEventReminders,
            emailResults: preferences.emailResults,
          }}
        >
          {[
            [
              "emailEventReminders",
              "Event reminders",
              "A reminder before followed UFC cards begin.",
              preferences.emailEventReminders,
            ],
            [
              "emailResults",
              "Prediction results",
              "A summary after your picks are officially graded.",
              preferences.emailResults,
            ],
          ].map(([name, title, copy, checked]) => (
            <label
              className="flex items-start justify-between gap-5 rounded-xl border border-fl-border bg-fl-surface-2 p-4"
              key={String(name)}
            >
              <span>
                <span className="block text-sm font-semibold">
                  {String(title)}
                </span>
                <span className="mt-1 block text-xs leading-5 text-fl-text-muted">
                  {String(copy)}
                </span>
              </span>
              <input
                className="mt-1 accent-fl-accent"
                defaultChecked={Boolean(checked)}
                name={String(name)}
                type="checkbox"
              />
            </label>
          ))}
        </PreferenceForm>
      </div>
    </Card>
  );
}
