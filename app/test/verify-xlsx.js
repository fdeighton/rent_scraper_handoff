/* Verifies XlsxLite produces a genuine .xlsx (Open XML) file:
 *  - byte signature is "PK" (50 4B 03 04), NOT an HTML/<html> blob and NOT a
 *    legacy OLE2 .xls (D0 CF 11 E0)
 *  - the ZIP is structurally valid and contains the required OOXML parts
 *  - styles / merges / inline strings are present
 *
 * Run:  node app/test/verify-xlsx.js
 */
const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const XlsxLite = require("../xlsx.js");

function build() {
  const wb = XlsxLite.createWorkbook();
  const title = wb.style({ font: { sz: 13, bold: true, color: "#FFFFFF" }, fill: "#061031", align: { h: "left", v: "center" } });
  const num = wb.style({ font: { sz: 11, color: "#061031" }, fill: "#EEF2FE", align: { h: "center", v: "center" }, numFmt: "#,##0", border: { top: { style: "medium", color: "#061031" } } });
  const s1 = wb.addSheet("Comp Analysis");
  [160, 80, 80].forEach((w, i) => s1.setCol(i, w));
  s1.row(26); s1.cell("Competitive Analysis — Test", { colspan: 3, s: title });
  s1.row(); s1.cell("Sloane ★", { rowspan: 2, s: num }); s1.cell(3995, { t: "n", s: num }); s1.cell(5.15, { t: "n", s: num });
  s1.row(); s1.cell(4200, { t: "n", s: num }); s1.cell(4.95, { t: "n", s: num });
  const s2 = wb.addSheet("Building Details");
  s2.row(); s2.cell("Sloane", { s: num }); s2.cell("PBR", { s: num });
  return wb.bytes();
}

function sig(bytes) {
  return Array.from(bytes.slice(0, 4)).map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
}

let failed = 0;
function ok(cond, msg) { console.log((cond ? "  PASS  " : "  FAIL  ") + msg); if (!cond) failed++; }

const bytes = build();
const out = path.join(require("os").tmpdir(), "xlsxlite-verify.xlsx");
fs.writeFileSync(out, Buffer.from(bytes));

console.log("File:", out, "(" + bytes.length + " bytes)");
console.log("First 4 bytes:", sig(bytes));

// 1. signature must be PK\x03\x04 (real .xlsx), not HTML and not legacy OLE2 .xls
ok(bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04, 'signature is "PK\\x03\\x04" (genuine XLSX zip)');
ok(!(bytes[0] === 0x3c), "not an HTML blob (does not start with '<')");
ok(!(bytes[0] === 0xd0 && bytes[1] === 0xcf), "not a legacy OLE2 .xls (D0 CF 11 E0)");

// 2. the ZIP unzips cleanly and exposes the required OOXML parts
try {
  const list = cp.execSync(`unzip -Z1 "${out}"`, { encoding: "utf-8" });
  cp.execSync(`unzip -t "${out}"`, { stdio: "ignore" }); // CRC / structure check
  ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/styles.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"]
    .forEach((p) => ok(list.includes(p), "contains part: " + p));
  const book = cp.execSync(`unzip -p "${out}" xl/workbook.xml`, { encoding: "utf-8" });
  ok(/name="Comp Analysis"/.test(book) && /name="Building Details"/.test(book), "workbook declares both sheet tabs");
  const sheet = cp.execSync(`unzip -p "${out}" xl/worksheets/sheet1.xml`, { encoding: "utf-8" });
  ok(/<mergeCells/.test(sheet), "worksheet declares merged cells");
  ok(/t="inlineStr"/.test(sheet), "worksheet has inline string cells");
  ok(/<v>3995<\/v>/.test(sheet), "worksheet has numeric cell 3995");
  const styles = cp.execSync(`unzip -p "${out}" xl/styles.xml`, { encoding: "utf-8" });
  ok(/patternType="solid"/.test(styles), "styles include solid fills (colours)");
  ok(/<numFmt /.test(styles), "styles include a custom number format");
} catch (e) {
  ok(false, "unzip validation failed: " + e.message);
}

console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed.");
process.exit(failed ? 1 : 0);
