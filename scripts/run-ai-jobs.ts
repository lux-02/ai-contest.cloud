async function main() {
  const requestedLimit = Number(process.argv[2] ?? "5");
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(Math.floor(requestedLimit), 20) : 5;
  const baseUrl = process.env.AI_JOB_RUNNER_BASE_URL ?? "http://127.0.0.1:3000";
  const secret = process.env.AI_JOB_RUNNER_SECRET;

  if (!secret) {
    throw new Error("AI_JOB_RUNNER_SECRET is required.");
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/internal/ai-jobs/drain`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-ai-job-secret": secret,
    },
    body: JSON.stringify({ limit }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(typeof payload?.error === "string" ? payload.error : "AI job drain failed.");
  }

  console.log(JSON.stringify(payload));
}

main().catch((error) => {
  console.error("[ai-jobs] worker failed", error);
  process.exitCode = 1;
});

export {};
