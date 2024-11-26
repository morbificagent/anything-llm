const { v4 } = require("uuid");
const {
  createdDate,
  trashFile,
  writeToServerDocuments,
} = require("../../utils/files");
const { tokenizeString } = require("../../utils/tokenizer");
const { default: slugify } = require("slugify");
const { LocalWhisper } = require("../../utils/WhisperProviders/localWhisper");
const { OpenAiWhisper } = require("../../utils/WhisperProviders/OpenAiWhisper");

const WHISPER_PROVIDERS = {
  openai: OpenAiWhisper,
  local: LocalWhisper,
};

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

async function asAudio({ fullFilePath = "", filename = "", options = {} }) {
  const WhisperProvider = WHISPER_PROVIDERS.hasOwnProperty(
    options?.whisperProvider
  )
    ? WHISPER_PROVIDERS[options?.whisperProvider]
    : WHISPER_PROVIDERS.local;

  console.log(`-- Working ${filename} --`);
  const whisper = new WhisperProvider({ options });
  const { content, error } = await whisper.processFile(fullFilePath, filename);

  if (!!error) {
    console.error(`Error encountered for parsing of ${filename}.`);
    trashFile(fullFilePath);
    return {
      success: false,
      reason: error,
      documents: [],
    };
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

  // Wende die Deduplizierung auf den transkribierten Text an
  const deduplicatedContent = deduplicateContent(content);

  const data = {
    id: v4(),
    url: "file://" + fullFilePath,
    title: filename,
    docAuthor: "no author found",
    description: "No description found.",
    docSource: "audio file uploaded by the user.",
    chunkSource: "",
    published: createdDate(fullFilePath),
    wordCount: deduplicatedContent.split(" ").length,
    pageContent: deduplicatedContent,
    token_count_estimate: tokenizeString(deduplicatedContent).length,
  };

  const document = writeToServerDocuments(
    data,
    `${slugify(filename)}-${data.id}`
  );
  trashFile(fullFilePath);
  console.log(
    `[SUCCESS]: ${filename} transcribed, converted & ready for embedding.\n`
  );
  
  return { success: true, reason: null, documents: [document] };
}

module.exports = asAudio;
