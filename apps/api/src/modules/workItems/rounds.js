/**
 * Records a submission on the step's rounds without losing an earlier submit time.
 * A round that was already submitted keeps its time, and this submission starts a new round.
 * Time since a decision on that round is rework. With no decision, the owner is only
 * sending another version, so the new round starts now and adds no work time.
 */
export function recordRoundSubmission(workItem, submittedAt) {
  if (!workItem.rounds || workItem.rounds.length === 0) {
    workItem.rounds = [
      {
        roundNumber: 1,
        startedAt: workItem.startedAt || submittedAt,
        submittedAt,
        intervals: [],
      },
    ];
    return;
  }

  const current = workItem.rounds[workItem.rounds.length - 1];
  if (!current.submittedAt) {
    current.submittedAt = submittedAt;
    return;
  }

  workItem.rounds.push({
    roundNumber: workItem.rounds.length + 1,
    startedAt: current.decisionAt || submittedAt,
    submittedAt,
    intervals: [],
  });
}
