async function main() {
  const requestedLimit = Number(process.argv[2] ?? "20");
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(Math.floor(requestedLimit), 50) : 20;
  const baseUrl = process.env.REMINDER_JOB_RUNNER_BASE_URL ?? process.env.AI_JOB_RUNNER_BASE_URL ?? "http://127.0.0.1:3000";
  const secret = process.env.REMINDER_JOB_RUNNER_SECRET ?? process.env.AI_JOB_RUNNER_SECRET;

  if (!secret) {
    throw new Error("REMINDER_JOB_RUNNER_SECRET is required.");
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/internal/contest-reminders/drain`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-reminder-job-secret": secret,
    },
    body: JSON.stringify({ limit }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(typeof payload?.error === "string" ? payload.error : "Contest reminder drain failed.");
  }

  console.log(JSON.stringify(payload));
}

main().catch((error) => {
  console.error("[contest-reminders] runner failed", error);
  process.exitCode = 1;
});

export {};
