import { isStoredImageKey, readLocalStoredImage } from "@/lib/images/storage";
import { canReadStoredImage } from "@/lib/images/access";

type RouteContext = { params: Promise<{ key: string[] }> };

async function serve({ params }: RouteContext, head: boolean): Promise<Response> {
  if ((process.env.IMAGE_PROVIDER ?? "local") !== "local") {
    return new Response(null, { status: 404 });
  }
  const { key } = await params;
  const storageKey = key.join("/");
  if (!isStoredImageKey(storageKey) || !(await canReadStoredImage(storageKey))) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
  const image = await readLocalStoredImage(storageKey);
  if (!image) return new Response(null, { status: 404 });
  return new Response(head ? null : new Uint8Array(image), {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(image.length),
      // Recheck visibility after moderation, sale, removal or session changes.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  return serve(context, false);
}

export async function HEAD(_request: Request, context: RouteContext): Promise<Response> {
  return serve(context, true);
}
