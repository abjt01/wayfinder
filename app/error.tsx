"use client";

import { Button, Empty } from "@/components/ui";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-20">
      <Empty
        title="That page hit an error"
        body={error.message || "Something broke while rendering. Your saved path is still in local storage."}
        action={<Button onClick={reset}>Try again</Button>}
      />
    </div>
  );
}
