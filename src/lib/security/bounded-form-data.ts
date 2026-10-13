/** Read the multipart body with a hard byte cap even when Content-Length is absent. */
export async function boundedFormData(request: Request, maxBytes: number): Promise<FormData | null> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(contentType) || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: ArrayBuffer[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new RangeError("UPLOAD_REQUEST_TOO_LARGE");
      }
      const copy = new ArrayBuffer(value.byteLength);
      new Uint8Array(copy).set(value);
      chunks.push(copy);
    }
    return await new Request("http://localhost/upload", {
      method: "POST",
      headers: { "content-type": contentType },
      body: new Blob(chunks),
    }).formData();
  } finally {
    reader.releaseLock();
  }
}
