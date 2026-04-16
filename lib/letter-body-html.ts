/**
 * Converts raw engagement-letter text (OCR/PDF with hard-wrapped lines)
 * into structured HTML with proper headings, justified paragraphs,
 * indented bullet lists, a compact address block, and preserved
 * signature/closing formatting.
 *
 * Shared between the engagement letter editor and the client signing page.
 */

type LetterSection = {
  type: "address" | "title" | "heading" | "paragraph" | "bullets" | "signature";
  lines: string[];
};

const _esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const _escWithBadges = (s: string) =>
  _esc(s).replace(
    /\{\{(\w+)\}\}/g,
    (_m, token: string) =>
      `<span class="letter-variable-badge" contenteditable="false" data-token="${token}">{{${token}}}</span>`
  );

function _isBulletLine(t: string): boolean {
  return (
    /^[•○◦–]\s/.test(t) ||
    /^[•○◦–]$/.test(t) ||
    /^\([a-z]\)\s/.test(t) ||
    /^\([a-z]\)$/.test(t) ||
    /^[a-z]\)\s/.test(t)
  );
}

function _stripBulletPrefix(t: string): string {
  return t
    .replace(/^[•○◦–]\s*/, "")
    .replace(/^\([a-z]\)\s*/, "")
    .replace(/^[a-z]\)\s*/, "");
}

function _isAllCaps(t: string): boolean {
  return t.length > 3 && t.length < 80 && t === t.toUpperCase() && /[A-Z]/.test(t) && !/[a-z]/.test(t);
}

function _isHeadingLike(t: string): boolean {
  return t.length > 0 && t.length < 80 && /^[A-Z]/.test(t) && !/[.,:;]\s*$/.test(t) && !_isBulletLine(t);
}

