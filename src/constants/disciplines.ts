import type { Discipline } from "../../convex/disciplines";

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  pushups: "Push-ups",
  squats: "Squats",
  pullups: "Pull-ups",
  situps: "Sit-ups",
  burpees: "Burpees",
};

export const DISCIPLINE_LIST = Object.keys(DISCIPLINE_LABELS) as Discipline[];
