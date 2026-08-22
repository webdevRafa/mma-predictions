import type { Metadata } from "next";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/navigation/breadcrumbs";

interface PolicySection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

interface PolicyPage {
  title: string;
  description: string;
  eyebrow?: string;
  sections: PolicySection[];
}

const supportEmail =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@fightlobby.com";
const termsContactEmail = "fightlobbymma@gmail.com";

const policies: Record<string, PolicyPage> = {
  about: {
    title: "About FightLobby",
    description:
      "FightLobby is an independent UFC prediction and discussion community built around every matchup.",
    eyebrow: "Independent fight community",
    sections: [
      {
        heading: "Predictions, discussion, and live fight chat",
        paragraphs: [
          "FightLobby gives UFC fans one place to compare verified matchup information, make pre-fight predictions, see the community consensus, and discuss each bout in a focused lobby.",
          "Predictions are for entertainment and community competition. FightLobby does not accept wagers, sell guaranteed picks, or operate a sportsbook.",
        ],
      },
      {
        heading: "Independent by design",
        paragraphs: [
          "FightLobby is not affiliated with, endorsed by, or sponsored by UFC, Zuffa, or any fight promotion. Event and fighter names are used for identification and discussion.",
          "Sports data is displayed only through licensed or controlled sources. Fighter imagery is omitted unless separate display rights are confirmed.",
        ],
      },
      {
        heading: "How to reach us",
        paragraphs: [
          `Questions, accessibility feedback, and general support can be sent to ${supportEmail}.`,
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    description:
      "A simple explanation of the information FightLobby keeps and the choices you have.",
    eyebrow: "Your data and controls",
    sections: [
      {
        heading: "Information we collect",
        bullets: [
          "When you sign up with Google, we receive your email address and Google profile photo. Your email stays private and is kept only to keep your account available and secure. Your profile photo is optional and can be changed or removed at any time.",
          "When you use FightLobby, we keep the public handle you choose, your predictions, leaderboard results, follows, and chat activity so those features work.",
          "We keep limited security and moderation records when needed to protect members and FightLobby.",
          "Analytics and advertising technology are used only according to the choices you make in Privacy choices.",
        ],
      },
      {
        heading: "Why we use it",
        paragraphs: [
          "Your email connects you to your account and helps us keep it available and secure. It is never displayed publicly. Your optional avatar and public handle help identify you in community features.",
          "We use activity created on FightLobby to save and grade predictions, run leaderboards and chat, enforce community rules, investigate abuse, and maintain the service.",
          "FightLobby does not sell personal prediction history. Analytics measurements do not include email addresses, message bodies, handles, or private prediction details.",
        ],
      },
      {
        heading: "Service providers and disclosure",
        paragraphs: [
          "We use service providers, including Google and our web host, to run sign-in, data storage, hosting, analytics, and advertising features. Optional analytics and advertising are used only according to your Privacy choices. We may preserve or disclose information when reasonably necessary for security, legal compliance, or the protection of members and FightLobby.",
        ],
      },
      {
        heading: "Retention and your choices",
        paragraphs: [
          "Predictions and leaderboard history are kept to preserve community records. Chat history is removed according to FightLobby's retention schedule, while limited moderation and security records may be kept longer when needed to investigate abuse and protect the service.",
          "You can change your Privacy choices, block members, replace or remove your profile photo, or request account deletion from your account page. Removing a custom avatar deletes its stored image, and deleting your account also removes avatar files owned by the account.",
          `For privacy questions or rights requests, contact ${supportEmail}. We may need to verify the request before acting on account data.`,
        ],
      },
    ],
  },
  terms: {
    title: "Terms of Use",
    description:
      "The rules for creating an account and participating in FightLobby predictions, profiles, and chat.",
    eyebrow: "Service terms",
    sections: [
      {
        heading: "Using FightLobby",
        paragraphs: [
          "By creating an account or using interactive features, you agree to these terms and the Community Guidelines. You must provide accurate account information, keep access credentials secure, and be legally permitted to use the service where you live.",
          "FightLobby predictions are entertainment and community scoring only. They are not wagers, financial advice, or guaranteed outcomes, and no prize or thing of value is offered in the launch product.",
        ],
      },
      {
        heading: "Community content",
        paragraphs: [
          "You retain ownership of content you submit. You grant FightLobby a non-exclusive license to host, display, reproduce, and moderate that content only as needed to operate, secure, and promote the service. Do not submit content you lack the right to share.",
        ],
        bullets: [
          "Do not impersonate fighters, promotions, staff, or other members.",
          "Do not post threats, targeted harassment, unlawful material, spam, personal information, piracy links, or attempts to evade safety controls.",
          "Do not manipulate predictions, accounts, rankings, analytics, or advertising traffic.",
        ],
      },
      {
        heading: "Availability and enforcement",
        paragraphs: [
          "We may remove content, restrict features, suspend accounts, correct results, or change the service to protect users and platform integrity. Sports schedules, records, and results can change; FightLobby may show last-known data during an outage and does not promise uninterrupted availability.",
          "The service is provided without a guarantee that every data point, prediction, discussion, or third-party service will be error-free. Applicable non-waivable consumer rights remain unaffected.",
        ],
      },
      {
        heading: "Contact and changes",
        paragraphs: [
          `Material term changes will receive a new version date and may require renewed acceptance. Questions can be sent to ${termsContactEmail}.`,
        ],
      },
    ],
  },
  "cookie-policy": {
    title: "Cookie & Technology Policy",
    description:
      "FightLobby's essential storage, optional analytics, advertising controls, and consent choices.",
    eyebrow: "Consent and local storage",
    sections: [
      {
        heading: "Essential technology",
        paragraphs: [
          "FightLobby uses essential cookies or browser storage for secure sessions, abuse protection, Firebase functionality, saved drafts, and remembering privacy choices. These functions are necessary to provide requested account and security features.",
        ],
      },
      {
        heading: "Optional analytics",
        paragraphs: [
          "Google Analytics loads only after you allow analytics. FightLobby sends allowlisted product events and Core Web Vitals; it does not send emails, message bodies, public handles, or private prediction details. You can withdraw analytics consent at any time through Privacy choices in the footer.",
        ],
      },
      {
        heading: "Optional advertising",
        paragraphs: [
          "Ads are disabled by default. They can appear only after operational approval, on content-complete eligible pages, with reserved dimensions, the global ad flag enabled, and your advertising choice granted. Restricted pages such as login, signup, settings, admin, errors, and chat surfaces do not contain ad slots.",
          "Before serving ads in regions where Google requires it, FightLobby must deploy a Google-certified consent management platform integrated with the IAB Transparency and Consent Framework. The local preference panel is a privacy-preserving fallback, not a claim of CMP certification.",
        ],
      },
      {
        heading: "Change your choice",
        paragraphs: [
          "Use Privacy choices in the footer to allow or deny analytics and advertising separately. Withdrawing a choice prevents future optional loading; you may also clear browser site data to remove previously stored identifiers.",
        ],
      },
    ],
  },
  "community-guidelines": {
    title: "Community Guidelines",
    description:
      "The FightLobby standards for useful, intense, and respectful UFC discussion.",
    eyebrow: "Talk fights, respect people",
    sections: [
      {
        heading: "Keep the heat on the matchup",
        bullets: [
          "Debate picks, tactics, judging, and performance without targeting another member's identity or private life.",
          "No threats, dehumanizing attacks, hate, sexual harassment, or encouragement of harm.",
          "No posting personal information, coordinated harassment, or attempts to follow a member off-platform.",
          "No spam, scams, malware, illegal streams, piracy links, or misleading promotions.",
          "No impersonation of fighters, teams, promotions, media, moderators, or FightLobby staff.",
        ],
      },
      {
        heading: "Moderation",
        paragraphs: [
          "Members can report a message and hide another member. Moderators may remove messages and apply temporary mutes; administrators may suspend or ban accounts. Enforcement considers severity, context, repetition, and evasion. Reports should be made in good faith.",
          `For an urgent safety issue or an appeal, contact ${supportEmail} with the relevant room and approximate time. Do not email private information that is not necessary to investigate.`,
        ],
      },
      {
        heading: "Fight discussion is not betting advice",
        paragraphs: [
          "Do not present FightLobby predictions as guaranteed outcomes or solicit wagers. Sportsbook promotion, paid contests, and prize-based prediction schemes are outside the launch product and require separate legal and policy review.",
        ],
      },
    ],
  },
  "data-corrections": {
    title: "Data Corrections",
    description:
      "Report an incorrect UFC event, matchup, fighter profile, or official result shown on FightLobby.",
    sections: [
      {
        heading: "What to include",
        bullets: [
          "The FightLobby URL and the specific field you believe is incorrect.",
          "The correct value and a reliable primary or licensed source supporting it.",
          "Whether the issue affects a live prediction lock, official result, or graded leaderboard.",
        ],
        paragraphs: [
          `Send the request to ${supportEmail} with the subject “Data correction.” Do not include passwords, identity documents, or unrelated personal data.`,
        ],
      },
    ],
  },
  dmca: {
    title: "Copyright & DMCA Notices",
    description:
      "How rights holders can report material they believe infringes copyright on FightLobby.",
    eyebrow: "Rights-holder process",
    sections: [
      {
        heading: "Submit a notice",
        paragraphs: [
          `Send copyright notices to ${supportEmail} with the subject “Copyright notice.” A complete notice should identify the copyrighted work, identify the FightLobby material and exact URL, provide contact information, include a good-faith statement and an accuracy/authority statement, and include the sender's physical or electronic signature.`,
          "FightLobby may remove or restrict material while reviewing a sufficiently complete notice and may contact the submitter or affected member for clarification or a counter-notice. Misrepresentations can have legal consequences.",
        ],
      },
      {
        heading: "Counter-notices",
        paragraphs: [
          "If your content was removed by mistake or misidentification, use the same contact address and clearly request counter-notice instructions. Do not send sensitive identity material until FightLobby confirms the secure process and information legally required for the request.",
        ],
      },
    ],
  },
};

type Props = { params: Promise<{ policySlug: string }> };

export function generateStaticParams() {
  return Object.keys(policies).map((policySlug) => ({ policySlug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { policySlug } = await params;
  const page = policies[policySlug];
  if (!page) return { robots: { index: false, follow: false } };
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: `/${policySlug}` },
    openGraph: {
      title: `${page.title} | FightLobby`,
      description: page.description,
      type: "website",
    },
  };
}

export default async function PolicyPage({ params }: Props) {
  const { policySlug } = await params;
  const page = policies[policySlug];
  if (!page) notFound();
  const contactEmail =
    policySlug === "terms" ? termsContactEmail : supportEmail;
  const lastUpdated =
    policySlug === "privacy" || policySlug === "terms"
      ? "August 22"
      : "August 16";
  return (
    <main className="shell py-10 sm:py-16" id="main-content">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: page.title }]}
      />
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <article>
          {page.eyebrow ? <p className="eyebrow">{page.eyebrow}</p> : null}
          <h1
            className={`${page.eyebrow ? "mt-3" : ""} font-display text-5xl font-extrabold sm:text-7xl`}
          >
            {page.title}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-fl-text-muted">
            {page.description}
          </p>
          <p className="mt-4 font-mono text-[10px] tracking-[.08em] text-fl-text-dim uppercase">
            Last updated {lastUpdated}, 2026
          </p>
          <div className="mt-10 space-y-8">
            {page.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="font-display text-3xl font-bold">
                  {section.heading}
                </h2>
                {section.paragraphs?.map((paragraph) => (
                  <p
                    className="mt-3 max-w-3xl text-sm leading-7 text-fl-text-muted"
                    key={paragraph}
                  >
                    {paragraph}
                  </p>
                ))}
                {section.bullets ? (
                  <ul className="mt-4 grid max-w-3xl gap-3 text-sm leading-6 text-fl-text-muted">
                    {section.bullets.map((bullet) => (
                      <li className="flex gap-3" key={bullet}>
                        <ShieldCheck
                          aria-hidden="true"
                          className="mt-1 shrink-0 text-fl-accent"
                          size={15}
                        />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        </article>
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <a
            className="focus-ring flex items-center justify-between rounded-xl border border-fl-border bg-fl-surface-1 p-4 text-sm font-bold hover:border-fl-accent"
            href={`mailto:${contactEmail}`}
          >
            Contact FightLobby <ArrowUpRight aria-hidden="true" size={16} />
          </a>
          <Link
            className="focus-ring block rounded-xl border border-fl-border p-4 text-sm font-bold text-fl-text-muted hover:text-fl-text"
            href="/privacy"
          >
            Privacy Policy
          </Link>
          <Link
            className="focus-ring block rounded-xl border border-fl-border p-4 text-sm font-bold text-fl-text-muted hover:text-fl-text"
            href="/community-guidelines"
          >
            Community Guidelines
          </Link>
        </aside>
      </div>
    </main>
  );
}
