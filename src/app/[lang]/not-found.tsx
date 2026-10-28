import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-3 py-10">
      <h1 className="text-2xl font-bold">नहीं मिला · Not found</h1>
      <Link href="/" className="rounded-xl bg-brand px-4 py-2 font-semibold text-brand-ink">
        होम · Home
      </Link>
    </div>
  );
}
