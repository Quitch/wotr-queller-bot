// Transfer helpers shared by the save and debug modals: download a text file, copy text to the clipboard.

// Transfer helpers (save file, debug log).
// The artifact host offers a downloads capability; a plain <a download> may be inert for viewers, so the copy button (and the text box) is the fallback.
export async function downloadText({ fileName, data, noteEl, fallbackLabel }) {
  try {
    const downloads = window.claude?.use
      ? await window.claude.use("downloads")
      : null;
    if (downloads) {
      await downloads.save({ filename: fileName, data });
      noteEl.textContent = "Saved " + fileName + ".";
      return;
    }
  } catch (error) {
    noteEl.textContent =
      "Download not completed: " + (error.message || error.code || "cancelled");
    return;
  }
  try {
    const link = document.createElement("a");
    link.href =
      "data:application/json;charset=utf-8," + encodeURIComponent(data);
    link.download = fileName;
    link.click();
    noteEl.textContent = "If nothing downloaded, use " + fallbackLabel + ".";
  } catch {
    // The browser blocked the download; the note points the user at the alternative.
    noteEl.textContent =
      "Downloads are not available here — use " + fallbackLabel + ".";
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
