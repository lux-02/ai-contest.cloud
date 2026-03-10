import "server-only";

import { cache } from "react";

import { getSupabasePublishableKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/admin-auth";

type AuthSettingsResponse = {
  external?: {
    google?: boolean;
  };
};

export const isGoogleAuthProviderEnabled = cache(async () => {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const response = await fetch(`${getSupabaseUrl()}/auth/v1/settings`, {
      headers: {
        apikey: getSupabasePublishableKey(),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return false;
    }

    const settings = (await response.json()) as AuthSettingsResponse;
    return Boolean(settings.external?.google);
  } catch {
    return false;
  }
});
