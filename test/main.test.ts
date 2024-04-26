import { App, Testing } from "cdktn";
import { describe, expect, it } from "vitest";
import { MyStack } from "../src/stacks/my-stack.js";

describe("MyStack", () => {
  // `runValidations` makes synth fail on construct-level validation errors.
  const synthesized = Testing.synth(new MyStack(new App(), "test"), true);

  it("configures the Cloudflare provider and resolves the account", () => {
    expect(Testing.toHaveProvider(synthesized, "cloudflare")).toBe(true);
    expect(
      Testing.toHaveDataSourceWithProperties(synthesized, "cloudflare_accounts", {
        direction: "asc",
        max_items: 1,
      }),
    ).toBe(true);
  });

  it("creates the queue the Durable Object publishes to", () => {
    expect(
      Testing.toHaveResourceWithProperties(synthesized, "cloudflare_queue", {
        queue_name: "my-queue",
      }),
    ).toBe(true);
  });

  it("uploads the bundled Worker as an ES module", () => {
    expect(
      Testing.toHaveResourceWithProperties(synthesized, "cloudflare_workers_script", {
        script_name: "my-worker",
        main_module: "index.js",
        compatibility_flags: ["nodejs_compat"],
        observability: { enabled: true },
      }),
    ).toBe(true);

    const script = JSON.parse(synthesized).resource.cloudflare_workers_script.MyWorker;
    expect(script.content_file).toMatch(/^assets\/MyWorkerBundle\/.+\/index\.js$/);
    expect(script.content_sha256).toBe(`\${filesha256("${script.content_file}")}`);
  });

  it("creates the Durable Object namespace through a SQLite migration", () => {
    expect(
      Testing.toHaveResourceWithProperties(synthesized, "cloudflare_workers_script", {
        migrations: {
          new_tag: "v1",
          new_sqlite_classes: ["MyDurableObject"],
        },
      }),
    ).toBe(true);
  });

  it("binds the Durable Object namespace and the queue producer", () => {
    expect(
      Testing.toHaveResourceWithProperties(synthesized, "cloudflare_workers_script", {
        bindings: [
          {
            type: "durable_object_namespace",
            name: "MY_DO_NAMESPACE",
            class_name: "MyDurableObject",
          },
          {
            type: "queue",
            name: "MY_QUEUE",
            // biome-ignore lint/suspicious/noTemplateCurlyInString: Terraform interpolation, not a JS template literal
            queue_name: "${cloudflare_queue.MyQueue.queue_name}",
          },
        ],
      }),
    ).toBe(true);
  });

  it("enables the workers.dev subdomain for the script", () => {
    expect(
      Testing.toHaveResourceWithProperties(synthesized, "cloudflare_workers_script_subdomain", {
        enabled: true,
        previews_enabled: true,
        // biome-ignore lint/suspicious/noTemplateCurlyInString: Terraform interpolation, not a JS template literal
        script_name: "${cloudflare_workers_script.MyWorker.script_name}",
      }),
    ).toBe(true);
  });
});
