"use client";

import dynamic from "next/dynamic";

export const FondsImportButtonLazy = dynamic(
  () =>
    import("@/components/collaborateur/fonds-import/fonds-import-button").then(
      (m) => m.FondsImportButton,
    ),
  { ssr: false },
);
