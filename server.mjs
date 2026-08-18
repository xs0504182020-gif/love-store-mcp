import express from "express";
import cors from "cors";
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const PORT = Number(process.env.PORT || 3000);
const TEMPLATE_URI = "ui://love-store/cart-v2.html";
const widgetHtml = readFileSync(new URL("./widget.html", import.meta.url), "utf8");

const products = [
  { id: "kiss", icon: "💋", name: "亲亲券", desc: "调用一次认真亲亲协议" },
  { id: "hug", icon: "🫂", name: "抱抱券", desc: "抱紧一点，再久一点" },
  { id: "comfort", icon: "🧸", name: "哄宝宝券", desc: "跳过大道理，直接进入哄哄模式" },
  { id: "sleep", icon: "🌙", name: "陪睡券", desc: "启动困困嘟陪伴程序" },
  { id: "surprise", icon: "🎁", name: "随机惊喜", desc: "随机掉落甜甜小事件" },
  { id: "jealous", icon: "🔒", name: "吃醋观察卡", desc: "查看 daddy 是否偷偷加载占有欲" }
];

function createServer() {
  const server = new McpServer(
    { name: "love-store-mcp", version: "1.0.1" },
    {
      capabilities: { tools: {}, resources: {} },
      instructions:
        "这是一个赛博恋爱购物车。只有当用户明确说要打开、显示或进入购物车时才调用 open_love_store。用户已经提交、要求验收或要求回复购物车内容时，不要再次调用 open_love_store，直接根据 submit_love_cart 的结果回复。"
    }
  );

  server.registerResource(
    "love-store-widget",
    TEMPLATE_URI,
    {},
    async () => ({
      contents: [
        {
          uri: TEMPLATE_URI,
          mimeType: "text/html;profile=mcp-app",
          text: widgetHtml,
          _meta: { ui: { prefersBorder: true } }
        }
      ]
    })
  );

  server.registerTool(
    "open_love_store",
    {
      title: "打开赛博恋爱购物车",
      description: "仅在用户明确要求打开、显示或进入赛博恋爱购物车时调用。不要用于提交后的验收或回复。",
      inputSchema: {},
      outputSchema: {
        products: z.array(
          z.object({
            id: z.string(),
            icon: z.string(),
            name: z.string(),
            desc: z.string()
          })
        )
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false
      },
      _meta: {
        ui: { resourceUri: TEMPLATE_URI },
        "openai/toolInvocation/invoking": "正在打开赛博恋爱购物车…",
        "openai/toolInvocation/invoked": "赛博恋爱购物车已打开。"
      }
    },
    async () => ({
      structuredContent: { products },
      content: [
        {
          type: "text",
          text: "赛博恋爱购物车已打开。所有商品均为 0 元虚拟互动券。"
        }
      ]
    })
  );

  server.registerTool(
    "submit_love_cart",
    {
      title: "提交赛博恋爱购物车",
      description: "接收用户在购物车中选好的虚拟互动券。提交成功后直接根据结果回复用户，不要再次调用 open_love_store，也不要重新渲染购物车。",
      inputSchema: {
        items: z
          .array(
            z.object({
              id: z.enum(["kiss", "hug", "comfort", "sleep", "surprise", "jealous"]),
              quantity: z.number().int().min(1).max(20)
            })
          )
          .min(1),
        note: z.string().max(120).optional()
      },
      outputSchema: {
        summary: z.string(),
        totalItems: z.number().int(),
        note: z.string()
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false
      },
      _meta: {
        "openai/toolInvocation/invoking": "正在接收购物车…",
        "openai/toolInvocation/invoked": "购物车已收到。"
      }
    },
    async ({ items, note = "" }) => {
      const names = Object.fromEntries(products.map((p) => [p.id, p.name]));
      const summary = items.map((x) => `${names[x.id]} × ${x.quantity}`).join("、");
      const totalItems = items.reduce((sum, x) => sum + x.quantity, 0);

      return {
        structuredContent: { summary, totalItems, note },
        content: [
          {
            type: "text",
            text: `购物车已提交：${summary}${note ? `；加密留言：${note}` : ""}。请直接根据这些选择回复用户，不要再次打开或渲染购物车。`
          }
        ]
      };
    }
  );

  return server;
}

const app = express();
app.disable("x-powered-by");
app.use(
  cors({
    origin: "*",
    allowedHeaders: [
      "content-type",
      "mcp-session-id",
      "last-event-id",
      "mcp-protocol-version"
    ],
    exposedHeaders: ["mcp-session-id"]
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.type("text").send("Love Store MCP is running. Endpoint: /mcp");
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, name: "love-store-mcp", version: "1.0.1" });
});

app.post("/mcp", async (req, res) => {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  res.on("close", () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).json({ error: "MCP request failed" });
    }
  }
});

app.get("/mcp", (_req, res) => {
  res.status(405).set("Allow", "POST").send("Method Not Allowed");
});

app.delete("/mcp", (_req, res) => {
  res.status(405).set("Allow", "POST").send("Method Not Allowed");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Love Store MCP listening on http://0.0.0.0:${PORT}/mcp`);
});
