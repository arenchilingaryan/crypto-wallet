export type TimingStep = {
  label: string;

  ms: number;
};

export type TimingRun = {
  name: string;

  totalMs: number;

  steps: TimingStep[];
};

export type TimingReporter = {
  step(label: string): void;
};

const HISTORY_LIMIT = 10;

const history: TimingRun[] = [];

const listeners = new Set<(run: TimingRun) => void>();

export function startTimingRun(name: string) {
  const startedAt = Date.now();

  const steps: TimingStep[] = [];

  let previous = startedAt;

  let finished = false;

  return {
    step(label: string) {
      const now = Date.now();

      steps.push({ label, ms: now - previous });

      previous = now;
    },

    finish() {
      if (finished) {
        return null;
      }

      finished = true;

      const run: TimingRun = {
        name,
        totalMs: Date.now() - startedAt,
        steps,
      };

      history.push(run);

      if (history.length > HISTORY_LIMIT) {
        history.shift();
      }

      for (const listener of listeners) {
        listener(run);
      }

      return run;
    },
  };
}

export function subscribeToTimingRuns(listener: (run: TimingRun) => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getTimingHistory(): TimingRun[] {
  return [...history];
}

export function formatTimingRun(run: TimingRun): string {
  const seconds = (ms: number) => `${(ms / 1000).toFixed(2)}s`;

  const steps = run.steps
    .map((step) => `${step.label} ${seconds(step.ms)}`)
    .join(", ");

  return `${run.name} ${seconds(run.totalMs)} — ${steps}`;
}
