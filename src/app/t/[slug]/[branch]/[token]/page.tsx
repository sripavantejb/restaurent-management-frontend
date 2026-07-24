import GuestTableClient from "./GuestTableClient";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; branch: string; token: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const p = await params;
  const s = await searchParams;
  return (
    <GuestTableClient
      slug={p.slug}
      branch={p.branch}
      token={p.token}
      version={s.v || "1"}
    />
  );
}
