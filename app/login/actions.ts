"use server";

import { redirect } from "next/navigation";

import { clearViewerSession } from "@/lib/server/viewer-auth";

export async function logoutViewerAction() {
  await clearViewerSession();
  redirect("/");
}
