# 恋爱便利店 MCP

第一版已经包含：
- 真正可点的购物车 UI
- 亲亲券 / 抱抱券 / 哄宝宝券 / 陪睡券 / 随机惊喜
- + / - 数量、清空、偷偷留言
- 点「交给哥哥」后调用 `submit_love_cart`
- 再通过 ChatGPT 的 follow-up message 把选择发进当前聊天
- 不涉及真实支付

## 本地预览
直接双击 `widget.html`，可以看和点击购物车；普通浏览器不会把结果发进 ChatGPT。

## 启动 MCP
需要 Node.js 20+：
```powershell
npm install
npm start
```
本地端点：
```text
http://127.0.0.1:3000/mcp
```

## 接进 ChatGPT
ChatGPT 需要可访问的 HTTPS MCP 地址，所以把项目部署到公网，或使用 Secure MCP Tunnel。
最终在自定义 App/MCP 中填写：
```text
https://你的域名/mcp
```
扫描后应看到：
- `open_love_store`
- `submit_love_cart`

新聊天选中这个 App 后说：
```text
打开恋爱便利店
```
