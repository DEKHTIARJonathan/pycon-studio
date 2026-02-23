import { beforeEach, describe, expect, it } from "vitest";
import { useRadioStore } from "../radio-store";

describe("radio-store", () => {
  beforeEach(() => {
    useRadioStore.setState(useRadioStore.getInitialState());
  });

  it("tracks pending station switches separately from the active station", () => {
    useRadioStore.getState().startStation("station-a");
    useRadioStore.getState().setPendingStation("station-b");

    expect(useRadioStore.getState().activeStationId).toBe("station-a");
    expect(useRadioStore.getState().pendingStationId).toBe("station-b");
  });

  it("promotes the pending station when the next track is ready", () => {
    useRadioStore.getState().startStation("station-a");
    useRadioStore.getState().setPendingStation("station-b");
    useRadioStore.getState().promotePendingStation();

    expect(useRadioStore.getState().activeStationId).toBe("station-b");
    expect(useRadioStore.getState().pendingStationId).toBeNull();
  });

  it("clears pending station on stop", () => {
    useRadioStore.getState().startStation("station-a");
    useRadioStore.getState().setPendingStation("station-b");
    useRadioStore.getState().stopStation();

    expect(useRadioStore.getState().activeStationId).toBeNull();
    expect(useRadioStore.getState().pendingStationId).toBeNull();
  });
});
