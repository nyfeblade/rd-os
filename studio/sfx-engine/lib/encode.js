"use strict";

const crypto = require("crypto");

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function md5(buf) {
  return crypto.createHash("md5").update(buf).digest();
}

function clampSample(value) {
  const s = Math.max(-1, Math.min(1, value));
  return s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
}

function pcm16le(pcm) {
  const buf = Buffer.alloc(pcm.length * 2);
  for (let i = 0; i < pcm.length; i++) {
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, clampSample(pcm[i]))), i * 2);
  }
  return buf;
}

function encodeWav(pcm, sampleRate) {
  const data = pcm16le(pcm);
  const buf = Buffer.alloc(44 + data.length);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + data.length, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(data.length, 40);
  data.copy(buf, 44);
  return buf;
}

function crc8(bytes) {
  let crc = 0;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
    }
  }
  return crc;
}

function crc16(bytes) {
  let crc = 0;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i] << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x8005) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

class BitWriter {
  constructor() {
    this.bits = [];
  }

  write(value, width) {
    let v = value >>> 0;
    for (let i = width - 1; i >= 0; i -= 1) {
      this.bits.push((v >>> i) & 1);
    }
  }

  writeSigned(value, width) {
    const mask = (1 << width) - 1;
    this.write(value & mask, width);
  }

  toBuffer() {
    const out = Buffer.alloc(Math.ceil(this.bits.length / 8));
    for (let i = 0; i < this.bits.length; i += 1) {
      if (this.bits[i]) out[i >> 3] |= 1 << (7 - (i & 7));
    }
    return out;
  }
}

function encodeFlac(pcm, sampleRate) {
  const n = Math.max(1, pcm.length);
  const pcmLe = pcm16le(pcm);
  const block = Math.max(16, n);
  const stream = new BitWriter();
  stream.write(block, 16);
  stream.write(block, 16);
  stream.write(0, 24);
  stream.write(0, 24);
  stream.write(sampleRate, 20);
  stream.write(0, 3);
  stream.write(15, 5);
  stream.write(Math.floor(n / 0x100000000), 4);
  stream.write(n >>> 0, 32);
  const info = Buffer.concat([stream.toBuffer().subarray(0, 18), md5(pcmLe)]);

  const header = Buffer.alloc(8);
  header.write("fLaC", 0);
  header[4] = 0x80;
  header.writeUIntBE(34, 5, 3);

  const frame = new BitWriter();
  frame.write(0x3ffe, 14);
  frame.write(0, 1);
  frame.write(0, 1);
  frame.write(0x7, 4);
  frame.write(0x0, 4);
  frame.write(0x0, 4);
  frame.write(0x4, 3);
  frame.write(0, 1);
  frame.write(0, 8);
  frame.write(n - 1, 16);
  const headerBits = frame.toBuffer();
  const headerCrc = Buffer.from([crc8(headerBits)]);

  const sub = new BitWriter();
  sub.write(0, 1);
  sub.write(1, 6);
  sub.write(0, 1);
  for (let i = 0; i < n; i += 1) {
    sub.writeSigned(clampSample(pcm[i]), 16);
  }
  const body = Buffer.concat([headerBits, headerCrc, sub.toBuffer()]);
  const crc = Buffer.alloc(2);
  crc.writeUInt16BE(crc16(body), 0);
  return Buffer.concat([header, info, body, crc]);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function encodeZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data);
    const crc = crc32(data);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    locals.push(Buffer.concat([local, data]));

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centrals.push(central);
    offset += local.length + data.length;
  }

  const centralDir = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat(locals.concat([centralDir, eocd]));
}

function encodeAudio(pcm, sampleRate, format) {
  if (format === "flac") return encodeFlac(pcm, sampleRate);
  return encodeWav(pcm, sampleRate);
}

module.exports = {
  sha256,
  pcm16le,
  encodeWav,
  encodeFlac,
  encodeZip,
  encodeAudio,
  crc32,
};
