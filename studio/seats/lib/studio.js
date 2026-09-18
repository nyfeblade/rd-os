"use strict";

const fs = require("fs");
const path = require("path");
const {
  SEAT_IDS,
  BOT_SEAT_IDS,
  FORBIDDEN_DESTINATIONS,
  PRODUCT_LOCK,
  DUMP_SCHEMA,
  LEGAL_CHANNEL,
  STUDIO_PANES,
  IN_STUDIO_ONLY_LABEL,
  CONNECT_ACK,
  reject,
  ok,
  seatKindOf,
  seatLabelOf,
  isSeatId,
  isBotSeat,
  isRoomKind,
  isInStudioPresence,
} = require("./codes");
const { classifyDestination, channelReject } = require("./classify");

const STATE_FILE = "state.json";

function nowIso(clock) {
  return (clock && typeof clock.now === "function" ? new Date(clock.now()) : new Date()).toISOString();
}

function emptySeat(id) {
  return {
    id,
    kind: seatKindOf(id),
    label: seatLabelOf(id),
    presence: "offline",
    cutover: "unattached",
    connected_at: null,
    last_seen_at: null,
  };
}

function seedRooms(clock) {
  const createdAt = nowIso(clock);
  return [
    {
      id: "room:bots",
      title: "Bots",
      kind: "bot_bot",
      member_seat_ids: BOT_SEAT_IDS.slice(),
      created_at: createdAt,
    },
    {
      id: "room:studio",
      title: "Studio",
      kind: "studio_all",
      member_seat_ids: SEAT_IDS.slice(),
      created_at: createdAt,
    },
    {
      id: "room:chat",
      title: "Chat",
      kind: "human_bot",
      member_seat_ids: SEAT_IDS.slice(),
      created_at: createdAt,
    },
  ];
}

