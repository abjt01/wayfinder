import { Spinner } from "@/components/ui";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1180px] px-4 sm:px-5 py-20">
      <Spinner label="Loading" />
    </div>
  );
}
