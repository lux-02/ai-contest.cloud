import "server-only";

import { getContests } from "@/lib/queries";
import { getSupabaseServerClient } from "@/lib/server/supabase";
import type { Contest, ContestTrackingState, ContestTrackingStatus } from "@/types/contest";

type ContestTrackingRow = {
  contest_id: string;
  status: ContestTrackingStatus | null;
  reminder_enabled: boolean;
  reminder_days_before: number;
  last_reminder_sent_at: string | null;
  updated_at: string;
};

export async function getContestTrackingState(contestId: string): Promise<ContestTrackingState | null> {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("contest_user_tracking")
    .select("status, reminder_enabled, reminder_days_before, last_reminder_sent_at, updated_at")
    .eq("contest_id", contestId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    status: data.status,
    reminderEnabled: data.reminder_enabled,
    reminderDaysBefore: data.reminder_days_before,
    lastReminderSentAt: data.last_reminder_sent_at ?? undefined,
    updatedAt: data.updated_at,
  };
}

export async function upsertContestTrackingStatus(contestId: string, userId: string, status: ContestTrackingStatus) {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase server client is not configured.");
  }

  const { error } = await supabase.from("contest_user_tracking").upsert(
    {
      contest_id: contestId,
      user_id: userId,
      status,
    },
    {
      onConflict: "user_id,contest_id",
    },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function setContestReminderPreference(
  contestId: string,
  userId: string,
  reminderEnabled: boolean,
  reminderDaysBefore: number,
) {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase server client is not configured.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("contest_user_tracking")
    .select("id, status")
    .eq("contest_id", contestId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (!existing && !reminderEnabled) {
    return;
  }

  if (!reminderEnabled && existing?.status === null) {
    const { error } = await supabase
      .from("contest_user_tracking")
      .delete()
      .eq("contest_id", contestId)
      .eq("user_id", userId);

    if (error) {
      throw new Error(error.message);
    }

    return;
  }

  const { error } = await supabase.from("contest_user_tracking").upsert(
    {
      contest_id: contestId,
      user_id: userId,
      status: existing?.status ?? null,
      reminder_enabled: reminderEnabled,
      reminder_days_before: reminderDaysBefore,
    },
    {
      onConflict: "user_id,contest_id",
    },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function getTrackedContestsForViewer() {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return [];
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("contest_user_tracking")
    .select("contest_id, status, reminder_enabled, reminder_days_before, last_reminder_sent_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error || !data?.length) {
    return [];
  }

  const contests = await getContests();
  const contestMap = new Map(contests.map((contest) => [contest.id, contest]));

  return (data as ContestTrackingRow[])
    .map((row) => {
      const contest = contestMap.get(row.contest_id);

      if (!contest) {
        return null;
      }

      return {
        contest,
        tracking: {
          status: row.status,
          reminderEnabled: row.reminder_enabled,
          reminderDaysBefore: row.reminder_days_before,
          lastReminderSentAt: row.last_reminder_sent_at ?? undefined,
          updatedAt: row.updated_at,
        } satisfies ContestTrackingState,
      };
    })
    .flatMap((entry) => (entry ? [entry] : []));
}

export function groupTrackedContestsByStatus(
  entries: Array<{ contest: Contest; tracking: ContestTrackingState }>,
) {
  return {
    saved: entries.filter((entry) => entry.tracking.status === "saved"),
    planning: entries.filter((entry) => entry.tracking.status === "planning"),
    applied: entries.filter((entry) => entry.tracking.status === "applied"),
    reminders: entries.filter((entry) => entry.tracking.reminderEnabled),
  };
}
