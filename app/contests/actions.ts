"use server";

import { revalidatePath } from "next/cache";

import { requireViewerUser, sanitizeViewerNextPath } from "@/lib/server/viewer-auth";
import {
  setContestReminderPreference,
  upsertContestTrackingStatus,
} from "@/lib/server/contest-tracking";
import { isContestTrackingStatus } from "@/types/contest";

export async function setContestTrackingStatusAction(formData: FormData) {
  const contestId = String(formData.get("contestId") ?? "");
  const status = String(formData.get("status") ?? "");
  const nextPath = sanitizeViewerNextPath(String(formData.get("next") ?? "/my"));
  const user = await requireViewerUser(nextPath);

  if (!contestId || !isContestTrackingStatus(status)) {
    return;
  }

  await upsertContestTrackingStatus(contestId, user.id, status);

  revalidatePath(nextPath);
  revalidatePath("/my");
}

export async function toggleContestReminderAction(formData: FormData) {
  const contestId = String(formData.get("contestId") ?? "");
  const nextPath = sanitizeViewerNextPath(String(formData.get("next") ?? "/my"));
  const reminderEnabled = String(formData.get("reminderEnabled") ?? "") === "true";
  const reminderDaysBefore = Number(formData.get("reminderDaysBefore") ?? "3");
  const user = await requireViewerUser(nextPath);

  if (!contestId) {
    return;
  }

  await setContestReminderPreference(contestId, user.id, reminderEnabled, reminderDaysBefore);

  revalidatePath(nextPath);
  revalidatePath("/my");
}
