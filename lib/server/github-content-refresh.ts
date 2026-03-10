import "server-only";

type RefreshReason = "contest_created" | "contest_updated" | "contest_deleted";

type TriggerContentRefreshOptions = {
  slug?: string;
  reason: RefreshReason;
};

function getRefreshConfig() {
  const token = process.env.GITHUB_CONTENT_REFRESH_TOKEN ?? "";

  if (!token) {
    return null;
  }

  return {
    token,
    owner: process.env.GITHUB_CONTENT_REFRESH_OWNER ?? "lux-02",
    repo: process.env.GITHUB_CONTENT_REFRESH_REPO ?? "ai-contest.cloud",
    workflowId: process.env.GITHUB_CONTENT_REFRESH_WORKFLOW_ID ?? "update-readme-lineup.yml",
    ref: process.env.GITHUB_CONTENT_REFRESH_REF ?? "main",
    timeoutMs: Number(process.env.GITHUB_CONTENT_REFRESH_TIMEOUT_MS ?? "8000"),
  };
}

export async function triggerGitHubContentRefresh(options: TriggerContentRefreshOptions) {
  const config = getRefreshConfig();

  if (!config) {
    return { triggered: false, reason: "missing_config" as const };
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${config.owner}/${config.repo}/actions/workflows/${config.workflowId}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "ai-contest-cloud",
        },
        body: JSON.stringify({
          ref: config.ref,
          inputs: {
            reason: options.reason,
            slug: options.slug ?? "",
          },
        }),
        signal: AbortSignal.timeout(config.timeoutMs),
      },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`GitHub workflow dispatch failed: ${response.status} ${body}`);
    }

    return { triggered: true as const };
  } catch (error) {
    console.error("[github-content-refresh] failed to dispatch workflow", error);
    return { triggered: false as const, reason: "dispatch_failed" as const };
  }
}
