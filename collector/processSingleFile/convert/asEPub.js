const { v4 } = require("uuid");
const { EPubLoader } = require("langchain/document_loaders/fs/epub");
const { tokenizeString } = require("../../utils/tokenizer");
const {
  createdDate,
  trashFile,
  writeToServerDocuments,
} = require("../../utils/files");
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

async function asEPub({ fullFilePath = "", filename = "" }) {
  let content = "";
  try {
    const loader = new EPubLoader(fullFilePath, { splitChapters: false });
    const docs = await loader.load();
    docs.forEach((doc) => (content += doc.pageContent));
  } catch (err) {
    console.error("Could not read epub file!", err);
  }

  if (!content?.length) {
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

  console.log(`-- Working ${filename} --`);
  const data = {
    id: v4(),
    url: "file://" + fullFilePath,
    title: filename,
    docAuthor: "Unknown", // TODO: Find a better author
    description: "Unknown", // TODO: Find a better description
    docSource: "a epub file uploaded by the user.",
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

module.exports = asEPub;
