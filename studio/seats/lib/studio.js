"use strict";

const fs = require("fs");
const path = require("path");
const {
  DEFAULT_SEAT_IDS,
  DEFAULT_BOT_SEAT_IDS,
  FORBIDDEN_DESTINATIONS,
  PRODUCT_LOCK,
  DUMP_SCHEMA,
  LEGAL_CHANNEL,
  DEFAULT_CHROME,
  CODE_MODE,
  ENG_DOMAIN,
  ENG_PURPOSE,
  ENG_SURFACES,
  IN_STUDIO_ONLY_LABEL,
  CONNECT_ACK,
  reject,
  ok,
  agentFromKind,
  seatKindOf,
  seatLabelOf,
  isValidSeatSlug,
  isReservedSeatId,
  isRoomKind,
  isInStudioPresence,
} = require("./codes");
const { classifyDestination, channelReject } = require("./classify");

const STATE_FILE = "state.json";

function nowIso(clock) {
  return (clock && typeof clock.now === "function" ? new Date(clock.now()) : new Date()).toISOString();
}

function emptySeat(id, kind, label) {
  const resolvedKind = kind || seatKindOf(id);
  return {
    id,
    kind: resolvedKind,
    label: label || seatLabelOf(id),
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
      member_seat_ids: DEFAULT_BOT_SEAT_IDS.slice(),
      created_at: createdAt,
    },
    {
      id: "room:studio",
      title: "Studio",
      kind: "studio_all",
      member_seat_ids: DEFAULT_SEAT_IDS.slice(),
      created_at: createdAt,
    },
    {
      id: "room:chat",
      title: "Agents",
      kind: "human_bot",
      member_seat_ids: DEFAULT_SEAT_IDS.slice(),
      created_at: createdAt,
    },
  ];
}