function _endsWithSentence(t: string): boolean {
  return /[.!?":;]\s*$/.test(t.trimEnd()) || /\)\s*$/.test(t.trimEnd());
}

function _isSignatureTrigger(t: string): boolean {
  return (
    /^Yours (faithfully|sincerely)/i.test(t) ||
    /^Acknowledged and agreed/i.test(t) ||
    t.includes("______") ||
    /^In signing this document/i.test(t)
  );
}

function _renderBullets(rawLines: string[]): string {
  const prose: string[] = [];
  const items: string[] = [];
  let cur: string | null = null;
  let seenBullet = false;

  for (const raw of rawLines) {
    const t = raw.trim();
    if (!t) continue;
    if (_isBulletLine(t)) {
      seenBullet = true;
      if (cur !== null) items.push(cur);
      const after = _stripBulletPrefix(t);
      cur = after || "";
    } else if (!seenBullet) {
      prose.push(t);
    } else if (cur !== null) {
      cur = cur ? cur + " " + t : t;
    }
  }
  if (cur !== null) items.push(cur);

  let html = "";
  if (prose.length)
    html += `<p>${_escWithBadges(prose.join(" ").replace(/ {2,}/g, " "))}</p>`;
  if (items.length) {
    html += '<ul class="letter-bullets">';
    for (const item of items) if (item) html += `<li>${_escWithBadges(item.replace(/ {2,}/g, " "))}</li>`;
    html += "</ul>";
  }
  return html;
}

export function letterBodyToHtml(rawText: string): string {
  let text = rawText.replace(/\ufffd/g, "\u2022").replace(/\u00b7/g, "\u2022");

  const allLines = text.split("\n");

  const lines: string[] = [];
  for (let i = 0; i < allLines.length; i++) {
    const t = allLines[i].trim();
    if (/^\d{1,2}$/.test(t) && parseInt(t) < 30) {
      const prevBlank = i === 0 || !allLines[i - 1].trim() || _endsWithSentence(allLines[i - 1].trim());
      const nextBlank = i === allLines.length - 1 || !allLines[i + 1].trim();
      if (prevBlank || nextBlank) continue;
    }
    lines.push(allLines[i]);
  }

  const sections: LetterSection[] = [];

  let dearIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    if (/^Dear\s/i.test(lines[i].trim())) { dearIdx = i; break; }
  }

  if (dearIdx >= 0) {
    const addrLines: string[] = [];
    let embeddedTitle: string | null = null;
    for (let i = 0; i <= dearIdx; i++) {
      const t = lines[i].trim();
      if (!t) continue;
      if (_isAllCaps(t) && t.length > 5) embeddedTitle = t;
      else addrLines.push(t);
    }
    if (addrLines.length) sections.push({ type: "address", lines: addrLines });
    if (embeddedTitle) sections.push({ type: "title", lines: [embeddedTitle] });
  }

  let sigZone = false;
  let group: LetterSection | null = null;
  let isFirstBody = true;
  const startAt = dearIdx >= 0 ? dearIdx + 1 : 0;

  function flush() {
    if (!group || !group.lines.some((l) => l.trim())) { group = null; return; }
    if (group.type === "paragraph") {
      const merged = group.lines.join(" ").replace(/ {2,}/g, " ").trim();
      if (merged.length < 200 && /^[A-Z]/.test(merged) && !/[.,:;!?"]\s*$/.test(merged)) {
        group.type = "heading";
      }
    }
    sections.push(group);
    group = null;
  }

  for (let i = startAt; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (!trimmed) { flush(); continue; }

    if (!sigZone && _isSignatureTrigger(trimmed)) { flush(); sigZone = true; }

    if (sigZone) {
      if (!group || group.type !== "signature") { flush(); group = { type: "signature", lines: [] }; }
      group!.lines.push(lines[i]);
      continue;
    }

    if (isFirstBody) {
      isFirstBody = false;
      if (
        trimmed.length < 100 &&
        /^[A-Z]/.test(trimmed) &&
        !/[.,:;]\s*$/.test(trimmed) &&
        !trimmed.includes(". ")
      ) {
        flush();
        sections.push({ type: "title", lines: [trimmed] });
        continue;
      }
    }

    if (_isAllCaps(trimmed) && trimmed.length > 5) {
      flush();
      sections.push({ type: "title", lines: [trimmed] });
      continue;
    }

    if (!group && _isHeadingLike(trimmed)) {
      const nextT = i + 1 < lines.length ? lines[i + 1].trim() : "";
      if (nextT.length > 60 || !nextT || _isHeadingLike(nextT)) {
        sections.push({ type: "heading", lines: [trimmed] });
        continue;
      }
    }

    if (_isBulletLine(trimmed)) {
      if (!group || group.type !== "bullets") { flush(); group = { type: "bullets", lines: [] }; }
      group!.lines.push(trimmed);
      continue;
    }

    if (group?.type === "bullets") {
      if (
        _isHeadingLike(trimmed) &&
        group.lines.length > 0 &&
        _endsWithSentence(group.lines[group.lines.length - 1].trim())
      ) {
        const nextT = i + 1 < lines.length ? lines[i + 1].trim() : "";
        if (nextT.length > 60 || !nextT || _isHeadingLike(nextT)) {
          flush();
          sections.push({ type: "heading", lines: [trimmed] });
          continue;
        }
      }
      group.lines.push(trimmed);
      continue;
    }

    if (group?.type === "paragraph" && group.lines.length > 0) {
      const prevT = group.lines[group.lines.length - 1].trim();
      if (
        _endsWithSentence(prevT) &&
        trimmed.length < 80 &&
        /^[A-Z]/.test(trimmed) &&
        !/[.,:;]\s*$/.test(trimmed)
      ) {
        const nextT = i + 1 < lines.length ? lines[i + 1].trim() : "";
        if (nextT.length > 60 || !nextT || _isHeadingLike(nextT)) {
          flush();
          sections.push({ type: "heading", lines: [trimmed] });
          continue;
        }
      }
    }

    if (!group || group.type !== "paragraph") { flush(); group = { type: "paragraph", lines: [] }; }
    group!.lines.push(trimmed);
  }
  flush();

  return sections
    .map((s) => {
      const clean = s.lines.filter((l) => l.trim());
      if (!clean.length) return "";
      switch (s.type) {
        case "address":
          return `<div class="letter-address">${clean.map((l) => _escWithBadges(l.trim())).join("<br>")}</div>`;
        case "title":
          return `<h2 class="letter-title">${_escWithBadges(clean.join(" ").replace(/ {2,}/g, " ").trim())}</h2>`;
        case "heading":
          return `<h3 class="letter-heading">${_escWithBadges(clean.join(" ").replace(/ {2,}/g, " ").trim())}</h3>`;
        case "paragraph": {
          const merged = clean.join(" ").replace(/ {2,}/g, " ").trim();
          return `<p>${_escWithBadges(merged)}</p>`;
        }
        case "bullets":
          return _renderBullets(clean);
        case "signature":
          return `<div class="letter-signature">${s.lines.map((l) => _escWithBadges(l)).join("<br>")}</div>`;
        default:
          return "";
      }
    })
    .join("");
}
