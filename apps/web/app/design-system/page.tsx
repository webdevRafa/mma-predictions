import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DialogPreview } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { Tabs } from "@/components/ui/tabs";
import { ToastPreview } from "@/components/ui/toast-preview";

export const metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

export default function DesignSystemPage() {
  return (
    <main className="shell py-12 sm:py-16" id="main-content">
      <p className="eyebrow">Internal reference</p>
      <h1 className="mt-2 font-display text-5xl font-extrabold sm:text-7xl">
        FightLobby design system
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-fl-text-muted">
        A restrained live-sports system built for clear states, dense matchup
        data, keyboard access, and small screens.
      </p>
      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            eyebrow="Actions"
            title="Buttons"
            description="Primary actions are reserved for picks and lobby entry."
          />
          <div className="flex flex-wrap gap-3 p-5">
            <Button>Lock in my pick</Button>
            <Button variant="secondary">Compare stats</Button>
            <Button variant="ghost">Not now</Button>
            <Button disabled>Locked</Button>
          </div>
        </Card>
        <Card>
          <CardHeader eyebrow="System state" title="Status and badges" />
          <div className="flex flex-wrap gap-3 p-5">
            <StatusPill status="live" />
            <StatusPill status="up_next" />
            <StatusPill status="scheduled" />
            <StatusPill status="final" />
            <Badge tone="accent">Title fight</Badge>
            <Badge tone="success">Pick saved</Badge>
            <Badge tone="warning">Locks soon</Badge>
          </div>
        </Card>
        <Card>
          <CardHeader eyebrow="Navigation" title="Segmented tabs" />
          <div className="p-5">
            <Tabs
              label="Matchup sections"
              items={[
                {
                  id: "matchup",
                  label: "Matchup",
                  content: (
                    <p className="text-sm text-fl-text-muted">
                      Server-rendered matchup context stays first.
                    </p>
                  ),
                },
                {
                  id: "predict",
                  label: "Predict",
                  content: (
                    <p className="text-sm text-fl-text-muted">
                      Interactive prediction controls load only where needed.
                    </p>
                  ),
                },
                {
                  id: "lobby",
                  label: "Lobby",
                  content: (
                    <p className="text-sm text-fl-text-muted">
                      Realtime chat is lazy-loaded after primary content.
                    </p>
                  ),
                },
              ]}
            />
          </div>
        </Card>
        <Card>
          <CardHeader eyebrow="Feedback" title="Dialogs and toasts" />
          <div className="flex flex-wrap items-center gap-3 p-5">
            <DialogPreview />
            <ToastPreview />
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader
            eyebrow="Loading"
            title="Skeleton states"
            description="Geometry mirrors the final layout to minimize layout shift."
          />
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <div>
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-3 h-10" />
            </div>
            <div>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-10" />
            </div>
            <div>
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-3 h-10" />
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
