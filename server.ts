import index from "./src/index.html";

const LEVELS_FILE = "levels.json";

const server = Bun.serve({
  port: 3000,
  development: { hmr: true, console: true },
  routes: {
    "/": index,
    "/api/levels": {
      async GET() {
        const file = Bun.file(LEVELS_FILE);
        if (!(await file.exists())) return Response.json([]);
        return new Response(file, {
          headers: { "content-type": "application/json" },
        });
      },
      async POST(req) {
        const data = await req.json();
        await Bun.write(LEVELS_FILE, JSON.stringify(data, null, 2));
        console.log(`saved ${Array.isArray(data) ? data.length : "?"} levels`);
        return new Response("ok");
      },
    },
  },
});

console.log(`dev server: ${server.url}`);
