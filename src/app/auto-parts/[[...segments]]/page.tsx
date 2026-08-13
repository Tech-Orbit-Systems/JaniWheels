import type { Metadata } from "next";
import {
  VerticalPage,
  verticalMetadata,
  type Params,
  type SearchParams,
} from "@/lib/routing/vertical";

export function generateMetadata(props: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  return verticalMetadata("part", props.params, props.searchParams);
}

export default function Page(props: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  return <VerticalPage vertical="part" {...props} />;
}
