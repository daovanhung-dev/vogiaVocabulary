export interface LearningUpdateInput {
  mastery: number;
  stability: number;
  streak: number;
  correct: boolean;
  responseTimeMs: number;
}

export interface LearningUpdate {
  mastery: number;
  stability: number;
  streak: number;
  nextReviewAt: Date;
}

export function calculateLearningUpdate(input: LearningUpdateInput, now = new Date()): LearningUpdate {
  const fast = input.responseTimeMs > 0 && input.responseTimeMs <= 5000;
  if (input.correct) {
    const gain = fast ? 0.08 : 0.04;
    const mastery = Math.min(1, Math.max(0, input.mastery + gain));
    const stability = Math.min(365, Math.max(1, input.stability * 1.25));
    const days = Math.max(1, Math.round(stability));
    return {
      mastery,
      stability,
      streak: input.streak + 1,
      nextReviewAt: new Date(now.getTime() + days * 24 * 60 * 60 * 1000),
    };
  }

  const mastery = Math.max(0, input.mastery - 0.1);
  const stability = Math.max(1, input.stability * 0.7);
  return {
    mastery,
    stability,
    streak: 0,
    nextReviewAt: new Date(now.getTime() + 10 * 60 * 1000),
  };
}
