# Privacy, analytics, SEO, and advertising

FightLobby uses a basic consent implementation: optional tags do not load at all
until a visitor grants the corresponding choice. Essential authentication,
security, draft, and consent storage remain available. Choices are versioned in
first-party local storage and can be changed through **Privacy choices** in the
footer.

## Analytics boundary

`AnalyticsRuntime` loads GA4 only when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set and
analytics consent is granted. It sends route page views, allowlisted product
events, and Core Web Vitals. The event helper rejects parameter names shaped like
emails, message or content bodies, handles, names, passwords, and tokens; string
values are bounded. Do not bypass this helper.

Implemented product events include event/fight views, prediction start and save
states, signup prompts and completion, handle completion, grade/consensus reveal,
chat open/send/report, leaderboard views, profile shares, follows, ad-slot
visibility, and Web Vitals. Event/fight IDs are canonical internal identifiers;
message content, email addresses, public handles, and detailed private picks are
never analytics parameters.

## Consent and certified CMP handoff

The local panel establishes safe defaults and supports Google consent mode v2's
analytics, ad storage, ad user data, and ad-personalization states. It is not
represented as a certified CMP.

Before enabling production ads in the EEA, UK, or Switzerland, select and
configure a Google-certified, TCF-integrated CMP. Its adapter must publish the
normalized choice after the CMP has produced its consent signal:

```js
window.dispatchEvent(
  new CustomEvent("fightlobby:cmp-consent", {
    detail: { analytics: true, advertising: false },
  }),
);
```

Set `NEXT_PUBLIC_GOOGLE_CERTIFIED_CMP_ID` only after that integration has been
validated. The value is an operational interlock: without it, no `AdSlot` renders
even if every other switch is on. Google requires a certified CMP integrated with
the IAB TCF for affected AdSense traffic; the requirement and current certified
providers should be rechecked before launch:

- [Google CMP requirements](https://support.google.com/adsense/answer/13554020)
- [Google consent mode implementation](https://developers.google.com/tag-platform/security/guides/consent)

## Advertising gates

Ads are off by default. An ad request requires all of the following:

1. the private Firestore `adsEnabled` flag is true;
2. the page's canonical event or fight is `monetizationEligible`;
3. a valid AdSense client and slot ID are configured;
4. a certified CMP identifier is configured; and
5. the visitor granted advertising consent.

Only the approved homepage, event, and fight content positions contain slots.
Slots never occur in chat, prediction controls, authentication, settings, admin,
or error routes. Enabled slots reserve vertical space before the network script
loads to protect CLS. Intersection measurement records visibility only; the app
does not observe or encourage ad clicks.

`/ads.txt` returns a non-selling comment until `ADSENSE_PUBLISHER_ID` matches a
`pub-` identifier with 16 digits. Once configured, the route emits Google's direct
seller record. Copy the exact publisher ID from the approved AdSense account; do
not use the placeholder as a seller declaration. See [Google's ads.txt guidance](https://support.google.com/adsense/answer/9785052).

## Search and content eligibility

Search Console verification is emitted through `GOOGLE_SITE_VERIFICATION`.
`robots.txt` advertises the segmented sitemap index and excludes private/internal
routes. Sitemap functions derive URLs only from canonical records and apply the
same indexability functions as page metadata:

- an event requires a reviewed original summary and a complete non-empty card;
- a fight requires reviewed editorial, both fighter stat profiles, no critical
  data block, and explicit monetization eligibility;
- a fighter requires a meaningful record and division; and
- a profile requires public visibility and at least five graded picks.

Canonical metadata, Open Graph/Twitter cards, breadcrumbs, and accurate JSON-LD
remain part of the public page layer. Old slugs redirect permanently and do not
enter sitemaps.

## Performance and legal readiness

Web Vitals use Next.js's isolated client reporter and only flow to GA4 after
analytics consent. Target the 75th-percentile thresholds in the build spec: LCP
under 2.5 seconds, INP under 200 milliseconds, and CLS under 0.1. The primary
fight content remains server-rendered, while chat and advertising scripts load on
demand.

The public About, Privacy, Terms, Cookie, Community Guidelines, Data Corrections,
and Copyright/DMCA routes describe the implemented product behavior. Their final
business identity, jurisdictional wording, contact channels, retention periods,
and consent implementation require qualified legal review before production.
