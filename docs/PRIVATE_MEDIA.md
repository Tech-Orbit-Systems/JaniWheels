# Private media delivery

New Cloudflare uploads request `requireSignedURLs=true` and use the returned
UUID (`cf/<uuid>` in storage keys). Custom IDs cannot be private. The upload
response must confirm privacy before the application records ownership.

All listing, account and dealer images use `/uploads/<key>`. That endpoint
checks current listing/owner/admin visibility before fetching the provider.
Signed URLs stay on the server, expire after 60 seconds and are never returned
to browsers. Responses are WebP, bounded to 2400 pixels, and `private, no-store`.
The Next image optimizer rejects upload and remote provider URLs.

## Provider setup and acceptance still required

- Set the Cloudflare account/token, account hash, `CF_IMAGES_SIGNING_KEY` and
  `CF_IMAGES_PRIVATE_VARIANT`. Match both image-provider environment settings.
- Create that predefined variant with a maximum 2400-pixel bounding box and
  **never allow public access**. Audit every other variant for public overrides.
- Verify unauthenticated direct delivery fails; owner/admin previews work;
  active images are visible through the app; moderation immediately denies
  anonymous access; deletion and provider failures behave correctly.
- Proxying images adds application bandwidth and processing. Measure it in
  HTTPS staging before launch and size hosting accordingly.

Existing custom-ID objects remain public at their old provider URLs until
removed. The new application refuses to serve them. Before enabling Cloudflare
on an existing deployment, back up references, re-upload affected images as
private UUID objects, replace listing/pending/avatar/logo references atomically,
verify access and remove the old objects. Purge old caches. Local files do not
need this migration. No live objects or provider configuration were changed by
the development package.

Mock-provider checks cover signing, upload privacy verification, key validation,
delivery, cleanup and provider/configuration failures. They do not certify
account configuration or old-object removal.

Sources: [Private images](https://developers.cloudflare.com/images/optimization/hosted-images/serve-private-images/)
and [custom path limitations](https://developers.cloudflare.com/images/storage/upload-images/upload-custom-path/).
