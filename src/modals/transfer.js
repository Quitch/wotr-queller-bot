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
      noteEl.textContent = "Saved " + fileName + ".";
      return result?.status || "saved";
    } catch (error) {
      const code = error?.code || "unknown";
      if (code === "declined") {
        noteEl.textContent = "Download cancelled.";
        return "declined";
      }
      if (code === "rate_limited") {
        noteEl.textContent =
          "A download prompt is already open; finish it or try again.";
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
// Whether this browser (and the frame's permission policy) lets the share sheet take a file.
export function canShareFile(fileName) {
  try {
    return !!navigator.canShare?.({
      files: [new File([""], fileName, { type: FILE_TYPE })],
    });
  } catch {
    return false;
  }
}
// navigator.share needs the click's user activation, so it is called before anything is awaited.
export async function shareFile({ fileName, data, noteEl, fallbackLabel }) {
  try {
    await navigator.share({
      files: [new File([data], fileName, { type: FILE_TYPE })],
    });
    noteEl.textContent = "Shared " + fileName + ".";
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
