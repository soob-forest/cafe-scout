import type { getVisit } from "./repository";

export type VisitDetailRecord = NonNullable<Awaited<ReturnType<typeof getVisit>>>;
