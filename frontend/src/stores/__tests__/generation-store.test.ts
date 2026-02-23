import { describe, it, expect, beforeEach } from "vitest";
import { useGenerationStore } from "../generation-store";

describe("generation-store", () => {
  beforeEach(() => {
    useGenerationStore.setState(useGenerationStore.getInitialState());
  });

  it("has correct initial state", () => {
    const state = useGenerationStore.getState();
    expect(state.activeMode).toBe("Custom");
    expect(state.isGenerating).toBe(false);
    expect(state.activeJobs).toEqual([]);
    expect(state.autoGenEnabled).toBe(false);
    expect(state.autoSaveEnabled).toBe(false);
    expect(state.autoGenCount).toBe(0);
    expect(state.autoGenMaxRuns).toBe(0);
  });

  it("setActiveMode updates mode", () => {
    useGenerationStore.getState().setActiveMode("Simple");
    expect(useGenerationStore.getState().activeMode).toBe("Simple");
  });

  it("updateCustomForm preserves other fields (immutability)", () => {
    const original = useGenerationStore.getState().customForm;
    useGenerationStore.getState().updateCustomForm({ caption: "new caption" });

    const updated = useGenerationStore.getState().customForm;
    expect(updated.caption).toBe("new caption");
    expect(updated.lyrics).toBe(original.lyrics);
    // Verify original reference wasn't mutated
    expect(original.caption).toBe("");
  });

  it("addJob prepends to activeJobs", () => {
    const job1 = {
      jobId: "job-1",
      status: "queued" as const,
      progress: 0,
      stage: "",
      results: [],
      error: null,
      historyId: null,
      savedVariants: [],
      generatedTitle: null,
    };
    const job2 = { ...job1, jobId: "job-2" };

    useGenerationStore.getState().addJob(job1);
    useGenerationStore.getState().addJob(job2);

    const jobs = useGenerationStore.getState().activeJobs;
    expect(jobs).toHaveLength(2);
    expect(jobs[0].jobId).toBe("job-2");
    expect(jobs[1].jobId).toBe("job-1");
  });

  it("updateJob updates only matching job", () => {
    const job1 = {
      jobId: "job-1",
      status: "queued" as const,
      progress: 0,
      stage: "",
      results: [],
      error: null,
      historyId: null,
      savedVariants: [],
      generatedTitle: null,
    };
    const job2 = { ...job1, jobId: "job-2" };

    useGenerationStore.getState().addJob(job1);
    useGenerationStore.getState().addJob(job2);
    useGenerationStore.getState().updateJob("job-1", { status: "running", progress: 0.5 });

    const jobs = useGenerationStore.getState().activeJobs;
    const updated = jobs.find((j) => j.jobId === "job-1");
    const unchanged = jobs.find((j) => j.jobId === "job-2");
    expect(updated?.status).toBe("running");
    expect(updated?.progress).toBe(0.5);
    expect(unchanged?.status).toBe("queued");
  });

  it("auto-gen state actions work correctly", () => {
    const store = useGenerationStore.getState();

    store.setAutoGenEnabled(true);
    expect(useGenerationStore.getState().autoGenEnabled).toBe(true);

    store.setAutoSaveEnabled(true);
    expect(useGenerationStore.getState().autoSaveEnabled).toBe(true);

    store.setAutoGenMaxRuns(5);
    expect(useGenerationStore.getState().autoGenMaxRuns).toBe(5);

    store.incrementAutoGenCount();
    store.incrementAutoGenCount();
    expect(useGenerationStore.getState().autoGenCount).toBe(2);

    store.resetAutoGenCount();
    expect(useGenerationStore.getState().autoGenCount).toBe(0);
  });
});
