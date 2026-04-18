export function resetFileInputValue(fileInput) {
  if (!fileInput) {
    return;
  }

  fileInput.value = '';
}
