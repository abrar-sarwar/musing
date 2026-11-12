// pulls the value of one string field out of a json document while it is still streaming,
// so the user can read muse's sentence before the rest of the object has arrived.
export class PartialStringField {
  private start = -1; // index in buf where the string's content begins
  private emitted = "";

  constructor(private readonly field: string) {}

  /** feed the full buffer so far. returns the newly readable text (may be ""). */
  update(buf: string): string {
    if (this.start < 0) {
      const m = new RegExp(`"${this.field}"\\s*:\\s*"`).exec(buf);
      if (!m) return "";
      this.start = m.index + m[0].length;
    }
    // find the closing quote that is not escaped
    let end = -1;
    for (let i = this.start; i < buf.length; i++) {
      const c = buf[i];
      if (c === "\\") {
        i++; // skip escaped char
        continue;
      }
      if (c === '"') {
        end = i;
        break;
      }
    }
    let raw = buf.slice(this.start, end === -1 ? buf.length : end);
    if (end === -1) {
      // hold back an incomplete escape at the tail ("\" or "\u12")
      const tail = /\\(u[0-9a-fA-F]{0,3})?$/.exec(raw);
      if (tail) raw = raw.slice(0, tail.index);
    }
    let decoded: string;
    try {
      decoded = JSON.parse(`"${raw}"`) as string;
    } catch {
      return "";
    }
    if (!decoded.startsWith(this.emitted)) {
      // should not happen; resync by re-emitting everything
      const out = decoded;
      this.emitted = decoded;
      return out;
    }
    const delta = decoded.slice(this.emitted.length);
    this.emitted = decoded;
    return delta;
  }

  get text(): string {
    return this.emitted;
  }
}
