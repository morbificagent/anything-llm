const { v4 } = require("uuid");
const {
  createdDate,
  trashFile,
  writeToServerDocuments,
} = require("../../../utils/files");
const { tokenizeString } = require("../../../utils/tokenizer");
const { default: slugify } = require("slugify");
const PDFLoader = require("./PDFLoader");

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

async function asPdf({ fullFilePath = "", filename = "" }) {
  const pdfLoader = new PDFLoader(fullFilePath, {
    splitPages: true,
  });

  console.log(`-- Working ${filename} --`);
  const pageContent = [];
  const docs = await pdfLoader.load();

  for (const doc of docs) {
    console.log(
      `-- Parsing content from pg ${
        doc.metadata?.loc?.pageNumber || "unknown"
      } --`
    );
    if (!doc.pageContent || !doc.pageContent.length) continue;
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
    docAuthor: docs[0]?.metadata?.pdf?.info?.Creator || "no author found",
    description: docs[0]?.metadata?.pdf?.info?.Title || "No description found.",
    docSource: "pdf file uploaded by the user.",
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

module.exports = asPdf;
