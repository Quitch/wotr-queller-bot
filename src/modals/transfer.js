// Transfer helpers shared by the save and debug modals: download or share a text file, copy text to the clipboard.

const FILE_TYPE = "application/json";
// A slow mobile download handoff still reads the link's URL after the click.
const LINK_LIFETIME_MS = 60000;

async function hostDownloads() {
  try {
    return window.claude?.use ? await window.claude.use("downloads") : null;
  } catch {
    return null;
  }
}
// The artifact host offers a downloads capability; where it refuses for any reason but the viewer's own, a Blob link
// is tried, and the copy (or share) button and the text box remain the fallback. Returns which route ran.
export async function downloadText({ fileName, data, noteEl, fallbackLabel }) {
  noteEl.textContent = "Preparing the download…";
  const downloads = await hostDownloads();
  let reason = "";
  if (downloads) {
    try {
      const result = await downloads.save({ filename: fileName, data });
      noteEl.textContent = "File saved.";
      return result?.status || "saved";
    } catch (error) {
      const code = error?.code || "unknown";
      if (code === "declined") {
        noteEl.textContent = "Download cancelled.";
        return "declined";
      }
      if (code === "rate_limited") {
        noteEl.textContent =
          "A download prompt is already open, or there were too many in a row; wait, then try again.";
        return "busy";
      }
      reason = "The app could not save the file here (" + code + "). ";
    }
  }
  try {
    const url = URL.createObjectURL(new Blob([data], { type: FILE_TYPE }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), LINK_LIFETIME_MS).unref?.();
    noteEl.textContent =
      reason + "If nothing downloaded, use " + fallbackLabel + ".";
    return "link";
  } catch {
    noteEl.textContent =
      reason + "Downloads are not available here — use " + fallbackLabel + ".";
    return "blocked";
  }
}
// The file the share sheet takes: the JSON file, or the same text as a .txt file where the browser's share list has
// no JSON; null where the browser (or the frame's permission policy) shares no files.
function shareableFile(fileName, data) {
  const choices = [
    [fileName, FILE_TYPE],
    [fileName.replace(/\.json$/, ".txt"), "text/plain"],
  ];
  try {
    for (const [name, type] of choices) {
      const file = new File([data], name, { type });
      if (navigator.canShare?.({ files: [file] })) return file;
    }
  } catch {
    // No File or no navigator: nothing to share.
  }
  return null;
}
// navigator.share needs the click's user activation, so it is called before anything is awaited.
async function shareFile({ fileName, data, noteEl, fallbackLabel }) {
  try {
    const file = shareableFile(fileName, data);
    await navigator.share({ files: [file] });
    noteEl.textContent = "Shared " + file.name + ".";
    return "shared";
  } catch (error) {
    if (error?.name === "AbortError") {
      noteEl.textContent = "Share cancelled.";
      return "cancelled";
    }
    noteEl.textContent =
      "Sharing is not available here — use " + fallbackLabel + ".";
    return error?.name || "failed";
  }
}
// Shows the Share button only where the share sheet takes a file, and shares data() on a click; done gets the outcome.
export function wireShare(
  button,
  { fileName, data, noteEl, fallbackLabel, done },
) {
  button.hidden = !shareableFile(fileName(), "");
  button.onclick = () =>
    void shareFile({
      fileName: fileName(),
      data: data(),
      noteEl,
      fallbackLabel,
    }).then(done);
}
export async function copyText({ data, noteEl, label, textarea }) {
  try {
    await navigator.clipboard.writeText(data);
    noteEl.textContent = label + " copied to the clipboard.";
  } catch {
    // Clipboard access was refused; select the text so the user can copy it by hand.
    if (textarea) {
      textarea.value = data;
      textarea.focus();
      textarea.select();
    }
    noteEl.textContent = "Copy the text from the box below.";
  }
}
