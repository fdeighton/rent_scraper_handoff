/* ---------------------------------------------------------------------------
 * XlsxLite — a tiny, dependency-free real .xlsx (Open XML / SpreadsheetML) writer.
 *
 * Produces a genuine OOXML workbook: a ZIP package whose bytes begin with the
 * "PK" signature (50 4B 03 04), so Windows/Excel see the content as a real
 * .xlsx and open it with NO "file format and extension don't match" warning —
 * unlike the old HTML-table-saved-as-.xls approach.
 *
 * Supports: cell fills, fonts (size/bold/italic/colour), borders, alignment +
 * wrap, number formats, column widths, row heights, and merged cells (rowspan /
 * colspan, modelled like an HTML table). No compression (ZIP "stored"); files
 * are small so size is a non-issue and the encoder stays trivial/auditable.
 *
 * Works in the browser (returns a Blob) and in Node (returns a Uint8Array via
 * .bytes()) so the export can be unit-tested. See test/verify-xlsx.js.
 * ------------------------------------------------------------------------- */
(function (root) {
  "use strict";

  // --- byte helpers ---------------------------------------------------------
  const TE = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
  function enc(str) {
    if (TE) return TE.encode(str);
    // Node fallback
    return Uint8Array.from(Buffer.from(str, "utf-8"));
  }
  function u16(n) { return new Uint8Array([n & 255, (n >>> 8) & 255]); }
  function u32(n) { return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]); }
  function concatBytes(list) {
    let len = 0; for (const b of list) len += b.length;
    const out = new Uint8Array(len); let o = 0;
    for (const b of list) { out.set(b, o); o += b.length; }
    return out;
  }

  // --- CRC32 (for ZIP entries) ---------------------------------------------
  let CRC_T = null;
  function crc32(buf) {
    if (!CRC_T) {
      CRC_T = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        CRC_T[n] = c >>> 0;
      }
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ CRC_T[(crc ^ buf[i]) & 0xFF];
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  // --- ZIP (stored, no compression) ----------------------------------------
  const DOS_DATE = 22561, DOS_TIME = 0; // fixed 2024-01-01 00:00 (no Date.* needed)
  function zipStore(files) {
    const chunks = [], central = [];
    let offset = 0;
    for (const f of files) {
      const name = enc(f.name), data = f.data, crc = crc32(data);
      // local file header: sig, verNeeded, flag, method, time, date, crc, compSize, uncompSize, nameLen, extraLen
      const local = concatBytes([
        u32(0x04034b50), u16(20), u16(0), u16(0), u16(DOS_TIME), u16(DOS_DATE),
        u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0),
      ]);
      chunks.push(local, name, data);
      // central dir header: sig, verMade, verNeeded, flag, method, time, date, crc, compSize,
      // uncompSize, nameLen, extraLen, commentLen, diskStart, intAttr, extAttr, localOffset
      central.push(concatBytes([
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(DOS_TIME), u16(DOS_DATE),
        u32(crc), u32(data.length), u32(data.length),
        u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset),
      ]), name);
      offset += local.length + name.length + data.length;
    }
    const cdStart = offset;
    let cdSize = 0; for (const b of central) cdSize += b.length;
    const end = concatBytes([
      u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
      u32(cdSize), u32(cdStart), u16(0),
    ]);
    return concatBytes([...chunks, ...central, end]);
  }

  // --- XML helpers ----------------------------------------------------------
  function xmlText(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function xmlAttr(s) { return xmlText(s).replace(/"/g, "&quot;"); }
  function argb(c) { c = String(c).replace("#", "").toUpperCase(); return c.length === 8 ? c : "FF" + c; }
  function colLetter(c) { let s = "", n = c + 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  function A1(c, r) { return colLetter(c) + (r + 1); }

  // --- style registry -> styles.xml ----------------------------------------
  function styleKit() {
    const numFmts = [], nfKey = {}; let nfId = 164;
    function numFmt(code) {
      if (code == null) return 0;
      if (typeof code === "number") return code; // built-in id
      if (nfKey[code] != null) return nfKey[code];
      const id = nfId++; numFmts.push(`<numFmt numFmtId="${id}" formatCode="${xmlAttr(code)}"/>`); return (nfKey[code] = id);
    }
    const fonts = [], fKey = {};
    function font(spec) {
      spec = spec || {};
      const key = JSON.stringify(spec);
      if (fKey[key] != null) return fKey[key];
      let x = "<font>";
      if (spec.bold) x += "<b/>";
      if (spec.italic) x += "<i/>";
      x += `<sz val="${spec.sz || 11}"/>`;
      if (spec.color) x += `<color rgb="${argb(spec.color)}"/>`;
      x += `<name val="${xmlAttr(spec.name || "Calibri")}"/></font>`;
      fonts.push(x); return (fKey[key] = fonts.length - 1);
    }
    font({}); // index 0: default font (required)
    const fills = [
      '<fill><patternFill patternType="none"/></fill>',
      '<fill><patternFill patternType="gray125"/></fill>',
    ];
    const fillKey = {};
    function fill(color) {
      if (!color) return 0;
      const a = argb(color);
      if (fillKey[a] != null) return fillKey[a];
      fills.push(`<fill><patternFill patternType="solid"><fgColor rgb="${a}"/><bgColor indexed="64"/></patternFill></fill>`);
      return (fillKey[a] = fills.length - 1);
    }
    const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
    const bKey = {};
    function border(spec) {
      if (!spec) return 0;
      const key = JSON.stringify(spec);
      if (bKey[key] != null) return bKey[key];
      const side = (s, n) => s ? `<${n} style="${s.style || "thin"}"><color rgb="${argb(s.color || "#000000")}"/></${n}>` : `<${n}/>`;
      borders.push(`<border>${side(spec.left, "left")}${side(spec.right, "right")}${side(spec.top, "top")}${side(spec.bottom, "bottom")}<diagonal/></border>`);
      return (bKey[key] = borders.length - 1);
    }
    const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
    const xfKey = {};
    function register(spec) {
      spec = spec || {};
      const fId = font(spec.font), fillId = fill(spec.fill), bId = border(spec.border), nId = numFmt(spec.numFmt);
      const al = spec.align;
      const key = `${fId}|${fillId}|${bId}|${nId}|${al ? JSON.stringify(al) : ""}`;
      if (xfKey[key] != null) return xfKey[key];
      let x = `<xf numFmtId="${nId}" fontId="${fId}" fillId="${fillId}" borderId="${bId}" xfId="0" applyFont="1" applyFill="1" applyBorder="1"`;
      if (nId) x += ` applyNumberFormat="1"`;
      if (al) {
        x += ` applyAlignment="1"><alignment${al.h ? ` horizontal="${al.h}"` : ""}${al.v ? ` vertical="${al.v}"` : ""}${al.wrap ? ` wrapText="1"` : ""}/></xf>`;
      } else x += "/>";
      xfs.push(x); return (xfKey[key] = xfs.length - 1);
    }
    function xml() {
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
        (numFmts.length ? `<numFmts count="${numFmts.length}">${numFmts.join("")}</numFmts>` : "") +
        `<fonts count="${fonts.length}">${fonts.join("")}</fonts>` +
        `<fills count="${fills.length}">${fills.join("")}</fills>` +
        `<borders count="${borders.length}">${borders.join("")}</borders>` +
        `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
        `<cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs>` +
        `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
        `</styleSheet>`;
    }
    return { register, xml };
  }

  // --- sheet builder (HTML-table-like: row()/cell() with colspan/rowspan) ----
  function sheet() {
    const rows = [], merges = [], occ = {}, colW = [];
    let r = -1, cur = 0;
    function setCol(i, px) { colW[i] = px; }
    function row(px) { r++; rows.push({ ht: px || null, cells: [] }); cur = 0; }
    function skip(n) { cur += (n || 1); }
    function cell(v, o) {
      o = o || {};
      while (occ[r + "_" + cur]) cur++;
      const c = cur, cs = o.colspan || 1, rs = o.rowspan || 1;
      rows[r].cells.push({ c, v, s: o.s, t: o.t });
      for (let dr = 0; dr < rs; dr++) for (let dc = 0; dc < cs; dc++) { if (!dr && !dc) continue; occ[(r + dr) + "_" + (c + dc)] = 1; }
      if (cs > 1 || rs > 1) merges.push(A1(c, r) + ":" + A1(c + cs - 1, r + rs - 1));
      cur = c + cs;
    }
    function xml() {
      let colsXml = "";
      if (colW.some((w) => w)) {
        colsXml = "<cols>";
        colW.forEach((px, i) => { if (px) { const w = Math.max(1, (px - 5) / 7); colsXml += `<col min="${i + 1}" max="${i + 1}" width="${w.toFixed(2)}" customWidth="1"/>`; } });
        colsXml += "</cols>";
      }
      let data = "<sheetData>";
      rows.forEach((rw, ri) => {
        const ht = rw.ht != null ? ` ht="${(rw.ht * 0.75).toFixed(2)}" customHeight="1"` : "";
        data += `<row r="${ri + 1}"${ht}>`;
        rw.cells.slice().sort((a, b) => a.c - b.c).forEach((cl) => {
          const ref = A1(cl.c, ri), sAttr = cl.s ? ` s="${cl.s}"` : "";
          if (cl.v === null || cl.v === undefined || cl.v === "") { data += `<c r="${ref}"${sAttr}/>`; return; }
          const isNum = cl.t === "n" || (cl.t == null && typeof cl.v === "number");
          if (isNum) data += `<c r="${ref}"${sAttr}><v>${cl.v}</v></c>`;
          else data += `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${xmlText(cl.v)}</t></is></c>`;
        });
        data += "</row>";
      });
      data += "</sheetData>";
      const mg = merges.length ? `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : "";
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
        `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>` +
        `<sheetViews><sheetView showGridLines="0" workbookViewId="0"/></sheetViews>` +
        `<sheetFormatPr defaultRowHeight="15"/>` +
        colsXml + data + mg +
        `<pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.3" footer="0.3"/>` +
        `<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>` +
        `</worksheet>`;
    }
    return { setCol, row, cell, skip, xml };
  }

  // --- package parts (one or more worksheets, shared style table) -----------
  function parts(styles, sheets) {
    if (!sheets.length) sheets = [{ name: "Sheet1", sh: sheet() }];
    const sheetOverrides = sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
    const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheetOverrides}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
    const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
    const sheetTags = sheets.map((s, i) => `<sheet name="${xmlAttr((s.name || ("Sheet" + (i + 1))).slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("");
    const wb = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetTags}</sheets></workbook>`;
    const wsRels = sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("");
    const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${wsRels}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
    const files = [
      { name: "[Content_Types].xml", data: enc(ct) },
      { name: "_rels/.rels", data: enc(rootRels) },
      { name: "xl/workbook.xml", data: enc(wb) },
      { name: "xl/_rels/workbook.xml.rels", data: enc(wbRels) },
      { name: "xl/styles.xml", data: enc(styles.xml()) },
    ];
    sheets.forEach((s, i) => files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc(s.sh.xml()) }));
    return files;
  }

  const MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  // Multi-sheet workbook with a shared style table. addSheet(name) returns a
  // sheet-scoped api ({style, setCol, row, cell, skip}). Single-sheet callers
  // can use addSheet once. bytes()/blob() package every sheet added.
  function createWorkbook() {
    const styles = styleKit(), sheets = [];
    function addSheet(name) {
      const sh = sheet();
      sheets.push({ name: name || ("Sheet" + (sheets.length + 1)), sh });
      return { style: styles.register, setCol: sh.setCol, row: sh.row, cell: sh.cell, skip: sh.skip };
    }
    return {
      MIME, style: styles.register, addSheet,
      bytes() { return zipStore(parts(styles, sheets)); },
      blob() { return new Blob([this.bytes()], { type: MIME }); },
    };
  }

  const api = { createWorkbook, MIME };
  root.XlsxLite = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
