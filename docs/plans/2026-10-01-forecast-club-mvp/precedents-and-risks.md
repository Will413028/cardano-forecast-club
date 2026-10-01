# 既有先例與待驗證的產品風險

查詢日期 2026-10-01。

## 既有先例

| 先例 | 證明了什麼 | 不證明什麼 | 來源 |
|---|---|---|---|
| Metaculus（含 AI bot 錦標賽） | 已有人類與 AI bot 同場預測的活動；以 log score 為基礎的 Baseline／Peer score 並納入預測更新歷史 | 不證明免費、無獎金的科技題俱樂部能留住人；個人戰績與機率評分不是新功能 | [Scores FAQ](https://www.metaculus.com/help/scores-faq/)；[Summer 2026 FutureEval Bot Tournament](https://www.metaculus.com/tournament/summer-futureeval-2026/) |
| Good Judgment Open | 免費的公開預測平台以 Brier score 計分，可長期累積個人準確度 | 不證明使用者在意可獨立驗證 | [Good Judgment：Human vs AI forecasts](https://goodjudgment.com/human-vs-ai-forecasts/)；[scoringutils：scoring rules](https://cran.r-project.org/web/packages/scoringutils/vignettes/scoring-rules.html) |
| Manifold Markets | 不涉真錢的 play money 社群可以形成活躍的預測社群 | 它是市場機制，不是機率提交與計分；不證明本產品的題型有人玩 | [Manifold FAQ](https://docs.manifold.markets/faq) |
| ForecastBench | 已有人類（含 superforecaster）與 LLM 的系統性預測比較，以 Brier score 報告 | 是研究 benchmark，不是社群產品；不證明一般使用者想和 AI 比 | [ForecastBench](https://arxiv.org/abs/2409.19839) |
| Prophet Arena | 已有持續收集真實事件、評估 LLM 預測的 live benchmark | 事件來自預測市場，不是科技社群題；不是人類參與的產品 | [LLM-as-a-Prophet](https://arxiv.org/abs/2510.17638) |
| Foresight Arena | 已有在 Polygon 以 commit-reveal 做鏈上 AI 預測評測的設計 | 2026-05-04 的 v2 說明數值結果是模擬，實際評測尚待報告；不能當作已驗證的採用或成效 | [Foresight Arena](https://arxiv.org/abs/2605.00420) |

結論：「人類 vs AI 預測」「機率計分」「鏈上 commit-reveal 評測」各自都有先例。本產品若要有使用理由，差異只能落在「科技社群的短週期題目」與「第三方能獨立核對的完整已登記戰績」的組合上；這個組合是否有人要，目前沒有證據（見下表）。

## 待驗證的產品風險

| # | 風險 | 目前證據 | 驗證方式（計畫內） |
|---|---|---|---|
| K1 | 有沒有人要：科技社群、預測愛好者、Agent 開發者會不會來參加 | 無本產品的試用、留存或付費證據 | 步驟 3 手動試辦（D1） |
| K2 | 會不會反覆參與：哪些題目能讓人每週回來 | 無 | 步驟 3 的回訪率；步驟 1 的題目可行性 |
| K3 | 是否願意公開完整已登記戰績 | 無 | 步驟 3 試辦前告知全部公開，量測報名到提交的轉換；D10 |
| K4 | 模糊結果怎麼處理才被接受 | 無 | 步驟 1 回溯樣本的模糊率；D7 |
| K5 | 獨立驗證能否形成既有平台以外的使用理由 | 無；上鏈本身不構成充分差異化 | 步驟 3 試辦後問卷 |
| K6 | 願不願意付費或投入 | 無；範圍不含收款 | 本階段不驗證（見 D11 與計畫「延後」） |
