import type { TradeReview } from "./tradeReview";

export interface ExecutionMemorySummary {
  bestEntryType: string;
  worstEntryType: string;
  gapFailureWarning: boolean;
  lesson: string;
}

export function summarizeExecutionMemory(reviews: TradeReview[]): ExecutionMemorySummary {
  const failures = reviews.filter((review) => !review.worked);

  return {
    bestEntryType: "pullback efter första volymbekräftelse",
    worstEntryType: "sen chasing efter gap",
    gapFailureWarning: failures.some((review) =>
      review.lessons.some((lesson) => lesson.toLowerCase().includes("sen"))
    ),
    lesson:
      failures.length > 0
        ? "Undvik sena entries när crowding redan ökar."
        : "Bekräftade pullbacks fungerar bäst i nuvarande mock-minne.",
  };
}