function seedState(clock) {
  return {
    seats: Object.fromEntries(SEAT_IDS.map((id) => [id, emptySeat(id)])),
    rooms: Object.fromEntries(seedRooms(clock).map((room) => [room.id, room])),
    messages: [],
    next_message: 1,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function looksLikeLukeRoom(id, title) {
  const text = `${id} ${title}`.toLowerCase();
  return /\bluke\b/.test(text) || text.includes("1:1") || text.includes("1to1");
}

function loadState(home, clock) {
  if (!home) {
    return seedState(clock);
  }
  const file = path.join(home, STATE_FILE);
  if (!fs.existsSync(file)) {
    const seeded = seedState(clock);
    persistState(home, seeded);
    return seeded;
  }
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!parsed || typeof parsed !== "object" || !parsed.seats || !parsed.rooms) {
    return seedState(clock);
  }
  return normalizeState(parsed);
}

function normalizePresence(state) {
  if (state === "connected") {
    return "online";
  }
  if (state === "disconnected") {
    return "offline";
  }
  return state;
}

function normalizeState(state) {
  for (const id of SEAT_IDS) {
    if (state.seats[id]) {
      state.seats[id].presence = normalizePresence(state.seats[id].presence);
    }
  }
  if (state.rooms["room:floor"] && !state.rooms["room:studio"]) {
    const room = state.rooms["room:floor"];
    room.id = "room:studio";
    room.title = room.title === "Studio floor" ? "Studio" : room.title;
    state.rooms["room:studio"] = room;
    delete state.rooms["room:floor"];
    for (const msg of state.messages) {
      if (msg.room_id === "room:floor") {
        msg.room_id = "room:studio";
      }
    }
  }
  if (state.rooms["room:desk"] && !state.rooms["room:chat"]) {
    const room = state.rooms["room:desk"];
    room.id = "room:chat";
    room.title = room.title === "Desk" ? "Chat" : room.title;
    state.rooms["room:chat"] = room;
    delete state.rooms["room:desk"];
    for (const msg of state.messages) {
      if (msg.room_id === "room:desk") {
        msg.room_id = "room:chat";
      }
    }
  }
  if (state.rooms["room:bots"] && state.rooms["room:bots"].title === "Bot sync") {
    state.rooms["room:bots"].title = "Bots";
  }
  return state;
}

function persistState(home, state) {
  if (!home) {
    return;
  }
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(path.join(home, STATE_FILE), `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function publicSeat(seat) {
  const row = clone(seat);
  row.in_studio_only = seat.cutover === "attached";
  return row;
}

function listSeats(state) {
  return SEAT_IDS.map((id) => publicSeat(state.seats[id]));
}

function onlineCount(state) {
  return SEAT_IDS.filter((id) => state.seats[id].presence === "online").length;
}

function chatHints() {
  return {
    pane: "Chat",
    pane_role: "seats / rooms",
    trio: STUDIO_PANES.slice(),
    in_studio_only_label: IN_STUDIO_ONLY_LABEL,
    connect_ack: CONNECT_ACK,
    composer_placeholder: "Message {seat}…",
    chrome: "not-owned",
  };
}

function listRooms(state) {
  return Object.keys(state.rooms)
    .sort()
    .map((id) => clone(state.rooms[id]));
}

function listMessages(state, roomId) {
  const rows = roomId
    ? state.messages.filter((row) => row.room_id === roomId)
    : state.messages.slice();
  return rows.map((row) => clone(row));
}

function attachedIds(state) {
  return SEAT_IDS.filter((id) => state.seats[id].cutover === "attached");
}

function buildDump(state) {
  return {
    schema: DUMP_SCHEMA,
    product_lock: PRODUCT_LOCK,
    seats: listSeats(state),
    rooms: listRooms(state),
    messages: listMessages(state),
    cutover: {
      protocol: "hard",
      product_lock: PRODUCT_LOCK,
      attached_seat_ids: attachedIds(state),
      legal_channel: LEGAL_CHANNEL,
      forbidden_destinations: FORBIDDEN_DESTINATIONS.slice(),
      connect_ack: CONNECT_ACK,
      in_studio_only_label: IN_STUDIO_ONLY_LABEL,
    },
    chat: chatHints(),
    online_count: onlineCount(state),
  };
}

function createStudioSeats(options) {
  const opts = options || {};
  const home = opts.home || null;
  const clock = opts.clock || null;
  const state = loadState(home, clock);

  function save() {
    persistState(home, state);
  }

  function getSeat(id) {
    if (!isSeatId(id)) {
      return null;
    }
    return state.seats[id];
  }

  function touch(seat, inStudio) {
    const ts = nowIso(clock);
    seat.last_seen_at = ts;
    if (inStudio) {
      if (seat.presence !== "away") {
        seat.presence = "online";
      }
      if (!seat.connected_at) {
        seat.connected_at = ts;
      }
    }
  }

  function attachSeat(id) {
    const seat = getSeat(id);
    if (!seat) {
      return reject("UNKNOWN_SEAT", `unknown seat: ${id}`);
    }
    seat.cutover = "attached";
    save();
    return ok({ seat: publicSeat(seat) });
  }

  function connectSeat(id) {
    const seat = getSeat(id);
    if (!seat) {
      return reject("UNKNOWN_SEAT", `unknown seat: ${id}`);
    }
    seat.presence = "online";
    touch(seat, true);
    // Hard cutover: an online seat is attached. No online-but-still-external state.
    if (isBotSeat(id) || seat.cutover === "unattached") {
      seat.cutover = "attached";
    }
    save();
    return ok({
      seat: publicSeat(seat),
      ack: CONNECT_ACK,
      in_studio_only: true,
    });
  }

  function disconnectSeat(id) {
    const seat = getSeat(id);
    if (!seat) {
      return reject("UNKNOWN_SEAT", `unknown seat: ${id}`);
    }
    seat.presence = "offline";
    seat.connected_at = null;
    save();
    return ok({ seat: publicSeat(seat) });
  }

  function setAway(id) {
    const seat = getSeat(id);
    if (!seat) {
      return reject("UNKNOWN_SEAT", `unknown seat: ${id}`);
    }
    if (!isInStudioPresence(seat.presence)) {
      return reject("SEAT_DISCONNECTED", `seat ${id} is offline; connect before away`);
    }
    seat.presence = "away";
    save();
    return ok({ seat: publicSeat(seat) });
  }

  function detachSeat(id) {
    const seat = getSeat(id);
    if (!seat) {
      return reject("UNKNOWN_SEAT", `unknown seat: ${id}`);
    }
    if (isBotSeat(id)) {
      return reject(
        "CUTOVER_LOCKED",
        `hard cutover is one-way for bots (seat=${id}); go offline to leave the Chat list as disconnected`
      );
    }
    seat.cutover = "unattached";
    save();
    return ok({ seat: publicSeat(seat) });
  }

  function createRoom(payload) {
    const body = payload || {};
    const rawId = (body.id || "").toString().trim();
    const title = (body.title || "").toString().trim();
    const kind = body.kind;
    if (!rawId || !title) {
      return reject("BAD_DESTINATION", "rooms.create requires id and title");
    }
    if (looksLikeLukeRoom(rawId, title)) {
      return reject("LUKE_1TO1_FORBIDDEN", "rooms cannot alias Luke/1:1");
    }
    if (!isRoomKind(kind)) {
      return reject("UNKNOWN_ROOM_KIND", `rooms.create requires kind bot_bot|human_bot|studio_all`);
    }
    const id = rawId.startsWith("room:") ? rawId : `room:${rawId}`;
    if (state.rooms[id]) {
      return ok({ room: clone(state.rooms[id]) });
    }
    const members = Array.isArray(body.member_seat_ids)
      ? body.member_seat_ids.filter(isSeatId)
      : kind === "bot_bot"
        ? BOT_SEAT_IDS.slice()
        : SEAT_IDS.slice();
    const room = {
      id,
      title,
      kind,
      member_seat_ids: members,
      created_at: nowIso(clock),
    };
    state.rooms[id] = room;
    save();
    return ok({ room: clone(room) });
  }

  function requireSpeaker(from) {
    const seat = state.seats[from];
    if (!isInStudioPresence(seat.presence)) {
      return reject("SEAT_DISCONNECTED", `seat ${from} is offline; no speech`);
    }
    if (isBotSeat(from) && seat.cutover !== "attached") {
      return reject("CUTOVER_REQUIRED", `bot ${from} must cutover.attach before in-studio speech`);
    }
    return null;
  }

  function emit(payload) {
    const body = payload || {};
    const from = body.from || body.seat || body.from_seat;
    const dest = body.dest != null ? body.dest : body.room_id != null ? { room_id: body.room_id } : body.to;
    const text = body.body == null ? "" : String(body.body);

    const classified = classifyDestination(dest);
    const blocked = channelReject(classified);
    if (blocked) {
      return blocked;
    }
    if (!classified.room_id) {
      return reject("BAD_DESTINATION", "studio_room emit requires a room id");
    }
    if (!isSeatId(from)) {
      return reject("UNKNOWN_SEAT", `unknown seat: ${from}`);
    }

    const gated = requireSpeaker(from);
    if (gated) {
      return gated;
    }

    const room = state.rooms[classified.room_id];
    if (!room) {
      return reject("ROOM_NOT_FOUND", `no studio room: ${classified.room_id}`);
    }
    if (!room.member_seat_ids.includes(from)) {
      return reject("SEAT_NOT_MEMBER", `seat ${from} is not a member of ${room.id}`);
    }

    const message = {
      id: `msg:${state.next_message++}`,
      room_id: room.id,
      from_seat: from,
      body: text,
      created_at: nowIso(clock),
    };
    state.messages.push(message);
    touch(state.seats[from], true);
    save();
    return ok({ message: clone(message), room: clone(room) });
  }

  function canSpeak(from, dest) {
    const result = emitPreview(from, dest);
    return result.ok;
  }

  function emitPreview(from, dest) {
    const classified = classifyDestination(dest);
    const blocked = channelReject(classified);
    if (blocked) {
      return blocked;
    }
    if (!isSeatId(from)) {
      return reject("UNKNOWN_SEAT", `unknown seat: ${from}`);
    }
    const gated = requireSpeaker(from);
    if (gated) {
      return gated;
    }
    if (!classified.room_id || !state.rooms[classified.room_id]) {
      return reject("ROOM_NOT_FOUND", `no studio room: ${classified.room_id}`);
    }
    if (!state.rooms[classified.room_id].member_seat_ids.includes(from)) {
      return reject("SEAT_NOT_MEMBER", `seat ${from} is not a member of ${classified.room_id}`);
    }
    return ok({ channel: classified.channel, room_id: classified.room_id });
  }

  function connectorSpeak(payload) {
    const body = payload || {};
    return emit({
      from: body.from || body.seat,
      dest: body.dest != null ? body.dest : body.to,
      body: body.body,
    });
  }

  return {
    seats: {
      ids: SEAT_IDS.slice(),
      list() {
        return ok({ seats: listSeats(state) });
      },
      get(id) {
        const seat = getSeat(id);
        if (!seat) {
          return reject("UNKNOWN_SEAT", `unknown seat: ${id}`);
        }
        return ok({ seat: publicSeat(seat) });
      },
      connect: connectSeat,
      disconnect: disconnectSeat,
    },
    presence: {
      list() {
        return ok({
          presence: listSeats(state).map((seat) => ({
            id: seat.id,
            state: seat.presence,
            in_studio_only: seat.in_studio_only,
            last_seen_at: seat.last_seen_at,
          })),
          online_count: onlineCount(state),
        });
      },
      get(id) {
        const seat = getSeat(id);
        if (!seat) {
          return reject("UNKNOWN_SEAT", `unknown seat: ${id}`);
        }
        const row = publicSeat(seat);
        return ok({
          id: row.id,
          state: row.presence,
          in_studio_only: row.in_studio_only,
          last_seen_at: row.last_seen_at,
        });
      },
      connect: connectSeat,
      disconnect: disconnectSeat,
      away: setAway,
    },
    rooms: {
      list() {
        return ok({ rooms: listRooms(state) });
      },
      get(id) {
        const roomId = id && String(id).startsWith("room:") ? id : `room:${id}`;
        const room = state.rooms[roomId];
        if (!room) {
          return reject("ROOM_NOT_FOUND", `no studio room: ${roomId}`);
        }
        return ok({ room: clone(room), messages: listMessages(state, roomId) });
      },
      create: createRoom,
      messages(roomId) {
        const roomKey = roomId && String(roomId).startsWith("room:") ? roomId : `room:${roomId}`;
        if (roomId && !state.rooms[roomKey]) {
          return reject("ROOM_NOT_FOUND", `no studio room: ${roomKey}`);
        }
        return ok({ messages: listMessages(state, roomId ? roomKey : null) });
      },
      emit,
    },
    cutover: {
      attach: attachSeat,
      detach: detachSeat,
      status(id) {
        if (id) {
          const seat = getSeat(id);
          if (!seat) {
            return reject("UNKNOWN_SEAT", `unknown seat: ${id}`);
          }
          return ok({
            seat: publicSeat(seat),
            protocol: "hard",
            product_lock: PRODUCT_LOCK,
            legal_channel: LEGAL_CHANNEL,
            connect_ack: CONNECT_ACK,
            in_studio_only_label: IN_STUDIO_ONLY_LABEL,
          });
        }
        return ok({
          protocol: "hard",
          product_lock: PRODUCT_LOCK,
          attached_seat_ids: attachedIds(state),
          legal_channel: LEGAL_CHANNEL,
          forbidden_destinations: FORBIDDEN_DESTINATIONS.slice(),
          connect_ack: CONNECT_ACK,
          in_studio_only_label: IN_STUDIO_ONLY_LABEL,
        });
      },
    },
    connectors: {
      /**
       * Stub every studio connector must call instead of opening Luke/1:1 or group DMs.
       * Enforcement lives here so a later GitHub/shell pane cannot add an external spam path.
       */
      speak: connectorSpeak,
      allowedDestinations() {
        return ok({ channels: [LEGAL_CHANNEL], prefix: "room:" });
      },
    },
    emit,
    canSpeak,
    classifyDestination,
    dump() {
      return ok(buildDump(state));
    },
  };
}

function buildDemoDump() {
  const studio = createStudioSeats({
    clock: {
      now() {
        return Date.parse("2026-09-18T12:00:00.000Z");
      },
    },
  });
  studio.seats.connect("human");
  studio.seats.connect("grok");
  studio.seats.connect("claude");
  studio.emit({ from: "grok", dest: "room:bots", body: "in-studio-only — Chat thread stays here" });
  studio.emit({ from: "claude", dest: "room:bots", body: "ack — no Luke/1:1 path from this seat" });
  return studio.dump().data;
}

module.exports = {
  createStudioSeats,
  buildDemoDump,
  buildDump,
  seedState,
};
