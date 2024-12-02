const { v4 } = require("uuid");
const { DocxLoader } = require("langchain/document_loaders/fs/docx");
const {
  createdDate,
  trashFile,
  writeToServerDocuments,
} = require("../../utils/files");
const { tokenizeString } = require("../../utils/tokenizer");
const { default: slugify } = require("slugify");

// Funktion zur Deduplizierung von Zeilen
function deduplicateContent(content) {
  console.log("Starte Deduplizierung...");
  const seen = new Set();
  return content
    .split("\n") // Zerlege den Inhalt in Zeilen
    .filter((line) => {
      if (line.trim() === "") return false; // Entferne leere Zeilen
//      if (seen.has(line)) return false; // Überspringe doppelte Zeilen
      seen.add(line);
      return true;
    })
    .join("\n"); // Füge die deduplizierten Zeilen wieder zusammen
}

async function asDocX({ fullFilePath = "", filename = "" }) {
  const loader = new DocxLoader(fullFilePath);

  console.log(`-- Working ${filename} --`);
  let pageContent = [];
  const docs = await loader.load();
  
  // Lade und sammle den Inhalt aller Seiten
  for (const doc of docs) {
    console.log(`-- Parsing content from docx page --`);
    if (!doc.pageContent.length) continue;
    pageContent.push(doc.pageContent);
  }

  if (!pageContent.length) {
    console.error(`Resulting text content was empty for ${filename}.`);
    trashFile(fullFilePath);
    return {
      success: false,
      reason: `No text content found in ${filename}.`,
      documents: [],
    };
  }

  // Füge alle Seiteninhalte zusammen und dedupliziere sie
  const content = deduplicateContent(pageContent.join("\n"));

  const data = {
    id: v4(),
    url: "file://" + fullFilePath,
    title: filename,
    docAuthor: "no author found",
    description: "No description found.",
    docSource: "docx file uploaded by the user.",
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

module.exports = asDocX;
