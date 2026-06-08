// Qa Lab tests cover Multipass channel-driver metadata behavior.
import { describe, expect, it } from "vitest";
import {
  buildQaMultipassChannelCapabilityMatrix,
  resolveQaMultipassChannelDriverSelection,
} from "./multipass-channel-driver.js";

describe("multipass channel driver metadata", () => {
  it("returns null when no channel driver is selected", () => {
    expect(resolveQaMultipassChannelDriverSelection({})).toBeNull();
  });

  it("resolves the Telegram SDK-backed channel driver", () => {
    const selection = resolveQaMultipassChannelDriverSelection({
      channel: "telegram",
      channelDriver: "multipass",
    });

    expect(selection).toEqual({
      capabilityMatrixPath: "multipass-channel-capability-matrix.json",
      channel: "telegram",
      channelDriver: "multipass",
      channelDriverId: "telegram-local-v1",
      channelLive: false,
    });
    expect(buildQaMultipassChannelCapabilityMatrix(selection!)).toMatchObject({
      source: "openclaw/multipass",
      channelDriver: "multipass",
      selectedChannel: "telegram",
      rows: expect.arrayContaining([
        expect.objectContaining({
          capabilityId: "telegram.dm.text",
          channel: "telegram",
          driverId: "telegram-local-v1",
          status: "covered",
        }),
        expect.objectContaining({
          capabilityId: "slack.dm.text",
          channel: "slack",
          status: "planned",
        }),
      ]),
    });
  });

  it("requires a supported channel when the driver is selected", () => {
    expect(() => resolveQaMultipassChannelDriverSelection({ channelDriver: "multipass" })).toThrow(
      "--channel is required",
    );
    expect(() =>
      resolveQaMultipassChannelDriverSelection({
        channel: "slack",
        channelDriver: "multipass",
      }),
    ).toThrow("--channel must be one of telegram");
  });

  it("rejects channel identity without a channel driver", () => {
    expect(() => resolveQaMultipassChannelDriverSelection({ channel: "telegram" })).toThrow(
      "--channel requires --channel-driver multipass",
    );
  });
});
