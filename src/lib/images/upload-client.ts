export async function uploadPhotos(files: FileList): Promise<{ keys: string[]; errors: string[] }> {
  const keys: string[] = [];
  const errors: string[] = [];
  const selected = Array.from(files);
  for (let offset = 0; offset < selected.length; offset += 5) {
    const body = new FormData();
    selected.slice(offset, offset + 5).forEach((file) => body.append("files", file));
    try {
      const response = await fetch("/api/upload", { method: "POST", body });
      const data = await response.json() as { keys?: string[]; errors?: string[]; error?: string };
      if (Array.isArray(data.keys)) keys.push(...data.keys);
      if (Array.isArray(data.errors)) errors.push(...data.errors);
      if (!response.ok) {
        errors.push(data.error ?? "Upload failed.");
        break;
      }
    } catch {
      errors.push("Upload failed. Check your connection.");
      break;
    }
  }
  return { keys, errors };
}
