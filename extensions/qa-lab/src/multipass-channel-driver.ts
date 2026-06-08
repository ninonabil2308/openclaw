// Qa Lab plugin module models SDK-backed Multipass channel-driver metadata.

export type QaChannelDriverId = "multipass";
export type QaMultipassChannelId = "telegram";

export type QaMultipassChannelDriverSelection = {
  channel: QaMultipassChannelId;
  channelDriver: QaChannelDriverId;
  channelDriverId: "telegram-local-v1";
  channelLive: false;
  capabilityMatrixPath: typeof QA_MULTIPASS_CHANNEL_CAPABILITY_MATRIX_PATH;
};

export type QaMultipassChannelCapabilityStatus = "covered" | "planned";

export type QaMultipassChannelCapabilityRow = {
  capabilityId: string;
  channel: string;
  driverId?: string;
  notes: string;
  status: QaMultipassChannelCapabilityStatus;
};

export type QaMultipassChannelCapabilityMatrix = {
  version: 1;
  source: "openclaw/multipass";
  channelDriver: QaChannelDriverId;
  selectedChannel: QaMultipassChannelId;
  rows: readonly QaMultipassChannelCapabilityRow[];
};

export const QA_MULTIPASS_CHANNEL_CAPABILITY_MATRIX_PATH =
  "multipass-channel-capability-matrix.json";

const SUPPORTED_MULTIPASS_CHANNELS = [
  "telegram",
] as const satisfies readonly QaMultipassChannelId[];

export function normalizeQaChannelDriverId(input?: string | null): QaChannelDriverId | null {
  const normalized = input?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized === "multipass") {
    return "multipass";
  }
  throw new Error(`--channel-driver must be multipass, got "${input}".`);
}

export function normalizeQaMultipassChannel(input?: string | null): QaMultipassChannelId {
  const normalized = input?.trim().toLowerCase();
  if (!normalized) {
    throw new Error("--channel is required when --channel-driver multipass is set.");
  }
  if (SUPPORTED_MULTIPASS_CHANNELS.includes(normalized as QaMultipassChannelId)) {
    return normalized as QaMultipassChannelId;
  }
  throw new Error(
    `--channel must be one of ${SUPPORTED_MULTIPASS_CHANNELS.join(", ")} for --channel-driver multipass, got "${input}".`,
  );
}

export function resolveQaMultipassChannelDriverSelection(params: {
  channel?: string | null;
  channelDriver?: string | null;
}): QaMultipassChannelDriverSelection | null {
  const channelDriver = normalizeQaChannelDriverId(params.channelDriver);
  if (!channelDriver) {
    if (params.channel?.trim()) {
      throw new Error("--channel requires --channel-driver multipass.");
    }
    return null;
  }

  const channel = normalizeQaMultipassChannel(params.channel);
  return {
    channel,
    channelDriver,
    channelDriverId: "telegram-local-v1",
    channelLive: false,
    capabilityMatrixPath: QA_MULTIPASS_CHANNEL_CAPABILITY_MATRIX_PATH,
  };
}

export function buildQaMultipassChannelCapabilityMatrix(
  selection: QaMultipassChannelDriverSelection,
): QaMultipassChannelCapabilityMatrix {
  return {
    version: 1,
    source: "openclaw/multipass",
    channelDriver: selection.channelDriver,
    selectedChannel: selection.channel,
    rows: [
      {
        capabilityId: "telegram.dm.text",
        channel: "telegram",
        driverId: selection.channelDriverId,
        notes: "Direct-message text turn with source-visible transcript assertions.",
        status: "covered",
      },
      {
        capabilityId: "telegram.group.mention",
        channel: "telegram",
        driverId: selection.channelDriverId,
        notes: "Group mention semantics for routing and reply isolation.",
        status: "covered",
      },
      {
        capabilityId: "telegram.group.topic",
        channel: "telegram",
        driverId: selection.channelDriverId,
        notes: "Forum topic/thread identity for group conversations.",
        status: "covered",
      },
      {
        capabilityId: "telegram.action.inline_button",
        channel: "telegram",
        driverId: selection.channelDriverId,
        notes: "Native approval/action event shape.",
        status: "covered",
      },
      {
        capabilityId: "telegram.media.metadata",
        channel: "telegram",
        driverId: selection.channelDriverId,
        notes: "Media/location metadata placeholder coverage.",
        status: "covered",
      },
      {
        capabilityId: "telegram.connection.reconnect",
        channel: "telegram",
        driverId: selection.channelDriverId,
        notes: "Reconnect marker for future Gateway recovery assertions.",
        status: "covered",
      },
      {
        capabilityId: "discord.dm.text",
        channel: "discord",
        notes: "Planned local Discord upstream driver.",
        status: "planned",
      },
      {
        capabilityId: "slack.dm.text",
        channel: "slack",
        notes: "Planned local Slack upstream driver.",
        status: "planned",
      },
      {
        capabilityId: "whatsapp.dm.text",
        channel: "whatsapp",
        notes: "Planned local WhatsApp upstream driver.",
        status: "planned",
      },
    ],
  };
}

export function createQaMultipassChannelReportNotes(
  selection: QaMultipassChannelDriverSelection | null | undefined,
): string[] {
  if (!selection) {
    return [];
  }

  return [
    `Channel driver: ${selection.channelDriver} (${selection.channelDriverId}) for ${selection.channel}, channel_live=false.`,
    `Channel capability matrix: ${selection.capabilityMatrixPath}.`,
    "This is the openclaw/multipass messaging SDK driver path; it is independent of the Canonical Multipass VM runner.",
  ];
}
