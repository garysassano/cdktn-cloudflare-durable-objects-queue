# cdktn-cloudflare-durable-objects-queue

CDKTN app that uses a Durable Object to publish messages to a queue.

### Related Apps

- [wrangler-cloudflare-durable-objects-queue](https://github.com/garysassano/wrangler-cloudflare-durable-objects-queue) - Built with Wrangler instead of CDKTN.

## Architecture Diagram

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./src/assets/arch-diagram-dark.svg">
  <img alt="Architecture Diagram" src="./src/assets/arch-diagram.svg">
</picture>

## Prerequisites

- **_Cloudflare:_**
  - Must have set the `CLOUDFLARE_API_TOKEN` variable in your local environment, with the `Workers Scripts:Edit`, `Queues:Edit` and `Account Settings:Read` permissions.
- **_mise:_**
  - [Install mise](https://mise.jdx.dev/installing-mise.html), which manages Node, pnpm, and OpenTofu.

## Installation

```sh
mise install
pnpm install
pnpm gen
```

`pnpm gen` generates the Cloudflare provider constructs into `.gen/`. Re-run it whenever the provider constraint in `cdktf.json` changes.

## Deployment

```sh
pnpm run deploy
```

## Usage

1. Grab the `workers.dev` URL of `my-worker` from the Cloudflare dashboard.

2. Navigate to `https://my-worker.<SUBDOMAIN>.workers.dev?userId=test`.

3. Check that a message is present in `my-queue` from the Cloudflare dashboard.

## Cleanup

```sh
pnpm destroy
```

## How it works

A request carrying a `userId` is routed to the Durable Object instance derived from that id, and the Durable Object publishes its own id to `my-queue`.

Wrangler owns the Worker **bundle**, CDKTN owns the **deployment**:

1. `pnpm bundle` runs `wrangler deploy --dry-run --outdir dist`, which bundles `src/worker/index.ts`.
2. `src/stacks/my-stack.ts` picks up `dist/index.js` as a `TerraformAsset` and uploads it through `cloudflare_workers_script` (`content_file` + `content_sha256`), with the Durable Object binding, the queue producer binding, and the class migration declared in Terraform.

`pnpm synth`, `pnpm diff`, `pnpm run deploy`, and `pnpm test` all run the bundle step first, so the synthesized stack always matches the current source. The stack reads `dist/index.js` while it is being constructed, so nothing that instantiates it works without a bundle.

Keep the compatibility date, compatibility flags, bindings, and migrations in `wrangler.jsonc` in sync with `src/stacks/my-stack.ts`. Wrangler needs them to bundle and to run locally, OpenTofu needs them to deploy.

### Durable Object migrations

The `MyDurableObject` namespace is not a resource of its own: it is created by the `migrations` block on `cloudflare_workers_script`, which is why the migration and the binding have to agree on the class name. The class uses the SQLite storage backend (`new_sqlite_classes`), the default for new Durable Object classes; the key-value backend used by `new_classes` is legacy and not available to new classes on all plans.

Renaming or deleting the class later needs a new migration tag plus `renamed_classes` or `deleted_classes`. Changing `new_sqlite_classes` in place will not do it.
