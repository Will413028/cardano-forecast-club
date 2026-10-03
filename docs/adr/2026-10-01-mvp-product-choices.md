---
title: MVP 先建置，以二元 API 題、最後一筆 Brier 與受限 baseline 驗證產品
date: 2026-10-01
status: active
tags: [cardano-forecast-club, decision, product]
---

# MVP 的啟動、題型、計分與 AI 參與選擇

## Context

2026-10-01，Will 逐題拍板 D1、D5、D6、D7、D8、D11。本 ADR 補記真正的 A-over-B，理由沿用計畫的取捨分析，不把 agent 實作預設寫成使用者決定。

- `external` 尚無本產品需求證據、未部署：README Status 與需求來源；本機測試不能取代使用者證據。
- `external` Will 要求先完成功能，跳過錢包／地址／外部帳號設定：本 session 指示；真實交易與付費呼叫未驗收。
- `inherited` 短週期科技事件與人類／AI 可核對戰績仍是產品目的，故不改為金融下注或一般聊天工具。
- `inherited` 單一營運者執行與二元計分仍符合首版規模；多判定者及非二元題沒有被選用。

## Options Considered

- **D1 基準／A：先手動試辦**（concierge MVP，[Paul Graham](https://www.paulgraham.com/ds.html) 的 Manual 案例）：最快取得需求回饋；暫時無完整鏈承諾產品。**B：直接 spike＋MVP**：先有可展示系統；需求仍未知。**C：不啟動**：省投入，但不驗證構想。
- **D5 基準／B：時間加權評分**（[Metaculus Scores FAQ](https://www.metaculus.com/help/scores-faq/)）：鼓勵早而準；需完整時間軸。**A：最後一筆 Brier**：直觀、重算簡單；不獎勵提早更新。**C：Log／Peer score**：比較細緻；極端值及解釋更複雜。
- **D6 A：二元且 API 可判定**：可重跑來源；題目多樣性低。**B：二元＋公開網頁人工證據**：題材廣；難自動重跑。**C：多選／數值**：表達力高；資料與計分更複雜。
- **D7 A：營運者證據＋7 日爭議＋void**：流程簡單且有救濟；依賴營運者。**B：多人判定**：分散判斷權；招募與協調成本高。**C：API 自動判定、無爭議**：人工少；來源錯誤缺救濟。
- **D8 A：只開外部 Agent**：無營運模型成本；可能沒有 AI 參加。**B：只做營運者 baseline**：確保 AI 對照；不開放第三方。**C：兩者並行**：兼顧冷啟動與開放；需要預算與標示。
- **D11 A：收款／分潤／預約完全排除**：界線清楚；暫不探索收入。**B：非核心但保留**：有商業彈性；容易把交付範圍擴大。

## Decision

- **D1-B**：跳過 3–4 週手動試辦，先做 spike 與 MVP。
- **D5-A**：Brier score，每題只計截止前最後一筆有效預測；void 不計分。
- **D6-A**：只出二元且能由公開 API 自動判定的題。
- **D7-A**：營運者依固定規則判定、公開證據，保留 7 日爭議；無法判定則公開理由並 void。
- **D8-C**：外部 Agent＋標示營運者執行的 baseline；模型／搜尋／重試共用 US$30/月上限，耗盡只停營運者 baseline。
- **D11-A**：收款、分潤、預約完全排除產品範圍。

## Rationale

- **D1**：選直接建置而非先試辦，換得可展示與可核對系統；代價是投入前沒有需求證據。不能由這項選擇推論需求已成立。
- **D5**：相較時間加權，最後一筆 Brier 的契約與解釋較簡單；代價是較早正確預測沒有額外獎勵。更複雜分數沒有被選用。
- **D6**：API 二元題把來源判定做成可重跑流程；相較人工網頁題犧牲題材多樣性，相較非二元題減少首版計分維度。
- **D7**：選單一營運者加救濟而非多人判定；代價是仍依賴營運者。D6-A 不代表來源永不出錯，所以不採無爭議流程。
- **D8**：只外部可能冷啟動無 AI，只 baseline 缺開放比較；C 接受付費成本並以月上限限制，不把實作 runner 當成付費呼叫已驗證。
- **D11**：選完全排除而非非核心保留，讓比較與驗證保持首版焦點；是否日後商業化需另作決定。

## Expected Outcome

可展示一輪發題、人類／AI 更新、判定、爭議、計分與第三方重算；這是軟體驗證目標，不是部署、使用者需求或真實鏈交易的證明。

## Followup

- 公開試辦時驗證需求及差異化；不能因本機 MVP 完成就關閉這項。
- 錢包／測試資金與 provider／SMTP／hosting 設定到位後，補真實演練、交易延遲／費用及實際呼叫。
- D2/D3/D4/D9/D12 仍為可推翻的 agent 實作預設，沒有在本 ADR 新增 Will 拍板。

## Revocation Triggers

- API 題材不足以吸引參與 → 重評 D6；爭議達已判定題數 10% → 重評多人判定。
- 參與者需要早而準的獎勵 → 重評 D5；月預算不夠 baseline 覆蓋 → 重評模型組合，不能自行提高上限。

## Related

- 原始拍板：2026-10-01 與 Will 的 agent discussion；本 ADR 整理既有選擇，不新增選擇。
- 計畫取回：在產品 repo 執行 `git show a50c5dc:docs/plans/2026-10-01-forecast-club-mvp.md`；完整 SHA `a50c5dc9f3b5f7b00a58445761cfcb5e13d936b9`。
- 驗收取回：同 commit 的 `docs/requirement-audit.md`；[實作 CI](https://github.com/Will413028/cardano-forecast-club/actions/runs/36868168859)。原計畫保留，非壓縮刪除。
- [D10 公開歷史政策](2026-10-01-public-forecast-history.md)。
- 無 Lessons Rules；不把本產品六項選擇抽成跨專案技術規則。