function seedState(clock) {
  return {
    seats: Object.fromEntries(DEFAULT_SEAT_IDS.map((id) => [id, emptySeat(id)])),
    rooms: Object.fromEntries(seedRooms(clock).map((room) => [room.id, room])),
    messages: [],
    next_message: 1,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function looksLikeOperatorRoom(id, title) {
  const text = `${id} ${title}`.toLowerCase();
  return (
    /\b(luke|owner|operator)\b/.test(text) ||
    text.includes("1:1") ||
    text.includes("1to1")
  );
}

function looksLikeLifeOsRoom(id, title) {
  const text = `${id} ${title}`.toLowerCase();
  return /\b(life-?os|journal|personal|family|calendar)\b/.test(text);
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
  for (const id of Object.keys(state.seats)) {
    state.seats[id].presence = normalizePresence(state.seats[id].presence);
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
  if (state.rooms["room:chat"] && state.rooms["room:chat"].title === "Chat") {
    state.rooms["room:chat"].title = "Agents";
  }
  if (state.rooms["room:desk"] && !state.rooms["room:chat"]) {
    const room = state.rooms["room:desk"];
    room.id = "room:chat";
    room.title = room.title === "Desk" || room.title === "Chat" ? "Agents" : room.title;
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
  row.surface = "eng";
  row.agent = agentFromKind(seat.kind);
  return row;
}

function publicRoom(room) {
  const row = clone(room);
  row.surface = "eng";
  return row;
}

function engSurfaceLock() {
  return {
    domain: ENG_DOMAIN,
    life_os: false,
    purpose: ENG_PURPOSE,
    surfaces: ENG_SURFACES.slice(),
    multi_provider: true,
    luke_fleet_only: false,
  };
}

function northStar() {
  return {
    audience: "any_ai_developer_studio",
    providers: "multi",
    luke_fleet_only: false,
    stranger_usable: true,
  };
}

function rosterIds(state) {
  const extras = Object.keys(state.seats)
    .filter((id) => !DEFAULT_SEAT_IDS.includes(id))
    .sort();
  return DEFAULT_SEAT_IDS.filter((id) => state.seats[id]).concat(extras);
}

function botRosterIds(state) {
  return rosterIds(state).filter((id) => state.seats[id] && state.seats[id].kind === "bot");
}

function listSeats(state) {
  return rosterIds(state).map((id) => publicSeat(state.seats[id]));
}

function onlineCount(state) {
  return rosterIds(state).filter((id) => state.seats[id].presence === "online").length;
}

function layoutLock() {
  return {
    default_chrome: DEFAULT_CHROME.slice(),
    code: CODE_MODE,
    three_pane_always: false,
  };
}

function chatHints() {
  return {
    pane: "Chat",
    pane_role: "eng seats / rooms",
    sibling_default: "Board",
    default_chrome: DEFAULT_CHROME.slice(),
    code: CODE_MODE,
    three_pane_always: false,
    in_studio_only_label: IN_STUDIO_ONLY_LABEL,
    connect_ack: CONNECT_ACK,
    composer_placeholder: "Emit in-studio to {seat}",
    chrome: "not-owned",
  };
}

function listRooms(state) {
  return Object.keys(state.rooms)
    .sort()
    .map((id) => publicRoom(state.rooms[id]));
}

function listMessages(state, roomId) {
  const rows = roomId
    ? state.messages.filter((row) => row.room_id === roomId)
    : state.messages.slice();
  return rows.map((row) => clone(row));
}

function attachedIds(state) {
  return rosterIds(state).filter((id) => state.seats[id].cutover === "attached");
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
    layout: layoutLock(),
    eng: engSurfaceLock(),
    north_star: northStar(),
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
    return state.seats[id] || null;
  }

  function isBot(id) {
    return Boolean(state.seats[id] && state.seats[id].kind === "bot");
  }

  function addSeatToSeedRooms(id, kind) {
    const bots = state.rooms["room:bots"];
    const studioRoom = state.rooms["room:studio"];
    const agents = state.rooms["room:chat"];
    if (kind === "bot" && bots && !bots.member_seat_ids.includes(id)) {
      bots.member_seat_ids.push(id);
    }
    if (studioRoom && !studioRoom.member_seat_ids.includes(id)) {
      studioRoom.member_seat_ids.push(id);
    }
    if (agents && !agents.member_seat_ids.includes(id)) {
      agents.member_seat_ids.push(id);
    }
  }

  function registerSeat(payload) {
    const body = payload || {};
    const id = (body.id || "").toString().trim();
    const kind = body.kind;
    if (!isValidSeatSlug(id)) {
      return reject("BAD_DESTINATION", "seats.register requires slug id [a-z][a-z0-9_-]{0,31}");
    }
    if (isReservedSeatId(id) || looksLikeOperatorRoom(id, body.label || "")) {
      return reject("OPERATOR_1TO1_FORBIDDEN", "seat id cannot be an operator/1:1 alias");
    }
    if (looksLikeLifeOsRoom(id, body.label || "")) {
      return reject("EXTERNAL_CHANNEL_FORBIDDEN", "seat id cannot be a life-OS alias");
    }
    if (kind !== "bot" && kind !== "human") {
      return reject("UNKNOWN_SEAT", "seats.register requires kind bot|human");
    }
    if (state.seats[id]) {
      return ok({ seat: publicSeat(state.seats[id]) });
    }
    state.seats[id] = emptySeat(id, kind, body.label ? String(body.label).trim() : undefined);
    addSeatToSeedRooms(id, kind);
    save();
    return ok({ seat: publicSeat(state.seats[id]) });
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
    if (isBot(id) || seat.cutover === "unattached") {
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
    if (isBot(id)) {
      return reject(
        "CUTOVER_LOCKED",
        `hard cutover is one-way for bots (seat=${id}); go offline to leave the eng roster`
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
    if (looksLikeOperatorRoom(rawId, title)) {
      return reject("OPERATOR_1TO1_FORBIDDEN", "rooms cannot alias operator/1:1");
    }
    if (looksLikeLifeOsRoom(rawId, title)) {
      return reject("EXTERNAL_CHANNEL_FORBIDDEN", "rooms are eng surfaces, not life-OS");
    }
    if (!isRoomKind(kind)) {
      return reject("UNKNOWN_ROOM_KIND", `rooms.create requires kind bot_bot|human_bot|studio_all`);
    }
    const id = rawId.startsWith("room:") ? rawId : `room:${rawId}`;
    if (state.rooms[id]) {
      return ok({ room: publicRoom(state.rooms[id]) });
    }
    const members = Array.isArray(body.member_seat_ids)
      ? body.member_seat_ids.filter((member) => Boolean(state.seats[member]))
      : kind === "bot_bot"
        ? botRosterIds(state)
        : rosterIds(state);
    const room = {
      id,
      title,
      kind,
      member_seat_ids: members,
      created_at: nowIso(clock),
    };
    state.rooms[id] = room;
    save();
    return ok({ room: publicRoom(room) });
  }

  function requireSpeaker(from) {
    const seat = state.seats[from];
    if (!isInStudioPresence(seat.presence)) {
      return reject("SEAT_DISCONNECTED", `seat ${from} is offline; no speech`);
    }
    if (isBot(from) && seat.cutover !== "attached") {
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
    if (!state.seats[from]) {
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
    return ok({ message: clone(message), room: publicRoom(room) });
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
    if (!state.seats[from]) {
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
      ids() {
        return rosterIds(state);
      },
      register: registerSeat,
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
        return ok({ room: publicRoom(room), messages: listMessages(state, roomId) });
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
  studio.emit({ from: "grok", dest: "room:bots", body: "bot↔bot eng surface — in-studio only" });
  studio.emit({ from: "claude", dest: "room:bots", body: "ack — no Luke/1:1 or life-OS path" });
  return studio.dump().data;
}

module.exports = {
  createStudioSeats,
  buildDemoDump,
  buildDump,
  seedState,
};
