import "server-only";

// Optional Slack notification when a visitor starts a demo migration. No-op
// unless SLACK_WEBHOOK_URL is set, so local dev and the open-source repo stay
// silent by default. Set it to a Slack Incoming Webhook URL to get pinged.

type DemoCreatedInput = {
  product: string;
  slug: string;
  email: string | null;
  templates: string[];
  source: string | null;
  migrationId: string;
};

export async function notifyDemoCreated(input: DemoCreatedInput): Promise<void> {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) return;

  const who = input.email || "an unverified visitor";
  const templates = input.templates.length ? input.templates.join(", ") : "—";
  const summary = `:rocket: New *${input.product}* demo started by ${who}`;
  const details = [
    `*Demo:* ${input.slug}`,
    `*Templates:* ${templates}`,
    input.source ? `*Source:* ${input.source}` : null,
    `*Migration:* \`${input.migrationId}\``,
  ]
    .filter(Boolean)
    .join("  •  ");

  const payload = {
    text: summary,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: summary } },
      { type: "context", elements: [{ type: "mrkdwn", text: details }] },
    ],
  };

  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // Never let a slow/failing Slack call block or break the demo flow.
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // Swallow notification errors — they must not affect migration creation.
  }
}
