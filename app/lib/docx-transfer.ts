import { strToU8, zipSync } from "fflate";

type ApplicationRow = {
  company: string; role: string; status: string; appliedDate: string; location: string;
  salary?: string | null; source?: string | null; url?: string | null; notes?: string | null;
};

const escapeXml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&apos;");

function text(value: unknown, bold = false) {
  return `<w:r>${bold ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>`;
}

function paragraph(value: unknown, options: { heading?: boolean; muted?: boolean } = {}) {
  const properties = options.heading ? "<w:pPr><w:spacing w:before=\"260\" w:after=\"100\"/></w:pPr>" : "<w:pPr><w:spacing w:after=\"80\"/></w:pPr>";
  const run = options.muted ? `<w:r><w:rPr><w:color w:val="6B746D"/></w:rPr><w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>` : text(value, options.heading);
  return `<w:p>${properties}${run}</w:p>`;
}

function cell(value: unknown, bold = false) {
  return `<w:tc><w:tcPr><w:tcW w:w="1800" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:after="0"/></w:pPr>${text(value, bold)}</w:p></w:tc>`;
}

export function createDocx(applications: ApplicationRow[], exportedAt: string) {
  const headers = ["Company", "Role", "Status", "Applied", "Location", "Source", "Salary"];
  const rows = applications.map(app => `<w:tr>${cell(app.company)}${cell(app.role)}${cell(app.status)}${cell(app.appliedDate)}${cell(app.location)}${cell(app.source ?? "")}${cell(app.salary ?? "")}</w:tr>`).join("");
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraph("Applyly application report", { heading: true })}${paragraph(`${applications.length} application${applications.length === 1 ? "" : "s"} exported ${exportedAt}`, { muted: true })}<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D9DDD8"/><w:left w:val="single" w:sz="4" w:color="D9DDD8"/><w:bottom w:val="single" w:sz="4" w:color="D9DDD8"/><w:right w:val="single" w:sz="4" w:color="D9DDD8"/><w:insideH w:val="single" w:sz="4" w:color="E9ECE8"/><w:insideV w:val="single" w:sz="4" w:color="E9ECE8"/></w:tblBorders></w:tblPr><w:tr>${headers.map(header => cell(header, true)).join("")}</w:tr>${rows}</w:tbl><w:sectPr><w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr></w:body></w:document>`;
  return zipSync({
    "[Content_Types].xml": strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    "_rels/.rels": strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    "word/document.xml": strToU8(document),
  }, { level: 6 });
}