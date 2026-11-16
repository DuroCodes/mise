export {};

const server = Bun.spawn(["bun", "--watch", "server/index.ts"], {
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
  env: { ...process.env, NODE_ENV: "development", PORT: "3001" },
});

const client = Bun.spawn(["bun", "run", "vite", "--host", "127.0.0.1"], {
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
  env: process.env,
});

const shutdown = (code: number) => {
  server.kill();
  client.kill();
  process.exit(code);
};

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const code = await Promise.race([server.exited, client.exited]);
shutdown(code ?? 0);
