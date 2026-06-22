"use client";

import dynamic from "next/dynamic";

export const TrackingImportButtonLazy = dynamic(
  () =>
    import("@/components/collaborateur/tracking-import/tracking-import-button").then(
      (m) => m.TrackingImportButton,
    ),
  { ssr: false },
);
