export function getViewerReturnTargetLabel(nextPath: string) {
  if (nextPath.startsWith("/contests/")) {
    return "이 공고";
  }

  if (nextPath.startsWith("/contests")) {
    return "탐색 화면";
  }

  if (nextPath.startsWith("/team/")) {
    return "팀 빌딩 화면";
  }

  if (nextPath.startsWith("/my")) {
    return "내 활동";
  }

  return "이전 화면";
}

export function getViewerReturnDescription(nextPath: string) {
  const targetLabel = getViewerReturnTargetLabel(nextPath);

  if (targetLabel === "이 공고") {
    return "Google 인증을 마치면 지금 보던 공고로 바로 돌아갑니다.";
  }

  if (targetLabel === "내 활동") {
    return "Google 인증을 마치면 저장한 공고와 진행 상태를 바로 확인할 수 있습니다.";
  }

  if (targetLabel === "탐색 화면") {
    return "Google 인증을 마치면 방금 보던 탐색 화면으로 돌아갑니다.";
  }

  if (targetLabel === "팀 빌딩 화면") {
    return "Google 인증을 마치면 방금 보던 팀 빌딩 화면으로 돌아갑니다.";
  }

  return "Google 인증을 마치면 이전 화면으로 돌아갑니다.";
}

export function getViewerGoogleActionLabel(nextPath: string) {
  const targetLabel = getViewerReturnTargetLabel(nextPath);

  if (targetLabel === "내 활동") {
    return "Google로 로그인";
  }

  if (targetLabel === "이전 화면") {
    return "Google로 로그인하고 계속하기";
  }

  return `Google로 로그인하고 ${targetLabel}로 돌아가기`;
}

export function getViewerContinueActionLabel(nextPath: string) {
  const targetLabel = getViewerReturnTargetLabel(nextPath);

  if (targetLabel === "내 활동") {
    return "로그인 후 시작하기";
  }

  if (targetLabel === "이전 화면") {
    return "로그인하고 계속하기";
  }

  return `로그인하고 ${targetLabel}로 돌아가기`;
}
