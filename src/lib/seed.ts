import type { EventRow } from "../types";
import { addDays, createEvent, startOfWeek, todayISO } from "./store";

/** Demo seed with intentional Thursday evening clash for the pitch. */
export function seedDemoEvents(): EventRow[] {
  const week = startOfWeek(todayISO());
  const thu = addDays(week, 3);
  const sat = addDays(week, 5);
  const tue = addDays(week, 1);

  return [
    createEvent({
      title: "Founder office hours",
      date: thu,
      timeBand: "evening",
      org: "Harbour Launch Collective",
      postedBy: "Jordan",
      notes: "Zoom room A",
      checkedBeforePublish: true,
    }),
    createEvent({
      title: "Pitch practice circle",
      date: thu,
      timeBand: "evening",
      org: "Peer Hub East",
      postedBy: "Mia",
      notes: "Same night as Harbour Launch — intentional demo clash",
      checkedBeforePublish: false,
    }),
    createEvent({
      title: "Grant clinic",
      date: sat,
      timeBand: "morning",
      org: "Coastal Founders Lab",
      postedBy: "Alex",
      checkedBeforePublish: true,
    }),
    createEvent({
      title: "Mentor coffee",
      date: tue,
      timeBand: "afternoon",
      org: "Northwind Mentors",
      postedBy: "Sam",
      checkedBeforePublish: true,
    }),
    createEvent({
      title: "Prototype night",
      date: addDays(week, 2),
      timeBand: "evening",
      org: "Fundy Studio",
      postedBy: "Devon",
      checkedBeforePublish: true,
    }),
  ];
}
