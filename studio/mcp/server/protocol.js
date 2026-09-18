"use strict";

function okResponse(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function errorResponse(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function encodeFramed(message) {
  const body = Buffer.from(`${JSON.stringify(message)}\n`, "utf8");
  const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "utf8");
  return Buffer.concat([header, body]);
}

function indexOfHeaderEnd(buffer) {
  const crlf = buffer.indexOf("\r\n\r\n");
  if (crlf >= 0) {
    return crlf;
  }
  return buffer.indexOf("\n\n");
}

function headerSkip(buffer, headerEnd) {
  if (buffer.slice(headerEnd, headerEnd + 4).toString("utf8") === "\r\n\r\n") {
    return 4;
  }
  return 2;
}

function createFrameParser(onMessage) {
  let buffer = Buffer.alloc(0);

  function push(chunk) {
    buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
    while (true) {
      const headerEnd = indexOfHeaderEnd(buffer);
      if (headerEnd < 0) {
        if (tryNewlineJson()) {
          continue;
        }
        return;
      }
      const header = buffer.slice(0, headerEnd).toString("utf8");
      const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
      if (!lengthMatch) {
        buffer = buffer.slice(headerEnd + headerSkip(buffer, headerEnd));
        continue;
      }
      const length = Number(lengthMatch[1]);
      const start = headerEnd + headerSkip(buffer, headerEnd);
      if (buffer.length < start + length) {
        return;
      }
      const body = buffer.slice(start, start + length).toString("utf8").trim();
      buffer = buffer.slice(start + length);
      if (body) {
        onMessage(JSON.parse(body));
      }
    }
  }

  function tryNewlineJson() {
    const nl = buffer.indexOf(0x0a);
    if (nl < 0) {
      return false;
    }
    const line = buffer.slice(0, nl).toString("utf8").replace(/\r$/, "").trim();
    if (!line.startsWith("{")) {
      return false;
    }
    try {
      const parsed = JSON.parse(line);
      buffer = buffer.slice(nl + 1);
      onMessage(parsed);
      return true;
    } catch (_err) {
      return false;
    }
  }

  return { push };
}

function attachStdio(server, stdin, stdout) {
  let chain = Promise.resolve();
  const parser = createFrameParser((message) => {
    chain = chain
      .then(async () => {
        const response = await server.handleMessage(message);
        if (response) {
          stdout.write(encodeFramed(response));
        }
      })
      .catch((err) => {
        const id = message && Object.prototype.hasOwnProperty.call(message, "id") ? message.id : null;
        stdout.write(encodeFramed(errorResponse(id, -32603, err && err.message ? err.message : String(err))));
      });
  });
  stdin.on("data", (chunk) => parser.push(chunk));
}

module.exports = {
  okResponse,
  errorResponse,
  encodeFramed,
  createFrameParser,
  attachStdio,
};
