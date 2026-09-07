import Link from "next/link";
import { Button, Empty } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-5 py-20">
      <Empty
        title="No such page"
        body="The route you asked for does not exist. Start from your goal and Wayfinder will take it from there."
        action={
          <Link href="/">
            <Button>Go to start</Button>
          </Link>
        }
      />
    </div>
  );
}
