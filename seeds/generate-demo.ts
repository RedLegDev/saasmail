/**
 * Generate seeds/demo.sql with realistic demo data:
 *   - 6 inboxes (kept stable so admin display-name UI works)
 *   - 100 people
 *   - 600-900 inbound emails (varied length, varied subject, ~25% unread)
 *   - 80-150 sent replies
 *   - CC roster (~20% of emails) + 5 roster-change demo threads
 *   - Attachments on ~15% of inbound emails (real fake fixtures)
 *
 * Run:  npx tsx seeds/generate-demo.ts
 * Then: yarn db:seed:dev
 */
import { statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Reproducible RNG so re-runs give the same dataset.
// ---------------------------------------------------------------------------
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
const rand = makeRng(1759);
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const result: T[] = [];
  while (n > 0 && copy.length) {
    result.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
    n--;
  }
  return result;
}
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function chance(p: number): boolean {
  return rand() < p;
}
function sqlEscape(s: string): string {
  return s.replace(/'/g, "''");
}

// ---------------------------------------------------------------------------
// Inboxes
// ---------------------------------------------------------------------------
const INBOXES = [
  { email: "support@example.com", display: "Support" },
  { email: "sales@example.com", display: "Sales" },
  { email: "hello@example.com", display: "General" },
  { email: "billing@example.com", display: "Billing" },
  { email: "newsletter@example.com", display: "Newsletter" },
  { email: "notifications@example.com", display: "Notifications" },
];

// ---------------------------------------------------------------------------
// Name + domain pools (stay short — total combos are still huge)
// ---------------------------------------------------------------------------
const FIRST_NAMES = [
  "Alice",
  "Bob",
  "Carla",
  "Dan",
  "Eve",
  "Frank",
  "Grace",
  "Henry",
  "Iris",
  "Jack",
  "Kim",
  "Leo",
  "Maya",
  "Noah",
  "Olivia",
  "Pavel",
  "Quinn",
  "Rosa",
  "Sam",
  "Tara",
  "Uma",
  "Victor",
  "Wendy",
  "Xavier",
  "Yuki",
  "Zane",
  "Amir",
  "Bella",
  "Caleb",
  "Diana",
  "Emil",
  "Faye",
  "Gabriel",
  "Hana",
  "Idris",
  "Jana",
  "Karim",
  "Lena",
  "Marcus",
  "Nadia",
  "Owen",
  "Priya",
  "Rafael",
  "Sofia",
  "Tariq",
  "Vera",
  "Will",
  "Yara",
  "Zaid",
  "Anya",
  "Bruno",
  "Chloe",
  "Diego",
  "Elsa",
  "Felix",
  "Gemma",
  "Hugo",
  "Indra",
  "Julian",
  "Kira",
  "Lucas",
  "Mira",
  "Nico",
  "Omar",
  "Petra",
  "Reina",
  "Said",
  "Tina",
  "Ulrich",
  "Vivi",
  "Wei",
  "Xiu",
  "Yannis",
  "Zara",
];
const LAST_NAMES = [
  "Nguyen",
  "Martinez",
  "Schmidt",
  "Park",
  "Johansson",
  "Liu",
  "Okafor",
  "Wayne",
  "Chen",
  "Prince",
  "Novak",
  "Halat",
  "Patel",
  "Tanaka",
  "Kowalski",
  "Singh",
  "Rossi",
  "Garcia",
  "Khan",
  "Müller",
  "Andersson",
  "Iyer",
  "Reyes",
  "Diaz",
  "Cohen",
  "Abadi",
  "Fischer",
  "Yamamoto",
  "O'Brien",
  "Walsh",
  "Cruz",
  "Brennan",
  "Yusupov",
  "Santos",
  "Petrov",
  "Nakamura",
  "Kim",
  "Bauer",
  "Volkov",
  "Hassan",
  "Ferreira",
  "Lindgren",
  "Mendez",
  "Sato",
];
const DOMAINS = [
  "acme.co",
  "globex.io",
  "initech.dev",
  "hooli.com",
  "piedpiper.ai",
  "soylent.corp",
  "dundermifflin.com",
  "wayne.enterprises",
  "northwind.co",
  "stark.industries",
  "umbrella.med",
  "tyrell.tech",
  "weyland.space",
  "aperture.science",
  "vandelay.imp",
  "orbis.health",
];

// ---------------------------------------------------------------------------
// CC pools — internal team uses our own domain, external collaborators
// pull from existing DOMAINS plus a couple of new business domains.
// ---------------------------------------------------------------------------
type CcEntry = { email: string; name?: string | null };

const INTERNAL_TEAM: CcEntry[] = [
  { email: "lin@example.com", name: "Lin Park" },
  { email: "pavel@example.com", name: "Pavel Novak" },
  { email: "maya@example.com", name: "Maya Iyer" },
  { email: "diego@example.com", name: "Diego Cruz" },
  { email: "ren@example.com", name: "Ren O'Brien" },
  { email: "sam@example.com", name: "Sam Liu" },
];

const EXTERNAL_COLLABORATORS: CcEntry[] = [
  { email: "carla.martinez@acme.co", name: "Carla Martinez" },
  { email: "bob.schmidt@globex.io", name: "Bob Schmidt" },
  { email: "rosa.garcia@initech.dev", name: "Rosa Garcia" },
  { email: "henry.wayne@hooli.com", name: "Henry Wayne" },
  { email: "kim.chen@piedpiper.ai", name: "Kim Chen" },
  { email: "olivia.prince@stark.industries", name: "Olivia Prince" },
  { email: "tariq.khan@legal.acme.co", name: "Tariq Khan" },
  { email: "priya.singh@procurement.globex.io", name: "Priya Singh" },
  { email: "marcus.cohen@northwind.co", name: "Marcus Cohen" },
  { email: "yuki.sato@orbis.health", name: "Yuki Sato" },
];

// ---------------------------------------------------------------------------
// Email content libraries — keyed by inbox so subjects/bodies match the
// channel's character.
// ---------------------------------------------------------------------------
type Snippet = { subject: string; body: string };

const SUPPORT_SNIPPETS: Snippet[] = [
  {
    subject: "Trouble logging in on mobile",
    body: "I can't log into the iOS app after the latest update — it just hangs on the spinner. Desktop works fine. Tried reinstalling, no change.",
  },
  {
    subject: "Webhook deliveries failing intermittently",
    body: "We're seeing 504s on about 3% of webhook deliveries to our /events endpoint. It's been happening for the past 48 hours. Sample request IDs attached.",
  },
  {
    subject: "API rate limits unclear",
    body: "What's the per-minute rate limit for the /messages endpoint on the Pro plan? The docs mention 60/s but our 429s suggest something lower.",
  },
  {
    subject: "How do I rotate an API key without downtime?",
    body: "Looking for the recommended way to rotate keys in production. Is there a grace-period overlap, or do I need to coordinate the swap myself?",
  },
  {
    subject: "Re: Trouble logging in on mobile",
    body: "That worked — thank you! Force-quitting and reinstalling fixed it.",
  },
  {
    subject: "Re: Webhook deliveries failing intermittently",
    body: "Tried the retry flag — still seeing failures on the same three endpoints. Latest IDs in the next message.",
  },
  {
    subject: "Bug: timestamps off by one hour after DST",
    body: "Since Sunday all our scheduled sends are firing an hour late. Looks like a TZ issue on your side. Account ID acme-7821.",
  },
  {
    subject: "Export taking 30+ minutes",
    body: "The CSV export for our last 90 days is timing out. Anything we can do about this? It used to take ~3 minutes.",
  },
  {
    subject: "Two-factor backup codes not working",
    body: "I lost my phone and the backup codes I saved aren't being accepted. What's the recovery path?",
  },
  {
    subject: "Outbound mail going to spam in Gmail",
    body: "We set up DKIM and SPF as the docs suggested but our sends still land in spam at most Gmail addresses. DMARC is also passing.",
  },
  {
    subject: "Edge case in the threading logic",
    body: "Replies from the same person to different inboxes are getting threaded together. Our customers think we're cross-routing emails internally.",
  },
  {
    subject: "Quick question on retention",
    body: "How long are messages retained on the Free plan? Want to make sure we don't lose anything before upgrading.",
  },
];

const SALES_SNIPPETS: Snippet[] = [
  {
    subject: "Enterprise pricing question",
    body: "We're evaluating a few tools for our team of 50. Could you share enterprise pricing and whether SSO + audit logs are included?",
  },
  {
    subject: "Demo request — multi-region rollout",
    body: "Could we get a 30-min walkthrough? We're rolling out to teams in the EU and US and need to understand data residency options.",
  },
  {
    subject: "RFP for procurement",
    body: "Attached is our RFP. Looking for responses by end of month. Happy to clarify any sections — let me know.",
  },
  {
    subject: "Quote follow-up",
    body: "Thanks for the quote last week. I shared it internally; we have a few clarifying questions on the implementation timeline.",
  },
  {
    subject: "Annual contract — need invoice in EUR",
    body: "We're ready to sign on an annual plan but our finance team needs the invoice in EUR rather than USD. Is that supported?",
  },
  {
    subject: "Considering a switch from Front",
    body: "Hey — we're looking at moving off Front for our support team. Curious how migration goes; we have ~18 months of history.",
  },
  {
    subject: "Discount for nonprofits?",
    body: "We're a registered 501(c)(3). Is there any nonprofit discount available?",
  },
  {
    subject: "How does seat counting work for shared inboxes?",
    body: "If five reps share a support@ inbox, do we pay for one seat or five? The pricing page wasn't clear.",
  },
  {
    subject: "Need a longer trial",
    body: "The default 14-day trial is too short for our procurement cycle. Could we get an extension to 45 days?",
  },
];

const BILLING_SNIPPETS: Snippet[] = [
  {
    subject: "Invoice for September seems wrong",
    body: "Our September invoice is $200 over the usual amount. Can you look into the line items?",
  },
  {
    subject: "Switching from monthly to annual",
    body: "Want to move our subscription to annual billing. Will the prorated credit just roll forward?",
  },
  {
    subject: "Update payment method",
    body: "Old card expired and the auto-update didn't kick in. New card is in the portal — please re-run the failed charge when convenient.",
  },
  {
    subject: "VAT number for invoice",
    body: "Could you add our VAT number (DE123456789) to upcoming invoices? Our finance team can't process them without it.",
  },
  {
    subject: "Refund request",
    body: "We accidentally subscribed twice last month. Could one of the charges be refunded?",
  },
  {
    subject: "Receipts for 2025 tax filing",
    body: "Need bulk-download of all our receipts from 2025 for tax filing. Is that exposed in the dashboard or do I have to email each time?",
  },
];

const HELLO_SNIPPETS: Snippet[] = [
  {
    subject: "Quick intro",
    body: "Hi! Just signed up — wanted to introduce ourselves. We're building a tools-for-creators app and are exploring email infrastructure.",
  },
  {
    subject: "Partnership idea",
    body: "We run a developer newsletter (~12k subs) and think there's a partnership opportunity. Open to chatting?",
  },
  {
    subject: "Loving the product so far",
    body: "Just wanted to say — the new threading view is a huge improvement. Saved us probably 40 minutes a day already.",
  },
  {
    subject: "Feature request: keyboard shortcut for archive",
    body: "Would love a keyboard shortcut to archive a thread. Right now I have to click the menu every time.",
  },
  {
    subject: "Feedback after first week",
    body: "We've been using it for a week. Two things slowing us down: the search is fuzzy in unhelpful ways, and there's no way to bulk-mark as read.",
  },
];

const NEWSLETTER_SNIPPETS: Snippet[] = [
  {
    subject: "Weekly digest",
    body: "Top three threads this week: Carla's webhook saga (resolved), Bob's enterprise quote (in progress), Alice's mobile bug (closed).",
  },
  {
    subject: "Product update — chat mode",
    body: "We're rolling out chat-style rendering for support inboxes. If you want it on by default, ping us.",
  },
  {
    subject: "Office hours Friday",
    body: "Holding open office hours this Friday at 11am PT. Come ask anything — we'll be in the Slack #saasmail channel.",
  },
  {
    subject: "Outage post-mortem",
    body: "Yesterday's 23-minute outage was caused by a bad config push. Post-mortem here. Sorry for the trouble.",
  },
];

const NOTIFICATIONS_SNIPPETS: Snippet[] = [
  {
    subject: "[CI] Build failed on main",
    body: "Build #4521 failed: \"Cannot find module '@/lib/foo'\". Triggered by commit 8a3f2b9.",
  },
  {
    subject: "Domain verification successful",
    body: "Your domain mail.acme.co is now verified. SPF, DKIM, and DMARC checks all passing.",
  },
  {
    subject: "Daily summary — 14 unread",
    body: "You have 14 unread messages across 4 inboxes. Oldest is 2 days old.",
  },
  {
    subject: "Webhook delivery quota at 80%",
    body: "You've used 80% of your monthly webhook quota. Upgrade or wait until the cycle resets on the 1st.",
  },
  {
    subject: "Login from new device",
    body: "A new sign-in was detected from Chrome on macOS, San Francisco. If this wasn't you, rotate your password.",
  },
  {
    subject: "Password expires in 7 days",
    body: "Your account password is set to expire on Nov 12. Update it from settings to avoid being locked out.",
  },
];

const INBOX_SNIPPETS: Record<string, Snippet[]> = {
  "support@example.com": SUPPORT_SNIPPETS,
  "sales@example.com": SALES_SNIPPETS,
  "billing@example.com": BILLING_SNIPPETS,
  "hello@example.com": HELLO_SNIPPETS,
  "newsletter@example.com": NEWSLETTER_SNIPPETS,
  "notifications@example.com": NOTIFICATIONS_SNIPPETS,
};

// Padding text used to inflate "long" emails so we have a real range
// of message lengths in the dataset (short / medium / long mix).
const FILLER_LINES = [
  "For context: we kicked off this initiative back in Q2 and have been iterating since.",
  "Happy to jump on a call if it's easier than going back and forth in email.",
  "I've also CC'd our team lead in case anyone else needs to weigh in.",
  "Below is a more detailed breakdown of what we tried and the order we tried it in.",
  "We can be flexible on timing — let us know what works on your end.",
  "Just so you have the full picture, here's how this fits into our broader rollout plan.",
  "I attached the relevant logs / screenshots / configs — let me know if you can't open them.",
  "We're not blocked yet but it's becoming a recurring distraction during planning.",
  "If it helps narrow things down, we can repro it deterministically on a fresh account too.",
  "Open to suggestions on how to approach this differently if our framing is off.",
];

function inflateBody(body: string, targetWords: number): string {
  const lines = [body];
  while (lines.join(" ").split(/\s+/).length < targetWords) {
    lines.push(pick(FILLER_LINES));
  }
  return lines.join("\n\n");
}

function bodyHtml(text: string): string {
  return text
    .split(/\n\n+/)
    .map((p) => `<p>${sqlEscape(p)}</p>`)
    .join("");
}

// ---------------------------------------------------------------------------
// Build people
// ---------------------------------------------------------------------------
interface Person {
  id: string;
  email: string;
  name: string;
  inboxes: string[]; // recipients they email
  createdOffsetDays: number;
}

function buildPeople(count: number): Person[] {
  const seen = new Set<string>();
  const out: Person[] = [];
  let i = 0;
  while (out.length < count) {
    const fn = pick(FIRST_NAMES);
    const ln = pick(LAST_NAMES);
    const dom = pick(DOMAINS);
    const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${i % 5 === 0 ? "" : ""}@${dom}`;
    if (seen.has(email)) {
      i++;
      continue;
    }
    seen.add(email);
    const inboxCount = chance(0.5) ? 1 : chance(0.6) ? 2 : chance(0.7) ? 3 : 4;
    const inboxes = pickN(INBOXES, inboxCount).map((i) => i.email);
    out.push({
      id: `p_${out.length.toString().padStart(3, "0")}`,
      email,
      name: `${fn} ${ln}`,
      inboxes,
      createdOffsetDays: randInt(1, 60),
    });
    i++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Build emails per person, per inbox
// ---------------------------------------------------------------------------
interface Email {
  id: string;
  personId: string;
  recipient: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  isRead: 0 | 1;
  receivedOffsetSec: number;
  cc?: CcEntry[];
}

interface SentReply {
  id: string;
  personId: string;
  fromAddress: string;
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  inReplyTo: string | null;
  sentOffsetSec: number;
  cc?: CcEntry[];
}

// ---------------------------------------------------------------------------
// CC roster helpers
// ---------------------------------------------------------------------------
function pickCcRoster(): CcEntry[] {
  // Choose 1-3 CCs. Most common: mix of one internal + one or two external.
  // Sometimes all-external or all-internal.
  const flavorRoll = rand();
  const total = randInt(1, 3);
  if (flavorRoll < 0.6) {
    // Mix: 1 internal + (total-1) external (with at least 1 external).
    const internalCount = Math.max(1, Math.min(1, total - 1));
    const externalCount = total - internalCount;
    return [
      ...pickN(INTERNAL_TEAM, internalCount),
      ...pickN(EXTERNAL_COLLABORATORS, externalCount),
    ];
  } else if (flavorRoll < 0.85) {
    // All external.
    return pickN(EXTERNAL_COLLABORATORS, total);
  } else {
    // All internal.
    return pickN(INTERNAL_TEAM, Math.min(total, INTERNAL_TEAM.length));
  }
}

function ccToJson(cc: CcEntry[]): string {
  // Build JSON, then encode for SQL: single quotes inside JSON values
  // (e.g. "Lin O'Brien") need to become '' in the SQL string literal.
  const json = JSON.stringify(
    cc.map((c) => ({ email: c.email, name: c.name ?? null })),
  );
  return `'${sqlEscape(json)}'`;
}

// ---------------------------------------------------------------------------
// Attachments — small fake fixture files we ship in seeds/attachments/ and
// upload to R2 via seeds/upload-attachments.sh.
// ---------------------------------------------------------------------------
interface AttachmentFixture {
  filename: string;
  contentType: string;
}

const ATTACHMENT_FIXTURES: AttachmentFixture[] = [
  { filename: "invoice.pdf", contentType: "application/pdf" },
  { filename: "screenshot.png", contentType: "image/png" },
  { filename: "Q3-budget.csv", contentType: "text/csv" },
  { filename: "meeting-notes.txt", contentType: "text/plain" },
  {
    filename: "roadmap.docx",
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  { filename: "logs.txt", contentType: "text/plain" },
];

interface Attachment {
  id: string;
  emailId: string;
  filename: string;
  contentType: string;
  size: number;
  r2Key: string;
}

function fixtureSize(filename: string): number {
  // Resolve relative to this file regardless of cwd.
  const dir = import.meta.dirname ?? new URL(".", import.meta.url).pathname;
  return statSync(join(dir, "attachments", filename)).size;
}

function buildEmails(people: Person[]): {
  emails: Email[];
  sent: SentReply[];
  attachments: Attachment[];
  rosterChangePeopleIds: string[];
} {
  const emails: Email[] = [];
  const sent: SentReply[] = [];
  const attachments: Attachment[] = [];
  let eId = 0;
  let sId = 0;
  let aId = 0;

  // Pre-compute the 5 roster-change demo people: the FIRST 5 people whose
  // total inbound count would be >= 3. We don't know inbound counts yet
  // because they're determined inside this function, so we do a dry pass
  // using the same RNG-free heuristic: a person is eligible if they have
  // any inbox where the thread length >= 3. To keep this deterministic
  // without disturbing the main RNG sequence we instead pick people whose
  // inbox roster makes 3+ inbound likely (sum of inbox count >= 1 plus
  // we'll re-check after generation). Simpler approach: do generation
  // first, then assign roster changes to the first 5 eligible people in a
  // post-pass that overwrites cc on their longest thread (so the rest of
  // the RNG stream is preserved).

  // Track threads as we generate, so the roster-change post-pass can find
  // the longest thread per person without rescanning emails twice.
  // threadIndex: personId -> inbox -> [emailId, emailId, ...]
  const threads: Map<string, Map<string, string[]>> = new Map();

  for (const p of people) {
    for (const inbox of p.inboxes) {
      // Heavy-tailed thread length: most are 1-3, some 4-8, a few 9-15.
      const r = rand();
      const threadLen =
        r < 0.55 ? randInt(1, 3) : r < 0.9 ? randInt(4, 8) : randInt(9, 15);
      const snippets = INBOX_SNIPPETS[inbox] ?? HELLO_SNIPPETS;
      // Pick a base subject; replies reuse "Re: <subject>".
      const base = pick(snippets);
      const isAutomated =
        inbox === "newsletter@example.com" ||
        inbox === "notifications@example.com";
      const threadIds: string[] = [];

      for (let i = 0; i < threadLen; i++) {
        // Spread emails across the time the person has existed (max 60 days back).
        const maxOffsetDays = p.createdOffsetDays;
        const offsetDays =
          (maxOffsetDays * (threadLen - i)) / threadLen + rand() * 0.5;
        const offsetSec = Math.floor(offsetDays * 86400) + randInt(0, 86399);

        const isFirst = i === 0;
        const subject = isFirst ? base.subject : `Re: ${base.subject}`;
        // Body: pull a different snippet for follow-ups; vary length.
        const snippet = isFirst ? base : pick(snippets);
        // Length distribution: 30% short, 50% med, 20% long. Skew automated short.
        const lengthRoll = rand();
        const targetWords = isAutomated
          ? randInt(15, 40)
          : lengthRoll < 0.3
            ? randInt(20, 45)
            : lengthRoll < 0.8
              ? randInt(60, 140)
              : randInt(180, 320);
        const text = inflateBody(snippet.body, targetWords);

        // Read state: very recent emails skew unread.
        const isRecent = offsetDays < 3;
        const isRead: 0 | 1 = isRecent
          ? chance(0.5)
            ? 0
            : 1
          : chance(0.85)
            ? 1
            : 0;

        // ~20% chance this email has CCs (skip automated newsletter/
        // notifications inboxes — those are blast lists, not conversations).
        const cc = !isAutomated && chance(0.2) ? pickCcRoster() : undefined;

        const emailId = `e_${eId.toString().padStart(4, "0")}`;
        emails.push({
          id: emailId,
          personId: p.id,
          recipient: inbox,
          subject,
          bodyHtml: bodyHtml(text),
          bodyText: text,
          isRead,
          receivedOffsetSec: offsetSec,
          cc,
        });
        threadIds.push(emailId);
        eId++;

        // ~15% chance of 1-2 attachments on inbound emails (skip automated).
        if (!isAutomated && chance(0.15)) {
          const attachCount = chance(0.7) ? 1 : 2;
          const fixtures = pickN(ATTACHMENT_FIXTURES, attachCount);
          for (const fix of fixtures) {
            const attId = `a_${aId.toString().padStart(4, "0")}`;
            attachments.push({
              id: attId,
              emailId,
              filename: fix.filename,
              contentType: fix.contentType,
              size: fixtureSize(fix.filename),
              r2Key: `attachments/${emailId}/${attId}/${fix.filename}`,
            });
            aId++;
          }
        }
      }

      if (!threads.has(p.id)) threads.set(p.id, new Map());
      threads.get(p.id)!.set(inbox, threadIds);

      // Sometimes seed a reply from us back to them (~30% of threads).
      if (!isAutomated && chance(0.3)) {
        const replyOffsetSec = randInt(1800, 86400 * 2);
        const lastEmail = emails[emails.length - 1];
        const replyText = inflateBody(
          "Thanks for reaching out — I've looped in the right person on our side. Will follow up shortly with a more concrete answer.",
          randInt(30, 80),
        );
        // Sent replies also get CCs ~20% of the time.
        const sentCc = chance(0.2) ? pickCcRoster() : undefined;
        sent.push({
          id: `s_${sId.toString().padStart(4, "0")}`,
          personId: p.id,
          fromAddress: inbox,
          to: p.email,
          subject: `Re: ${base.subject}`,
          bodyHtml: bodyHtml(replyText),
          bodyText: replyText,
          inReplyTo: lastEmail.id,
          sentOffsetSec: Math.max(
            lastEmail.receivedOffsetSec - replyOffsetSec,
            60,
          ),
          cc: sentCc,
        });
        sId++;
      }
    }
  }

  // ---- Roster-change demo --------------------------------------------------
  // Pick first 5 people in id order whose total inbound count >= 3, then
  // overwrite cc on a single thread per person (the longest one with len >= 3)
  // to demonstrate add/drop roster changes between consecutive messages.
  const inboundCounts = new Map<string, number>();
  for (const e of emails) {
    inboundCounts.set(e.personId, (inboundCounts.get(e.personId) ?? 0) + 1);
  }
  const rosterChangePeopleIds: string[] = [];
  for (const p of people) {
    if (rosterChangePeopleIds.length >= 5) break;
    if ((inboundCounts.get(p.id) ?? 0) < 3) continue;
    const inboxThreads = threads.get(p.id);
    if (!inboxThreads) continue;
    // Find the longest thread for this person with len >= 3.
    let bestInbox: string | null = null;
    let bestLen = 0;
    for (const [inbox, ids] of inboxThreads) {
      if (ids.length >= 3 && ids.length > bestLen) {
        bestInbox = inbox;
        bestLen = ids.length;
      }
    }
    if (!bestInbox) continue;
    const ids = inboxThreads.get(bestInbox)!;
    // Build a small roster change pattern: external1 alone, then add
    // internal1, then drop internal1 (back to external1), and so on.
    const ext1 = EXTERNAL_COLLABORATORS[0];
    const ext2 = EXTERNAL_COLLABORATORS[1];
    const int1 = INTERNAL_TEAM[0];
    const int2 = INTERNAL_TEAM[1];
    const rosters: CcEntry[][] = [
      [ext1],
      [ext1, int1],
      [ext1],
      [ext1, ext2, int1],
      [ext1, ext2, int1, int2],
      [ext1, ext2, int2],
      [ext2, int2],
      [int2],
    ];
    for (let i = 0; i < ids.length; i++) {
      const target = emails.find((e) => e.id === ids[i]);
      if (!target) continue;
      target.cc = rosters[i % rosters.length];
    }
    rosterChangePeopleIds.push(p.id);
  }

  return { emails, sent, attachments, rosterChangePeopleIds };
}

// ---------------------------------------------------------------------------
// Render SQL
// ---------------------------------------------------------------------------
interface RenderResult {
  sql: string;
  attachments: Attachment[];
  rosterChangePeopleIds: string[];
  stats: { people: number; emails: number; sent: number; attachments: number };
}

function renderSql(): RenderResult {
  const people = buildPeople(100);
  const { emails, sent, attachments, rosterChangePeopleIds } =
    buildEmails(people);

  const lines: string[] = [];

  lines.push(
    "-- AUTO-GENERATED by seeds/generate-demo.ts. Do not edit by hand.",
  );
  lines.push("-- Run: yarn db:seed:dev (after re-running the generator).");
  lines.push(
    `-- Stats: ${people.length} people, ${emails.length} emails, ${sent.length} sent replies, ${attachments.length} attachments.`,
  );
  lines.push("");
  lines.push("DELETE FROM sequence_emails;");
  lines.push("DELETE FROM sequence_enrollments;");
  lines.push("DELETE FROM sequences;");
  lines.push("DELETE FROM api_keys;");
  lines.push("DELETE FROM email_templates;");
  lines.push("DELETE FROM invitations;");
  lines.push("DELETE FROM attachments;");
  lines.push("DELETE FROM sent_emails;");
  lines.push("DELETE FROM emails;");
  lines.push("DELETE FROM people;");
  lines.push("DELETE FROM inbox_permissions;");
  lines.push("DELETE FROM sender_identities;");
  lines.push("");

  // Inboxes
  lines.push(
    "INSERT OR REPLACE INTO sender_identities (email, display_name, created_at, updated_at) VALUES",
  );
  lines.push(
    INBOXES.map(
      (i) =>
        `  ('${i.email}', '${sqlEscape(i.display)}', CAST(strftime('%s','now') AS INTEGER), CAST(strftime('%s','now') AS INTEGER))`,
    ).join(",\n") + ";",
  );
  lines.push("");

  // People
  lines.push(
    "INSERT OR REPLACE INTO people (id, email, name, last_email_at, unread_count, total_count, created_at, updated_at) VALUES",
  );
  lines.push(
    people
      .map(
        (p) =>
          `  ('${p.id}', '${sqlEscape(p.email)}', '${sqlEscape(p.name)}', 0, 0, 0, (CAST(strftime('%s','now') AS INTEGER) - 86400 * ${p.createdOffsetDays}), CAST(strftime('%s','now') AS INTEGER))`,
      )
      .join(",\n") + ";",
  );
  lines.push("");

  // Emails — chunk inserts so we don't blow past SQLite's statement limit.
  const CHUNK = 50;
  for (let off = 0; off < emails.length; off += CHUNK) {
    const chunk = emails.slice(off, off + CHUNK);
    lines.push(
      "INSERT OR REPLACE INTO emails (id, person_id, recipient, subject, body_html, body_text, raw_headers, message_id, spf, dkim, dmarc, is_read, received_at, created_at, cc) VALUES",
    );
    lines.push(
      chunk
        .map(
          (e) =>
            `  ('${e.id}', '${e.personId}', '${e.recipient}', '${sqlEscape(e.subject)}', '${e.bodyHtml}', '${sqlEscape(e.bodyText)}', '{}', '<${e.id}@example.test>', 'pass', 'pass', 'pass', ${e.isRead}, (CAST(strftime('%s','now') AS INTEGER) - ${e.receivedOffsetSec}), (CAST(strftime('%s','now') AS INTEGER) - ${e.receivedOffsetSec}), ${e.cc ? ccToJson(e.cc) : "NULL"})`,
        )
        .join(",\n") + ";",
    );
    lines.push("");
  }

  // Sent replies
  if (sent.length > 0) {
    for (let off = 0; off < sent.length; off += CHUNK) {
      const chunk = sent.slice(off, off + CHUNK);
      lines.push(
        "INSERT OR REPLACE INTO sent_emails (id, person_id, to_address, from_address, subject, body_html, body_text, in_reply_to, status, sent_at, created_at, cc) VALUES",
      );
      lines.push(
        chunk
          .map(
            (s) =>
              `  ('${s.id}', '${s.personId}', '${sqlEscape(s.to)}', '${s.fromAddress}', '${sqlEscape(s.subject)}', '${s.bodyHtml}', '${sqlEscape(s.bodyText)}', ${s.inReplyTo ? `'${s.inReplyTo}'` : "NULL"}, 'sent', (CAST(strftime('%s','now') AS INTEGER) - ${s.sentOffsetSec}), (CAST(strftime('%s','now') AS INTEGER) - ${s.sentOffsetSec}), ${s.cc ? ccToJson(s.cc) : "NULL"})`,
          )
          .join(",\n") + ";",
      );
      lines.push("");
    }
  }

  // Attachments
  if (attachments.length > 0) {
    for (let off = 0; off < attachments.length; off += CHUNK) {
      const chunk = attachments.slice(off, off + CHUNK);
      lines.push(
        "INSERT OR REPLACE INTO attachments (id, email_id, filename, content_type, size, r2_key, content_id, created_at) VALUES",
      );
      lines.push(
        chunk
          .map(
            (a) =>
              `  ('${a.id}', '${a.emailId}', '${sqlEscape(a.filename)}', '${sqlEscape(a.contentType)}', ${a.size}, '${sqlEscape(a.r2Key)}', NULL, CAST(strftime('%s','now') AS INTEGER))`,
          )
          .join(",\n") + ";",
      );
      lines.push("");
    }
  }

  // Recompute aggregate columns on people from the emails we just inserted.
  lines.push("UPDATE people SET");
  lines.push(
    "  last_email_at = COALESCE((SELECT MAX(received_at) FROM emails WHERE person_id = people.id), last_email_at),",
  );
  lines.push(
    "  unread_count  = COALESCE((SELECT SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) FROM emails WHERE person_id = people.id), 0),",
  );
  lines.push(
    "  total_count   = COALESCE((SELECT COUNT(*) FROM emails WHERE person_id = people.id), 0);",
  );
  lines.push("");

  return {
    sql: lines.join("\n"),
    attachments,
    rosterChangePeopleIds,
    stats: {
      people: people.length,
      emails: emails.length,
      sent: sent.length,
      attachments: attachments.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Render the upload script — a bash script that pushes every distinct
// (r2_key, filename) pair to the local R2 bucket bound in wrangler.jsonc.
// ---------------------------------------------------------------------------
function renderUploadScript(attachments: Attachment[]): string {
  const lines: string[] = [];
  lines.push("#!/usr/bin/env bash");
  lines.push("# AUTO-GENERATED by seeds/generate-demo.ts. Do not edit.");
  lines.push("# Uploads demo attachments to the local R2 bucket.");
  lines.push("set -e");
  lines.push("");
  lines.push("BUCKET=saasmail-attachments");
  lines.push('SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"');
  lines.push("");
  // Dedupe by r2_key — same key shouldn't be uploaded twice. r2_keys are
  // already unique per (email, attachment) pair so this is just defensive.
  const seen = new Set<string>();
  for (const a of attachments) {
    if (seen.has(a.r2Key)) continue;
    seen.add(a.r2Key);
    // We're calling wrangler from the repo root, so file=seeds/attachments/...
    lines.push(
      `npx wrangler r2 object put "$BUCKET/${a.r2Key}" --file="$SCRIPT_DIR/attachments/${a.filename}" --local`,
    );
  }
  lines.push("");
  lines.push('echo "Uploaded ${#}: $(echo $0)"');
  lines.push("");
  return lines.join("\n");
}

const result = renderSql();
const dir = import.meta.dirname ?? new URL(".", import.meta.url).pathname;
const sqlTarget = join(dir, "demo.sql");
writeFileSync(sqlTarget, result.sql);
const uploadTarget = join(dir, "upload-attachments.sh");
writeFileSync(uploadTarget, renderUploadScript(result.attachments));
console.log(
  `Wrote ${result.sql.length.toLocaleString()} chars to ${sqlTarget}`,
);
console.log(`Wrote upload script to ${uploadTarget}`);
console.log(
  `Stats: ${result.stats.people} people, ${result.stats.emails} emails, ${result.stats.sent} sent, ${result.stats.attachments} attachments`,
);
console.log(
  `Roster-change demo people: ${result.rosterChangePeopleIds.join(", ")}`,
);
