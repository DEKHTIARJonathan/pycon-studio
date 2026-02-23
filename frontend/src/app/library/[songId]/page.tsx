import { SongDetailClient } from "@/components/library/song-detail-client";

export default async function SongDetailPage({
  params,
}: {
  params: Promise<{ songId: string }>;
}) {
  const { songId } = await params;
  return <SongDetailClient songId={songId} />;
}
