"use client";

import { Button, PageEmpty } from "@/components/ui";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <PageEmpty
      title="That page hit an error"
      body={error.message || "Something broke while rendering. Your saved path is still in local storage."}
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
