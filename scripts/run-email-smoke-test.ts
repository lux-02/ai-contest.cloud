type SmokeResponse = {
  id?: string;
  message?: string;
  error?: string;
};

function getEnv(name: string, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

async function main() {
  const apiKey = getEnv("RESEND_API_KEY");

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is required.");
  }

  const from = getEnv("EMAIL_SMOKE_TEST_FROM", getEnv("REMINDER_EMAIL_FROM", "AI Contest Cloud <onboarding@resend.dev>"));
  const to = getEnv("EMAIL_SMOKE_TEST_TO", "delivered@resend.dev");
  const subject = getEnv("EMAIL_SMOKE_TEST_SUBJECT", "[AI Contest Cloud] Resend smoke test");
  const text = getEnv("EMAIL_SMOKE_TEST_TEXT", "Smoke test from ai-contest.cloud");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      tags: [
        { name: "product", value: "ai-contest-cloud" },
        { name: "kind", value: "smoke-test" },
      ],
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as SmokeResponse;

  if (!response.ok || typeof payload.id !== "string") {
    throw new Error(payload.message || payload.error || "Email smoke test failed.");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        provider: "resend",
        from,
        to,
        messageId: payload.id,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("[email-smoke-test] failed", error);
  process.exitCode = 1;
});

export {};
