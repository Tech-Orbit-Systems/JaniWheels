import Image, { type ImageProps } from "next/image";

/** Local media must reach its authorization route with the browser's cookie. */
export default function StoredImage(props: ImageProps) {
  return <Image {...props} alt={props.alt} unoptimized={typeof props.src === "string" && props.src.startsWith("/uploads/") ? true : props.unoptimized} />;
}
