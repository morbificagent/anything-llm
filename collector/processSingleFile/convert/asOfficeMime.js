const { v4 } = require("uuid");
const officeParser = require("officeparser");
const {
  createdDate,
  trashFile,
  writeToServerDocuments,
} = require("../../utils/files");
const { tokenizeString } = require("../../utils/tokenizer");
const { default: slugify } = require("slugify");

// Funktion zur Deduplizierung von Zeilen
function deduplicateContent(content) {
  const seen = new Set();
  return content
    .split("\n") // Zerlege den Inhalt in Zeilen
    .filter((line) => {
      if (line.trim() === "") return false; // Entferne leere Zeilen
      if (seen.has(line)) return false; // Überspringe doppelte nicht-leere Zeilen
      seen.add(line);
      return true;
    })
    .join("\n"); // Füge die deduplizierten Zeilen wieder zusammen
}

async function asOfficeMime({ fullFilePath = "", filename = "" }) {
  console.log(`-- Working ${filename} --`);
  let content = "";
  try {
    content = await officeParser.parseOfficeAsync(fullFilePath);
  } catch (error) {
    console.error(`Could not parse office or office-like file`, error);
  }

  if (!content.length) {
    console.error(`Resulting text content was empty for ${filename}.`);
    trashFile(fullFilePath);
    return {
      success: false,
      reason: `No text content found in ${filename}.`,
      documents: [],
    };
  }

  // Wende die Deduplizierung auf den gesamten Text an
  content = deduplicateContent(content);

  const data = {
    id: v4(),
    url: "file://" + fullFilePath,
    title: filename,
    docAuthor: "no author found",
    description: "No description found.",
    docSource: "Office file uploaded by the user.",
    chunkSource: "",
    published: createdDate(fullFilePath),
    wordCount: content.split(" ").length,
    pageContent: content,
    token_count_estimate: tokenizeString(content).length,
  };

  const document = writeToServerDocuments(
    data,
    `${slugify(filename)}-${data.id}`
  );
  trashFile(fullFilePath);
  console.log(`[SUCCESS]: ${filename} converted & ready for embedding.\n`);
  
  return { success: true, reason: null, documents: [document] };
}

module.exports = asOfficeMime;
