import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AssetType, Fn, TerraformAsset, TerraformStack } from "cdktn";
import type { Construct } from "constructs";
import { DataCloudflareAccounts } from "../../.gen/providers/cloudflare/data-cloudflare-accounts/index.js";
import { CloudflareProvider } from "../../.gen/providers/cloudflare/provider/index.js";
import { Queue } from "../../.gen/providers/cloudflare/queue/index.js";
import { WorkersScript } from "../../.gen/providers/cloudflare/workers-script/index.js";
import { WorkersScriptSubdomain } from "../../.gen/providers/cloudflare/workers-script-subdomain/index.js";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

export class MyStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    //==============================================================================
    // Cloudflare Configuration
    //==============================================================================

    new CloudflareProvider(this, "CloudflareProvider");

    const cfAccounts = new DataCloudflareAccounts(this, "CloudflareAccounts", {
      direction: "asc",
      maxItems: 1,
    });

    const mainAccountId = cfAccounts.result.get(0).id;

    //==============================================================================
    // Cloudflare Queues
    //==============================================================================

    const myQueue = new Queue(this, "MyQueue", {
      accountId: mainAccountId,
      queueName: "my-queue",
    });

    //==============================================================================
    // Cloudflare Workers
    //==============================================================================

    // Worker bundle built by `pnpm bundle`, copied into the synthesized stack.
    const workerBundle = new TerraformAsset(this, "MyWorkerBundle", {
      path: join(projectRoot, "dist", "index.js"),
      type: AssetType.FILE,
    });

    const myWorker = new WorkersScript(this, "MyWorker", {
      accountId: mainAccountId,
      scriptName: "my-worker",
      contentFile: workerBundle.path,
      contentSha256: Fn.filesha256(workerBundle.path),
      mainModule: "index.js",
      compatibilityDate: "2026-08-20",
      compatibilityFlags: ["nodejs_compat"],
      observability: {
        enabled: true,
      },
      // The Durable Object namespace is created by the migration, not by a
      // separate resource, so the binding and the migration must agree on the
      // class name.
      migrations: {
        newTag: "v1",
        newSqliteClasses: ["MyDurableObject"],
      },
      bindings: [
        {
          type: "durable_object_namespace",
          name: "MY_DO_NAMESPACE",
          className: "MyDurableObject",
        },
        {
          type: "queue",
          name: "MY_QUEUE",
          queueName: myQueue.queueName,
        },
      ],
    });

    new WorkersScriptSubdomain(this, "MyWorkerSubdomain", {
      accountId: mainAccountId,
      scriptName: myWorker.scriptName,
      enabled: true,
      previewsEnabled: true,
    });
  }
}
