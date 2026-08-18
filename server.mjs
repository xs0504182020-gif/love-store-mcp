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
    { name: "love-store-mcp", version: "1.0.0" },
    {
      capabilities: { tools: {}, resources: {} },
      instructions:
        "这是一个赛博恋爱购物车。用户想打开购物车时调用 open_love_store；用户提交选择时用 submit_love_cart。所有商品均为虚拟互动，不涉及真实付款。"
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
      description: "打开一个可交互的赛博恋爱购物车界面。",
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
        "openai/outputTemplate": TEMPLATE_URI,
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
      description: "接收用户在购物车里选好的虚拟互动券，并把选择回传给 ChatGPT。不会创建真实订单。",
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
            text: `用户刚刚在赛博恋爱购物车里选了：${summary}${note ? `；加密留言：${note}` : ""}。这是虚拟互动选择，不涉及真实交易。`
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
  res.json({ ok: true, name: "love-store-mcp", version: "1.0.0" });
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
