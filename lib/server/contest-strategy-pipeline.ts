import "server-only";

import type { Contest, ContestStrategyLabResult } from "@/types/contest";

import type { CollectedStrategySource } from "./contest-source-collector";
import { collectContestSources } from "./contest-source-collector";
import { logRemoteAiFallback } from "./remote-ai-runtime";
import { upsertStrategyReport } from "./contest-strategy-report-store";
import {
  canUseRemoteContestStrategyService,
  generateContestStrategyWithRemoteService,
} from "./contest-strategy-service";
import { generateContestStrategyLab } from "./contest-strategy-lab";

type StrategyPipelineOptions = {
  userIdea?: string;
  persist?: boolean;
  onProgress?: (label: string) => Promise<void> | void;
};

type StrategyPipelineOutput = {
  result: ContestStrategyLabResult;
  sources: CollectedStrategySource[];
};

async function updateProgress(
  onProgress: StrategyPipelineOptions["onProgress"],
  label: string,
) {
  if (!onProgress) {
    return;
  }

  await onProgress(label);
}

export async function runContestStrategyPipeline(
  contest: Contest,
  options: StrategyPipelineOptions = {},
): Promise<StrategyPipelineOutput> {
  const userIdea = options.userIdea?.trim() || undefined;
  const shouldPersist = options.persist ?? !userIdea;

  let sources: CollectedStrategySource[];
  let result: ContestStrategyLabResult;

  if (canUseRemoteContestStrategyService() && !userIdea) {
    await updateProgress(options.onProgress, "원격 전략 엔진에 요청 중이에요");

    try {
      const remote = await generateContestStrategyWithRemoteService(contest);
      sources = remote.sources;
      result = remote.result;
    } catch (error) {
      logRemoteAiFallback("contest-strategy", error, {
        contestSlug: contest.slug,
        route: "strategy-lab",
      });

      await updateProgress(options.onProgress, "공고와 참고 소스를 다시 읽고 있어요");
      sources = await collectContestSources(contest);
      await updateProgress(options.onProgress, "심사 기준과 제출 요건을 바탕으로 초안을 만드는 중이에요");
      result = await generateContestStrategyLab(contest, sources, { userIdea });
    }
  } else {
    await updateProgress(options.onProgress, "공고와 참고 소스를 읽고 있어요");
    sources = await collectContestSources(contest);
    await updateProgress(options.onProgress, "심사 기준과 제출 요건을 정리 중이에요");
    result = await generateContestStrategyLab(contest, sources, { userIdea });
  }

  if (result.status === "failed") {
    throw new Error("브레인스토밍 생성에 실패했습니다.");
  }

  if (shouldPersist) {
    await updateProgress(options.onProgress, "전략 리포트를 저장하고 있어요");
    try {
      await upsertStrategyReport(contest.id, result, sources);
    } catch (error) {
      console.error("[strategy-lab] could not persist generated report", error);
    }
  }

  await updateProgress(options.onProgress, "전략 리포트를 마무리했어요");

  return {
    result,
    sources,
  };
}
