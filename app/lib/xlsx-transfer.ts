import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

type Row = Record<string, unknown>;

const xmlEscape = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

function columnName(index: number) {
  let name = "";
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
  }
  return name;
}

function worksheet(rows: Row[]) {
  const headers = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const values = [Object.fromEntries(headers.map(header => [header, header])), ...rows];
  const sheetRows = values.map((row, rowIndex) => {
    const cells = headers.map((header, columnIndex) => {
      const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
      return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(row[header])}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;
}

export function createXlsx(applications: Row[], history: Row[]) {
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Applications" sheetId="1" r:id="rId1"/><sheet name="Status History" sheetId="2" r:id="rId2"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>`),
    "xl/worksheets/sheet1.xml": strToU8(worksheet(applications)),
    "xl/worksheets/sheet2.xml": strToU8(worksheet(history)),
  };
  return zipSync(files, { level: 6 });
}

function sharedStrings(files: Record<string, Uint8Array>) {
  const source = files["xl/sharedStrings.xml"];
  if (!source) return [];
  const document = new DOMParser().parseFromString(strFromU8(source), "application/xml");
  return [...document.getElementsByTagName("si")].map(item => [...item.getElementsByTagName("t")].map(text => text.textContent ?? "").join(""));
}

function sheetRows(source: Uint8Array | undefined, strings: string[]) {
  if (!source) return [];
  const document = new DOMParser().parseFromString(strFromU8(source), "application/xml");
  const matrix = [...document.getElementsByTagName("row")].map(row => {
    const values: string[] = [];
    for (const cell of [...row.getElementsByTagName("c")]) {
      const reference = cell.getAttribute("r") ?? "A1";
      const letters = reference.match(/[A-Z]+/)?.[0] ?? "A";
      const index = [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
      const type = cell.getAttribute("t");
      const inline = [...cell.getElementsByTagName("t")].map(text => text.textContent ?? "").join("");
      const raw = cell.getElementsByTagName("v")[0]?.textContent ?? inline;
      values[index] = type === "s" ? strings[Number(raw)] ?? "" : raw;
    }
    return values;
  });
  const headers = matrix.shift() ?? [];
  return matrix.filter(row => row.some(Boolean)).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]).filter(([header]) => Boolean(header))));
}

function workbookSheets(files: Record<string, Uint8Array>) {
  const workbook = files["xl/workbook.xml"];
  const relationships = files["xl/_rels/workbook.xml.rels"];
  if (!workbook || !relationships) throw new Error("This Excel workbook is missing required worksheet information.");
  const workbookDocument = new DOMParser().parseFromString(strFromU8(workbook), "application/xml");
  const relationshipDocument = new DOMParser().parseFromString(strFromU8(relationships), "application/xml");
  const targets = new Map([...relationshipDocument.getElementsByTagName("Relationship")].map(item => [item.getAttribute("Id"), item.getAttribute("Target")]));
  return [...workbookDocument.getElementsByTagName("sheet")].map(sheet => {
    const id = sheet.getAttribute("r:id") ?? sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
    const target = targets.get(id) ?? "";
    return { name:sheet.getAttribute("name") ?? "", path:`xl/${target.replace(/^\//, "").replace(/^xl\//, "")}` };
  });
}

export function readXlsx(data: ArrayBuffer) {
  const files = unzipSync(new Uint8Array(data));
  const strings = sharedStrings(files);
  const sheets = workbookSheets(files);
  const applicationSheet = sheets.find(sheet => sheet.name === "Applications") ?? sheets[0];
  const historySheet = sheets.find(sheet => sheet.name === "Status History");
  if (!applicationSheet) throw new Error("The Excel workbook has no application worksheet.");
  return {
    applications: sheetRows(files[applicationSheet.path], strings),
    history: historySheet ? sheetRows(files[historySheet.path], strings) : [],
  };
}
