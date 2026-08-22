import type { Database } from "@/types/database";

type CafeRow = Database["public"]["Tables"]["cafes"]["Row"];
type VisitRow = Database["public"]["Tables"]["cafe_visits"]["Row"];
type PhotoRow = Database["public"]["Tables"]["cafe_photos"]["Row"];
type MenuRow = Database["public"]["Tables"]["cafe_menus"]["Row"];
type SnapshotRow = Database["public"]["Tables"]["cafe_business_snapshots"]["Row"];
type ObservationRow = Database["public"]["Tables"]["visit_occupancy_observations"]["Row"];

export type PhotoWithUrl = PhotoRow & { signedUrl: string | null };

export type VisitRecord = VisitRow & {
  cafe: CafeRow;
  snapshot: SnapshotRow | null;
  photos: PhotoWithUrl[];
  menus: MenuRow[];
  observations: ObservationRow[];
};

export type VisitListItem = VisitRow & {
  cafe: CafeRow;
  snapshot: SnapshotRow | null;
  photos: PhotoWithUrl[];
};

export type ObservationBucket = {
  key: string;
  label: string;
  averageOccupancyRate: number;
  count: number;
};
