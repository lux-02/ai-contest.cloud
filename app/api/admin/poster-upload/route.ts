import { NextResponse } from "next/server";

import {
  getSupabasePublishableKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "@/lib/admin-auth";
import { getAdminSession } from "@/lib/server/admin-auth";

export const runtime = "nodejs";

function getFileExtension(filename: string) {
  return filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
}

export async function POST(request: Request) {
  const adminSession = await getAdminSession();

  if (!adminSession.user) {
    return NextResponse.json({ error: "관리자 로그인 세션이 필요합니다." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "업로드할 파일이 없습니다." }, { status: 400 });
  }

  const allowedTypes = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "image/svg+xml",
    "image/avif",
  ]);

  if (!allowedTypes.has(file.type)) {
    return NextResponse.json({ error: "지원하지 않는 이미지 형식입니다." }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "이미지는 5MB 이하만 업로드할 수 있습니다." }, { status: 400 });
  }

  const extension = getFileExtension(file.name);
  const objectPath = `posters/${crypto.randomUUID()}.${extension}`;
  const url = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  const authToken = serviceRoleKey || adminSession.accessToken;
  const apiKey = serviceRoleKey || getSupabasePublishableKey();

  if (!url || !authToken || !apiKey) {
    return NextResponse.json({ error: "Supabase 업로드 설정이 누락되었습니다." }, { status: 500 });
  }

  const uploadResponse = await fetch(`${url}/storage/v1/object/contest-posters/${objectPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
      apikey: apiKey,
      "Content-Type": file.type,
      "x-upsert": "false",
    },
    body: await file.arrayBuffer(),
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    return NextResponse.json({ error: errorText || "업로드에 실패했습니다." }, { status: uploadResponse.status });
  }

  return NextResponse.json({
    publicUrl: `${url}/storage/v1/object/public/contest-posters/${objectPath}`,
  });
}
