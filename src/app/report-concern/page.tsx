import type { Metadata } from "next";
import { ContentList, ContentPage, ContentSection, InlineLink } from "@/components/ContentPage";
import { abs } from "@/lib/seo/jsonld";

export const metadata: Metadata = { title: "Report a Concern | JaniWheels", description: "Find out how to report a suspicious listing, account or marketplace safety concern to JaniWheels.", alternates: { canonical: abs("/report-concern") } };

export default function ReportConcernPage() { return <ContentPage eyebrow="Trust and safety" title="Report a concern" intro="Reports help the moderation team review suspicious, misleading or unsafe marketplace activity.">
  <ContentSection title="Report the relevant listing"><p>Open the listing and use its Report option. This sends the correct listing reference to moderation and helps prevent duplicate reports.</p></ContentSection>
  <ContentSection title="What to include"><ContentList><li>A short factual explanation of the concern.</li><li>The listing link or account context.</li><li>The specific claim, image or behavior that appears unsafe or misleading.</li></ContentList><p>Do not send passwords, verification codes, payment-card details or unrelated identity documents.</p></ContentSection>
  <ContentSection title="What happens next"><p>A report may place a safety hold on a listing and can be reviewed by an administrator. JaniWheels may dismiss, flag, reject, reinstate or remove content based on the available evidence. A report does not guarantee a particular outcome.</p></ContentSection>
  <ContentSection title="Urgent matters"><p>If someone is in immediate danger or you suspect a crime, contact the appropriate local authorities. For a general platform question, use the <InlineLink href="/contact">Contact page</InlineLink>.</p></ContentSection>
</ContentPage>; }
