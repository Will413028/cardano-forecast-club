# 外部介面

查詢日期一律 2026-10-01（網路搜尋與官方文件）。會變動的參數附重查方法。本階段不註冊帳號、不呼叫付費 API；需要帳號或金鑰的項目列在計畫步驟的「需要人做的事」。

| # | 介面 | 用途 | 已知限制與費用 | 來源 | 重查方法 |
|---|---|---|---|---|---|
| E1 | Cardano 交易 metadata | 承諾模型 D3 的 A、B 選項：把雜湊或 Merkle root 寫進交易 | 單一字串或 bytes 值上限 64 bytes（較長的值要切段）；以 CBOR 儲存；數量只受交易大小限制 | [Build with transaction metadata](https://developers.cardano.org/docs/build/transaction-metadata/overview/) | 重讀該頁 |
| E2 | Cardano 協定參數 | 估算費用與交易大小 | `maxTxSize` 16,384 bytes；費用 = `minFeeA` × 大小 + `minFeeB`，主網 44 lovelace/byte 與 155,381 lovelace。估算：300 bytes 的承諾交易約 168,581 lovelace（≈ 0.17 ADA），實際值由步驟 4 量測 | [Cardano protocol parameters reference guide](https://docs.cardano.org/about-cardano/explore-more/parameter-guide)；[Build with transaction metadata](https://developers.cardano.org/docs/build/transaction-metadata/overview/) | 鏈上查目前參數：Blockfrost `GET /epochs/latest/parameters` 或 `cardano-cli query protocol-parameters` |
| E3 | Blockfrost | 讀寫鏈上資料（測試網與主網） | Starter 免費 50,000 requests/day，需註冊取得 project key；付費方案 EUR 29/月起 | [Plans and billing](https://blockfrost.dev/overview/plans-and-billing) | 重讀該頁 |
| E4 | Koios | 不需金鑰的公開查詢，可作為 verifier 的第二資料源 | Public tier 5,000 requests/day、100 requests/10 秒、30 秒查詢逾時，不需 API key | [Koios Pricing](https://koios.rest/pricing/Pricing.html) | 重讀該頁 |
| E5 | Yaci DevKit | 本機 devnet：可重設、1 秒出塊、內建 faucet 與 Blockfrost 相容 API | 需要 Docker；CI 可用 | [Presenting the yaci-devkit](https://cardano.org/news/2025-01-17-presenting-the-yaci-devkit/)；[Mesh：Yaci](https://meshjs.dev/yaci) | 重讀該頁與 release notes |
| E6 | Preprod 測試網與 faucet | 接近主網的測試環境 | 一般開發建議用 Preprod；faucet 額度與頻率以頁面為準 | [Networks & Test ADA](https://developers.cardano.org/docs/developers/curriculum/start-building/networks-and-test-ada/)；[Testnet Faucet](https://developers.cardano.org/docs/integrate-cardano/testnet-faucet/) | 開 faucet 頁 |
| E7 | CIP-30 `signData`／CIP-8 | 參與者以錢包簽署預測（D2、D3 的 B 選項） | CIP-30 以 CIP-8 的 COSE_Sign1／COSE_Key 格式簽署；有硬體錢包不支援的回報 | [Mesh：Prove Wallet Ownership](https://meshjs.dev/guides/prove-wallet-ownership)；[Cardano Forum：CIP-8 與硬體錢包](https://forum.cardano.org/t/cryptographic-message-signing-cip-8-to-sign-in-with-cip-30-wallets-doesnt-work-for-hardware-wallets/122709) | 重讀 CIP-30、CIP-8 原文 |
| E8 | Aiken | D3 的 C 選項：validator 檢查截止時間與狀態轉移 | 編譯器 v1.1.24（2026-09-26）、stdlib v4.0.0；支援 Plutus V3 | [aiken v1.1.24](https://github.com/aiken-lang/aiken/releases/tag/v1.1.24)；[stdlib v4.0.0](https://github.com/aiken-lang/stdlib/releases/tag/v4.0.0)；[Aiken validators](https://aiken-lang.org/language-tour/validators) | 查兩個 repo 的 releases |
| E9 | Mesh SDK／Lucid Evolution | TypeScript 交易建構、簽署、CIP-30 錢包連接 | 兩者皆開源；Mesh 偏全端 dApp 與錢包元件，Lucid Evolution 偏交易建構 | [MeshJS](https://github.com/MeshJS/mesh)；[Lucid Evolution](https://anastasia-labs.github.io/lucid-evolution/) | 查兩個 repo 的 releases |
| E10 | GitHub REST API | D6：以 release 是否存在判定「某專案是否發布下一版」 | 未驗證請求 60 requests/小時（以 IP 計），304 也計次；帶 token 5,000/小時；`GET /repos/{owner}/{repo}/releases` | [Rate limits for the REST API](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) | 重讀該頁；`curl -sI https://api.github.com/rate_limit` 看 header |
| E11 | LLM 供應商 API | D8：營運者自跑的 AI 參賽者 | 步驟 2 已查三模型價格與搜尋費用；屬付費 API，實際呼叫仍需擁有者授權 | 見 `spikes/ai-participants.md` | 步驟 2 查各供應商官方定價頁並記錄日期 |
| E12 | OWASP Session Management Cheat Sheet | 網頁登入 session 的預設參數（F8） | — | [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) | 重讀該頁 |
