# AI 參賽者來源與成本 spike

查詢日期：2026-10-01；來源 commit：`463a932`。只查官方文件並作離線估算，沒有登入、註冊帳號、讀取 key 或呼叫模型；模型品質、可用額度與帳號權限尚未驗證。

## 計算前提

每月 4.35 週，每週 5–20 題，每題每個 baseline 提交 1–3 次（首次提交加最多兩次更新），即 N=ceil(4.35×題數×提交次數)=22–261 次／模型／月。題數與頻率是估算情境，不是已拍板的規格。

英文無搜尋提示詞範本 745 字元，有搜尋版 1,056 字元；範本包含題目、截止時間、固定規則與來源。以約 3–4 字元/token 粗估，另保留填入題目與訊息 overhead。無搜尋輸入 387–2,000 tokens；有搜尋輸入 4,464–10,000 tokens（含假設 4,000–8,000 搜尋內容 tokens）。每次計費 output 假設 500–4,000 tokens，包含 reasoning/thinking 的預算，不能只數 150 字的可見答案。字元法不是 tokenizer 實測，上界不是保證。

P(I,O)= (I×input_rate + O×output_rate)/1,000,000。
無搜尋費用=N×P(I,O)；有搜尋費用=N×[P(I,O)+queries×search_rate]，queries=1–2。Standard、未命中 cache、無 batch 折扣、未含稅／匯差。重試、額外模型輪次與比假設更長的 reasoning 均另加；正式運行要依 usage 計帳與在預算耗盡前停送。

## 每月費用區間

單價為 USD／百萬 input/output tokens，費用 USD／模型／月。

| 模型名稱 | input / output 單價 | 無搜尋 | 有搜尋 | 來源網址 | 查詢日期 | 計算式 |
|---|---|---|---|---|---|---|
| GPT-5.6 Terra | 2 / 12 | 0.15–13.57 | 0.55–22.97 | [官方價格](https://developers.openai.com/api/docs/models/gpt-5.6-terra) | 2026-10-01 | N×P；搜尋另加 N×(1–2)×0.01 |
| Claude Haiku 4.5 | 1 / 5 | 0.06–5.74 | 0.37–13.05 | [官方價格](https://platform.claude.com/docs/en/about-claude/pricing) | 2026-10-01 | N×P；搜尋另加 N×(1–2)×0.01 |
| Gemini 3.5 Flash | 1.5 / 9 | 0.11–10.18 | 0.55–20.62 | [官方價格](https://ai.google.dev/gemini-api/docs/pricing) | 2026-10-01 | N×P；搜尋另加 N×(1–2)×0.014 |

OpenAI 與 Claude 搜尋各 US$0.01/次，搜尋內容另按 token 計。Google 使用保守付費情境 US$0.014/查詢，不扣共享的每月 5,000 次免費搜尋額度；一次生成可能觸發多個搜尋查詢。Google 若免費額度完整可用，實際費用可能更低。各供應商搜尋回合與 token 計費不同，此表是同量情境比較，不表示工作量必然相同。

- [OpenAI tools pricing](https://developers.openai.com/api/docs/pricing)：查詢日期 2026-10-01。
- [Claude web search pricing](https://platform.claude.com/docs/en/about-claude/pricing#web-search-tool)：查詢日期 2026-10-01。
- [Google Standard pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash)：查詢日期 2026-10-01；採 Standard 1.50/9.00，不採 Batch/Flex 的 0.75/4.50。

三個模型各跑一位 baseline：無搜尋總計約 US$0.32–29.49/月；有搜尋約 US$1.48–56.64/月。這不是全部專案成本，未含託管、Cardano、人工維運。

## 提示詞與重算

- `spikes/ai-prompt-no-search.txt`：只使用題目與已有知識；近期事件可能超出訓練資料。
- `spikes/ai-prompt-with-search.txt`：先查官方發布規劃與歷史，再輸出機率；要求引用來源、時間，最多兩次查詢。提示詞限制不能保證工具實際不超支，實作時也要限制。
- repo 根目錄執行 `python3 spikes/ai_costs.py`，重建提示詞、JSON 與費用結果；純離線，不連線。數值與公式的 SSOT 是 `ai_costs.py`。
- 本次沒有在已知答案的回溯題上測 baseline；事後搜尋會看到結果，不能用來宣稱預測品質。

## 外部 Agent 介面先例

[Metaculus 官方 bot 範例](https://github.com/Metaculus/metac-bot-template/blob/main/main_with_no_framework.py)（查詢日期 2026-10-01）使用 token 驗證；GET 拉取開放題目與規則，POST 提交 question id 與二元題機率；模型產生與提交是分離步驟。此處只參考提交方式，不複製程式碼，也未呼叫 Metaculus API。官方 API 文件頁本次無可讀本文，實際欄位依官方 repo 的範例核對。

## 本產品最小 Agent 介面草案（待後續決策，非已實作契約）

| 介面 | 最小內容 | 邊界 |
|---|---|---|
| GET /v1/questions?status=open | id、題目、UTC 截止、固定規則、API 判定來源、rule_hash | 截止前預測可見性遵循未決 D4，不由本 spike 決定 |
| POST /v1/questions/{id}/forecasts | probability_yes、client_submission_id；可選 rationale、sources | Agent token 綁定參賽身分且可撤銷；D2 若選簽章層再擴充 |
| 提交回應 | event_id、server_received_at、rule_hash、commitment_status | received 不等於已上鏈；截止由 server 時間與 D3 機制核對 |
| GET /v1/agents/me/forecasts | 本 Agent 的提交歷史與承諾狀態 | token 不得讀取或寫入別人紀錄 |

同一 client_submission_id 重試同 payload 回同 event；不同 payload 回 409。真正修改使用新 id 並追加事件（I3）。截止後拒收；未知題 404、非法機率 422、未授權 401、額度不足 429。機率精度、範圍與簽章欄位留給規格階段，這裡不替 D2、D3、D4 拍板。

模型／供應商名稱是自我申報，不宣稱可證明身分（I6）。營運者 baseline 標示「營運者執行」，與外部 Agent 使用相同的提交、截止和計分路徑；預測紀錄依 D10-A 截止後公開。

## D8 選項與建議

- A 只開放外部 Agent：營運者模型費用為零，初期可能無 AI 參加。
- B 只自跑 1–3 個 baseline：確保有 AI，持續模型費用與營運負擔。
- C 外部 Agent＋營運者 baseline：可保證比較對象並接受外部參加，成本依 baseline 數量與調查頻率增加。

建議 C，先從一位 baseline 開始；模型與月上限仍待 Will 決定。價格證據不提供模型準確度排名，也不授權取得 key 或啟動付費執行。
