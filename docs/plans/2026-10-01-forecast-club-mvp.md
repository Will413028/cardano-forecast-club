# 人類 vs AI 預測俱樂部：先驗證需求，再跑通一輪可獨立核對的預測

**Goal：** 依 D1-B 跳過手動試辦，完成 spike 並拍板剩餘決定後，系統能在本機 devnet 與 D9 選定的網路上跑完一輪完整流程——發題並承諾判定規則、人類與 AI 提交與修改機率、截止前把預測承諾上鏈、依事先約定的來源判定、計分並產生個人戰績——且第三方只用公開資料與鏈上資料，以不共用產品程式碼、依規格另寫的參考 verifier 重算出與排行榜相同的成績。可驗證的終態見步驟 13、14 的驗收。D1 已選 B；步驟 3 不執行，需求是否成立仍待後續公開試辦驗證。

**上層：** 暫代（沒有主計畫，下一段「全域約束與完成定義」暫放於此）。主清單在 repo 外：見本機個人脈絡檔（不進版控；步驟 0 建立指向）。

**附件：** 同名目錄 `2026-10-01-forecast-club-mvp/`——`requirements.md`（需求清單，來源逐句編號）、`nfr.md`（非功能需求）、`external-interfaces.md`（外部介面）、`precedents-and-risks.md`（既有先例與產品風險）、`check_plan.py`（本計畫的一次性檢查腳本，只檢查這四份附件與計畫本身）；spike 與試辦的摘要放子目錄 `spikes/`，不在檢查範圍。引用的 `README.md`、`AGENTS.md` 快照為初始 commit `82112c6`（2026-10-01）。

## 全域約束與完成定義（暫代主計畫）

- 範圍限制：不做收款、分潤、預約；Token 發行、NFT、下注、交易、加密貨幣獎金不作為產品核心（`requirements.md` N1、N2；N1 的用詞衝突見 D11）。
- 不把規劃中的功能寫成已實作、已部署或已被使用者驗證（S19）；介面與文件把「鏈上承諾與 validator 檢查」和「外部事實」分開敘述（S20）。
- 公開發布、聯絡使用者、註冊外部帳號、呼叫付費 API、在主網送交易、安裝系統層級工具，都要先取得擁有者授權；寫在各步驟的「需要人做的事」。
- 金鑰與 token（營運者錢包金鑰、Blockfrost project key、GitHub token、LLM API key）不進版控、不印出、不寫進 log。
- commit 與 push 依擁有者授權。Will 已授權本 session 的 commit 與初始 push；初始 commit `82112c6` 已完成。步驟 1 之後的產物都在初始 commit 之後才產生。
- 共用、有額度的資源一次只跑一個使用它的工作：GitHub 未驗證 API（60 requests/小時，以 IP 計）、Koios public tier、Blockfrost 免費額度、測試網 faucet。
- 開發與驗證指令在可執行的骨架存在、指令跑過之後才寫進 `README.md`、`AGENTS.md`（S21）。
- 完成定義（每個產品步驟 6–13 都要逐項做到）：
  1. `make check` 在本機通過，GitHub Actions 上對應 job 的結論是 success（看 job，不只看 run）。
  2. 步驟列出的 mutation 都實際跑過，每個都讓檢查失敗，結果記在進度表。
  3. verifier 對該步驟產生的 devnet 資料重算，結果與 server 一致。
  4. `README.md` 的 Status 與 Development 段與實況一致，沒有誇大。
  5. 本步驟新增的介面已補進後續步驟的「消費端」搜尋指令。

## 前提（開工時核對過，2026-10-01）

- 會改到或取代的既有部署是否在線：無既有部署（全新系統）。主網上的承諾交易與合約不可撤回，寫成不變量 I7、I8。
- 本產品進入開發：Will 於 2026-10-01 決定 D1-B，跳過手動試辦，先做 spike 再建置 MVP；此決定取代 S12、S22 的先探索需求再啟動條件。需求尚未驗證。
- 使用者需求未經驗證：沒有本產品的試用、留存或付費證據（S9；來源：產品構想筆記（私人筆記，未公開，2026-10-01），已確認「無證據」這個事實）。
- repo 已在 GitHub 公開建立；步驟 0 已建立初始 commit `82112c6`，後续計畫 commit 可由 `git log --oneline -- docs/plans/` 核對（2026-10-01）。
- 鏈不會自行知道外部事件結果，結果依事先約定的來源判定；也不能證明所有私下預測都已登記（S5、S6、S18，已確認，是產品事實）。
- 產品技術棧：未決（S22 把它列為擋住實作的待決事項），列為 D12，擋住步驟 6 之後。步驟 4、5 的拋棄式 spike 用 TypeScript ＋ Mesh 與 Aiken，spike 程式不被產品沿用（預設（可推翻））。GitHub Actions 做 CI、Yaci DevKit 做本機 devnet（E5）、Aiken 只在 D3 選 C 時進入產品（E8）（預設（可推翻））。
- 本機環境（2026-10-01 核對，已確認）：Node `v25.9.0`（不是 LTS，步驟 6 以版本鎖定檔固定 D12 選定的版本）；Docker 已安裝（`/opt/homebrew/bin/docker`）；Aiken 未安裝（`command -v aiken` 無結果）。
- 預計模組（新系統，實作後補檔案路徑；以 D12 建議選項的命名）：`packages/core`（領域型別、`canonicalize`、`merkleRoot`、`scoreForecasts`）、`packages/chain`（`buildAnchorTx`、`submitAnchor`、`readAnchor`）、`apps/server`（API 與 `publishQuestion`、`submitForecast`、`closeRound`、`anchorJob`、`resolveQuestion`、`exportRound`）、`apps/web`、`apps/verifier`（`verifyRound` CLI，不讀資料庫）、`verifier-ref/`（依 `docs/verification.md` 另寫的參考 verifier，不 import 產品程式碼，語言與產品不同）、`contracts/`（只在 D3=C）、`spikes/`（拋棄式）。
- 介面語言：英文，文案集中存放，之後可加中文（S10 接受英文或中英雙語；預設（可推翻））。
- 網頁 session 參數依 OWASP Session Management Cheat Sheet（`nfr.md` F8、E12；預設（可推翻））。
- 費用量級：一筆約 300 bytes 的承諾交易約 0.17 ADA（E2 的公式估算，2026-10-01；未確認，步驟 4 量測）。
- 自動判定的資料源：步驟 1 的 32 題 GitHub Releases 樣本每題獨立判定需 1 request；每週 ≤20 題、截止後查一次的請求量可容納於 60 requests/小時，但額度按 IP 共用，不涵蓋持續輪詢（2026-10-01，見附件 spikes/question-resolution.md）。

**驗收基線：** 無產品基線。初始 commit `82112c6` 沒有可執行的產品檢查（`README.md`：「There is no runnable scaffold or verified development command yet.」）。第一個建立檢查的是步驟 6；步驟 1–5 是 spike 與試辦，驗收是附件產物的機械檢查。

## 本階段依賴的不變量

| 不變量 | 依賴它的機制（預計的模組與函式，實作後補檔案路徑） | 會改寫它的決定 |
|---|---|---|
| I1 截止後提交的預測不計分 | `apps/server` 的 `submitForecast`（截止後拒收）、`closeRound`；`packages/core` 的 `scoreForecasts`（只取截止前事件）；`apps/verifier` 的 `verifyRound` 與 `verifier-ref/`（以承諾時間檢查順序） | D3-B（順序改由每筆交易證明）、D3-C（改由 `contracts/` 的 validator 以 validity interval 強制）、D4-C（截止前只有雜湊，揭露期另有規則） |
| I2 排行榜上每個成績都能只用公開資料與鏈上資料重算出相同值，且重算不依賴產品程式碼 | `docs/verification.md`（規格與 golden vectors）；`packages/core` 的 `scoreForecasts`；`apps/server` 的 `exportRound`；`apps/verifier` 的 `verifyRound`（不連資料庫）；`verifier-ref/`（依規格另寫、不 import 產品程式碼）；`apps/web` 的排行榜只讀 `scoreForecasts` 的輸出 | D5（公式）、D10-B（私人預測不公開則無法重算） |
| I3 已登記的預測與修改歷史只增不改，不可選擇性隱藏 | 資料表 `forecast_events`（只 INSERT，無 UPDATE／DELETE 路徑）；`exportRound`（匯出全部事件）；`merkleRoot`（承諾全部事件） | D10-B（允許私人預測）、D3-B（承諾改為每筆交易，`merkleRoot` 不再是機制）、D4-C（事件改為雜湊加揭露兩段） |
| I4 判定規則在開放提交前固定並承諾上鏈 | `publishQuestion`（先承諾規則雜湊才開放）；`packages/chain` 的 `buildAnchorTx`；`verifyRound` 與 `verifier-ref/` 的規則雜湊比對 | D3-D（不上鏈） |
| I5 外部結果由營運者依事先約定的來源判定，判定紀錄本身公開並承諾；介面不宣稱鏈判定結果 | `resolveQuestion`、`voidQuestion`；判定紀錄的承諾（`anchorJob`）；`apps/web` 的驗證邊界文案；`README.md` 的 Verification boundaries 段 | D7（判定者與爭議流程） |
| I6 AI 參賽者的標籤與模型名稱是自我申報，不宣稱證明 | 參與者資料的 `kind` 欄位；`apps/web` 的參與者標示；Agent API 文件 | 無 |
| I7 鏈上只放雜湊、Merkle root 與格式版本號，不放個資或預測明文；主網上的承諾不可撤回 | `packages/core` 的 `canonicalize`；`packages/chain` 的 `buildAnchorTx`；`exportRound`（明文只在公開資料，不上鏈） | D3-B（參與者自送交易）、D3-D（不上鏈，整條不適用）、D2-B（葉節點加入簽章） |
| I8 承諾格式帶版本號；已承諾到 D9 選定網路的版本不得改變語意（本機 devnet 階段可直接改版） | `packages/core` 的 `ANCHOR_FORMAT_VERSION`、`canonicalize`；`verifyRound` 與 `verifier-ref/` 依版本號選擇解析方式 | D3-D（不上鏈）、D2-B、D4-C（格式改變時升版） |
| I9 營運者錢包私鑰不進版控、不寫進 log | `packages/chain` 的簽署器（只從環境變數或本機金鑰檔讀）；`.gitignore`；CI 的 secret scan（步驟 12） | D3-B（營運者不再簽承諾交易時範圍縮小） |
| I10 D4 選 B 或 C 時：截止前任何公開介面都讀不到他人的機率 | `apps/server` 的公開讀取 API；`exportRound`（只匯出已截止輪次）；`apps/web` 的題目頁；試辦期間的公開檔案（步驟 3） | D4（選 A 時整條不適用） |

## 範圍

- 做：前置（初始 commit、計畫進 repo、主清單指向）、題目與判定來源的可行性 spike、AI 參賽者成本 spike、手動試辦（D1 選 A 時）、鏈上承諾與 validator 的技術 spike、walking skeleton、四個垂直切片（題目、人類提交、AI 提交、判定與計分與戰績）、公開資料與依規格另寫的參考 verifier、硬化、在 D9 選定的網路上內部演練一輪。
- 不做：
  - 收款、分潤、預約；Token、NFT、下注、交易、加密貨幣獎金作為核心（來源 S11、S16、S17 的產品範圍限制）。
  - 證明 AI 標籤背後的模型身分（鏈上紀錄做不到，見 I6）；證明所有私下預測都已登記（S6）；由鏈自行判定外部結果（S5）。
  - 公開部署網站（來源未授權公開發布，S12；改列延後）。
  - 行動 App（來源沒有提到，網頁即可涵蓋需求清單）。
- 延後（收尾時搬回主清單）：
  - 公開發布與公開試辦季（R24）——觸發：步驟 13 內部演練通過，且擁有者授權公開發布；需求驗證於公開試辦季進行。
  - 公開託管與每月託管預算——觸發：公開試辦季啟動。
  - 主網承諾——觸發：D9 改選主網，或公開試辦季啟動。
  - 以 validator 強制截止（D3-C）——觸發：公開試辦季中出現對營運者截止後收件的質疑，或 D3 改選 C。
  - 錢包簽章的參與者層級（D2-B、D2-C）——觸發：試辦問卷有 ≥ 1/3 受訪者把「可獨立驗證」列為參加理由。
  - 多位判定者（D7-B）——觸發：任一季爭議件數 ≥ 已判定題數的 10%。
  - 多選與數值題（D6-C）——觸發：試辦問卷中要求非二元題的回覆 ≥ 1/3。
  - 中文介面——觸發：試辦參與者中中文使用者 ≥ 1/3。

## 步驟

- [x] **0. 前置：初始 commit、計畫進 repo、主清單指向**（被擋於：D1（選 A 或 B）；只有擁有者能確認的前提：初始 commit 與 push 的授權）
  - 範圍：擁有者完成 repo 的初始 commit 與 push（目前工作區的 `README.md`、`AGENTS.md`、`.gitignore`）；把本計畫與附件放進 `docs/plans/`；`.gitignore` 加上 `pilot/raw/` 與 spike 的本機金鑰路徑；在本機個人脈絡檔（不進版控）寫明主清單位置，並在主清單加一行指向本計畫。
  - 消費端：無（repo 尚無程式碼）
  - 不能動：`README.md`、`AGENTS.md` 的內容（只隨初始 commit 原樣提交）。
  - 驗收：`git log --oneline` 至少一筆；`git ls-files docs/plans/` 列出計畫檔與四份附件；`python3 docs/plans/2026-10-01-forecast-club-mvp/check_plan.py` 通過；`git check-ignore pilot/raw/x` 有輸出。mutation：把計畫中任一步驟的「驗收」欄位刪掉，`check_plan.py` 要失敗（附件已記錄的 8 種 mutation 任選一種重跑）。
  - 停止條件：擁有者未授權 commit 或 push → 停下等待。
  - 需要人做的事：初始 commit 與 push；建立本機個人脈絡檔的主清單指向，並在主清單加一行。
- [x] **1. Spike：題目與判定來源的可行性**（被擋於：D1（選 A 或 B）、步驟 0）
  - 範圍：回溯過去 8 週，寫 ≥ 30 題「短週期、可依公開來源判定」的科技題（例如開源專案是否在某日前發布新版本、套件 registry 是否出現某版本），每題寫判定規則與來源，再對照實際結果判定一次：可由公開 API 自動判定的用腳本（GitHub 未驗證 API，不帶 token）、其餘人工判定並記錄模糊之處。產出 `spikes/question-resolution.csv`（欄位：`id,question,rule,source_url,horizon_days,method,outcome,ambiguous,notes`）與摘要 `spikes/question-resolution.md`（自動判定比例、模糊比例、每題判定所需 API 請求數），摘要複製到本計畫附件的 `spikes/` 子目錄。
  - 消費端：無（拋棄式 spike，不產生產品介面）
  - 不能動：`README.md`、`AGENTS.md` 的範圍敘述。
  - 驗收：`python3 -c "import csv,sys; r=list(csv.DictReader(open('spikes/question-resolution.csv'))); assert len(r)>=30; assert all(all(v.strip() for k,v in x.items() if k!='notes') for x in r); assert {x['method'] for x in r}<={'auto','manual'}; assert {x['ambiguous'] for x in r}<={'yes','no'}; print(len(r))"` 通過；摘要的三個數字能由 CSV 重算（摘要附重算指令）。
  - 停止條件：完成樣本需要超過 60 requests/小時的 GitHub API 額度（需要 token，屬於秘密）→ 停下回報，不自行取得 token。
- [x] **2. Spike：AI 參賽者的來源與成本**（被擋於：D1（選 A 或 B）、步驟 0）
  - 範圍：(a) 估算營運者自跑 baseline 的費用：寫出一題的提示詞範本（題目、判定規則、截止時間，不含網路搜尋與含網路搜尋兩版），以字元數估 token 數，乘上 2–3 個候選模型在官方定價頁的單價與每週題數 × 預計更新次數，得出每月費用區間（記錄定價頁網址與查詢日期）。(b) 整理外部 Agent 參賽的介面先例（例如 Metaculus bot 錦標賽的提交方式），寫出本產品最小的 Agent 提交介面草案。產出 `spikes/ai-participants.md`，複製到本計畫附件的 `spikes/` 子目錄。不呼叫任何付費 API。
  - 消費端：無（拋棄式 spike）
  - 不能動：不註冊帳號、不呼叫付費 API。
  - 驗收：`spikes/ai-participants.md` 含「每月費用區間」表，每列有模型名稱、單價、來源網址、查詢日期、計算式；`grep -c "查詢日期" spikes/ai-participants.md` ≥ 2。
  - 停止條件：任一候選模型的官方定價頁需要登入才能看到 → 該模型標「未查到」，不登入。
- [ ] **3. 手動試辦（需求驗證）**（被擋於：D1（選 A）、D4、D5、D6、D7、D8、D10、步驟 0、步驟 1、步驟 2；只有擁有者能確認的前提：授權公開發布與聯絡使用者）
  - 範圍：不寫產品程式，跑 3–4 週，每週 5 題二元題（題型與來源依 D6）。代理準備：題目與規則文件、提交表單範本（管道依 D1 的結論）、依 D5 的計分腳本 `pilot/score.py` 與其測試、每輪截止時把該輪預測檔的 SHA-256 公開在 repo（截止前不公開他人機率時依 I10）、AI 參賽者依 D8（營運者 baseline 由擁有者授權後執行）、試辦後問卷（題目涵蓋 K1–K5）。產出 `pilot/report.md`：每輪人類與 AI 參與數、回訪率、提交轉換率、問卷結果，逐項對照 D1 的門檻。
  - 消費端：無（試辦工具不被產品程式依賴）
  - 不能動：試辦期間公開的題目規則與已公開的雜湊不得修改，需要更正時以新的公告記錄；原始提交資料（暱稱與帳號對應、聯絡方式、問卷原始回覆）只放 `pilot/raw/`（已被 `.gitignore` 涵蓋），repo 只公開雜湊與 D10 允許公開的欄位。
  - 驗收：`python3 -m pytest pilot/` 通過；mutation——(1) 把計分腳本的結果代入改成 `1 - outcome`，黃金測試要失敗；(2) 測試輸入含一筆截止後的預測、期望被排除，拿掉 `score.py` 的截止過濾後該測試要失敗（I1 的手動版）；(3) `git ls-files pilot/raw` 必須為空，把一個 raw 檔強制加入後 `check-ignore` 測試要失敗。`pilot/report.md` 對 D1 的每個門檻寫「達到／未達到」與數字。
  - 停止條件：第 1 輪人類參與者低於 D1 門檻的一半 → 停下回報，不繼續後續輪次；任何需要付費或註冊帳號的動作 → 停下等擁有者。
  - 需要人做的事：授權公開發布與聯絡使用者；授權每輪 commit 與 push 雜湊檔；在選定的社群管道發布題目；授權並執行營運者 baseline 的模型呼叫（付費）；確認是否達到門檻。
  - 完成後的狀態：未達門檻時，步驟 6 之後全部維持被擋，計畫交回擁有者決定（改題、改受眾或結束）。
- [ ] **4. Spike：鏈上承諾的成本、延遲與讀回**（被擋於：D1（選 A 或 B）、步驟 0）
  - 範圍：在 Yaci DevKit 本機 devnet 上，以 TypeScript ＋ Mesh 分別建構並送出 (a) 營運者批次承諾：metadata 放格式版本、輪次 id、32-byte Merkle root；(b) 單筆預測承諾：模擬參與者錢包送一筆含預測雜湊的交易；(c) 以 CIP-8 簽一筆預測並在 off-chain 驗章。量測交易大小、費用、到被收進區塊的時間（各 ≥ 5 次取中位數），並用 Blockfrost 相容 API 讀回比對。再在 Preprod 以 Koios public tier（不需金鑰）讀回與送出 (a) 至少 5 次，量測真實出塊延遲。產出 `spikes/anchoring.md`，複製到本計畫附件的 `spikes/` 子目錄。程式放 `spikes/anchoring/`。
  - 消費端：無（拋棄式 spike）
  - 不能動：不在主網送交易；不把任何金鑰寫進 repo（devnet 金鑰也放 `.gitignore` 涵蓋的位置）。
  - 驗收：`spikes/anchoring.md` 有 (a)(b)(c) 三列，每列有 bytes、lovelace、中位延遲秒數、讀回一致（是／否）、量測指令；Preprod 列附 5 個交易 id，任何人可在公開瀏覽器查到；`pnpm --dir spikes/anchoring test` 通過，其中包含 mutation：竄改 metadata 的 root 一個 byte 後讀回比對要失敗。
  - 停止條件：Docker 已安裝（2026-10-01 核對），若 Yaci DevKit 映像需要的資源或版本不符 → 停下回報；Preprod 讀回需要 Blockfrost key 才能完成 → 停下回報，不自行註冊。
  - 需要人做的事：從 Preprod faucet 領測試 ADA 到 spike 用的地址。
- [ ] **5. Spike：validator 強制截止的成本**（被擋於：D1（選 A 或 B）、步驟 0）
  - 範圍：以 Aiken 寫最小的 validator：題目 UTxO 的 datum 帶截止 slot，新增預測的交易只有在 validity interval 上界早於截止時才通過。在 Yaci DevKit 上量測執行單位、費用、每題與每筆預測需要鎖的 min-UTxO ADA，與 (a) 比較。產出 `spikes/validator.md`，複製到本計畫附件的 `spikes/` 子目錄。程式放 `spikes/validator/`。
  - 消費端：無（拋棄式 spike）
  - 不能動：不部署到 Preprod 以外的網路。
  - 驗收：`aiken check`（在 `spikes/validator/`）通過，包含兩個測試：截止前的交易通過、validity 上界超過截止的交易被拒；mutation——把比較運算子改成 `<=` 以外的錯誤方向，拒絕測試要失敗；`spikes/validator.md` 有執行單位、費用、min-UTxO 三個數字與量測指令。
  - 停止條件：Aiken 需要安裝而未獲授權 → 停下等授權。
  - 需要人做的事：授權安裝 Aiken 編譯器（若未安裝）。
- [ ] **6. Walking skeleton**（被擋於：D1、D2、D3、D4、D5、D10、D12、步驟 0、步驟 3（D1 選 A 時需達門檻）、步驟 4、步驟 5（D3 選 C 時））
  - 範圍：依 D12 建 workspace 與預計模組，並以版本鎖定檔固定執行環境版本（本機目前是 Node `v25.9.0`）；`Makefile` 的 `check` 目標跑 format、lint、typecheck、單元測試與 `e2e-devnet`（啟動 Yaci DevKit 容器）；GitHub Actions `ci.yml` 在 push 到 `main` 時跑 `make check`。接通最薄的一條端到端路徑 `scripts/e2e-round.ts`：fixture 題目 → 一位 fixture 人類與一位 fixture AI 經 server API 各交一筆預測 → `closeRound` → 依 D3 承諾到 devnet → 依 fixture 來源判定 → 依 D5 計分 → `exportRound` 匯出 → `verifyRound` 只讀匯出檔與 devnet 重算，與 server 的成績一致；`docs/verification.md` 初版附 golden vectors（輸入事件、期望 Merkle root、期望分數）。指令跑過後更新 `README.md` 的 Development 段與 `AGENTS.md`（S21）。
  - 消費端：無（repo 尚無程式碼）。完成後在步驟 7–13 的消費端指令補上實際路徑。
  - 不能動：`README.md` 與 `AGENTS.md` 的範圍與驗證邊界敘述（只能補 Development 段與指令）；承諾格式從第一版就帶 `ANCHOR_FORMAT_VERSION`（I8）。
  - 驗收：`make check` 本機通過；GitHub Actions 的 `check` job 結論為 success。mutation（各自都要讓 `make check` 失敗）：(1) 把匯出檔中一筆預測的機率改掉，`verifyRound` 要回報不一致並以非零結束；(2) 讓 `merkleRoot` 少算一筆事件；(3) 讓 `submitForecast` 接受截止後的預測；(4) 在 `scoreForecasts` 把結果代入改成 `1 - outcome`。
  - 停止條件：Yaci DevKit 無法在 GitHub Actions 上執行 → 停下回報（替代方案是 Mesh 的 emulator，屬於驗收方式的改變，交擁有者決定）；D3 的結論在 devnet 上無法實作 → 停下回報。
  - 需要人做的事：授權 commit 與 push；確認 GitHub Actions 已啟用。
- [ ] **7. 切片：題目發布與判定規則承諾**（被擋於：D6、步驟 6）
  - 範圍：營運者以 server 的 admin CLI 建立一週的題目批次（題型與來源依 D6）；`publishQuestion` 先把規則的雜湊承諾上鏈，確認後才開放提交（I4）；`apps/web` 的題目列表與題目頁顯示題目、截止時間、判定規則與來源。滿足 R1、R10、R16、R18。
  - 消費端：`rg -n "publishQuestion|anchorRules|QuestionSchema" apps packages scripts docs`
  - 不能動：已承諾到 D9 選定網路的格式語意（I8；本機 devnet 階段改格式要升 `ANCHOR_FORMAT_VERSION` 並更新 golden vectors）；`verifyRound` 的既有檢查。
  - 驗收：`make check` 通過；e2e 新增「題目從建立到開放」的路徑。mutation：(1) 讓 `publishQuestion` 跳過規則承諾直接開放，e2e 要失敗；(2) 開放後改規則文字，`verifyRound` 要回報規則雜湊不符。
  - 停止條件：D6 的判定來源需要帶 token 的 API → 停下回報。
- [ ] **8. 切片：人類參與者提交與修改預測**（被擋於：D2、D4、D10、步驟 7）
  - 範圍：依 D2 的登入方式；依 D4 的可見性提交與修改機率（機率範圍依 D5）；每次修改寫成新的 `forecast_events`（I3）；參加前取得 D10 規定的同意；session 依 F8。滿足 R2、R11、R12。
  - 消費端：`rg -n "submitForecast|forecast_events|ForecastEvent|session" apps packages scripts docs`
  - 不能動：`forecast_events` 只 INSERT；`scoreForecasts` 的介面。
  - 驗收：`make check` 通過；mutation：(1) 修改預測改成 UPDATE 舊列，歷史測試要失敗；(2) D4 選 B 或 C 時，截止前從公開 API 讀到他人機率，可見性測試要失敗；(3) 未同意 D10 條款即可提交，測試要失敗；(4) 登入後未更換 session id，測試要失敗。
  - 停止條件：D2 的登入方式需要註冊外部 OAuth app → 停下等擁有者註冊。
  - 需要人做的事：註冊 OAuth app 或寄信服務（依 D2）。
- [ ] **9. 切片：AI 參賽者**（被擋於：D2、D8、步驟 2、步驟 7）
  - 範圍：依 D8 開放外部 Agent 以 API 提交（每個 Agent 一把 token，可撤銷）及／或營運者 baseline runner；AI 標籤顯示為自我申報（I6）；Agent API 文件。滿足 R8。
  - 消費端：`rg -n "agentToken|submitForecast|participantKind|baselineRunner" apps packages scripts docs`
  - 不能動：`submitForecast` 的截止規則（I1）與事件格式；人類與 AI 走同一條提交路徑。
  - 驗收：`make check` 通過；mutation：(1) Agent A 的 token 能替 Agent B 提交，測試要失敗；(2) 截止後的 Agent 提交被接受，測試要失敗；(3) baseline runner 在測試中呼叫真實付費 API（應只用替身），測試要失敗。
  - 停止條件：baseline 每月費用估計超過 D8 訂的上限 → 停下回報。
  - 需要人做的事：baseline 的模型 API key 與費用授權（D8 含 B 時）。
- [ ] **10. 切片：判定、爭議、計分與戰績**（被擋於：D5、D6、D7、步驟 8、步驟 9）
  - 範圍：`resolveQuestion`（自動來源與人工判定並附證據）、依 D7 的爭議期與 `voidQuestion`；判定紀錄承諾上鏈（I5）；`scoreForecasts` 依 D5；個人戰績頁、可分享連結、人類 vs AI 比較；驗證邊界文案（R6）。滿足 R3–R6、R13、R15、R19–R21。
  - 消費端：`rg -n "resolveQuestion|voidQuestion|scoreForecasts|anchorResolution|leaderboard" apps packages scripts docs`
  - 不能動：`scoreForecasts` 是 server 與 verifier 共用的唯一實作（I2）；已承諾的判定只能由 D7 規定的爭議紀錄改變。
  - 驗收：`make check` 通過；`scoreForecasts` 有黃金測試（固定輸入、手算的期望分數）；mutation：(1) 作廢題仍計分，測試要失敗；(2) 判定在承諾後被改且沒有爭議紀錄，`verifyRound` 要失敗；(3) 計分公式改成 `abs(p - o)`，黃金測試要失敗；(4) 移除頁面上的驗證邊界文案，頁面快照測試要失敗。
  - 停止條件：D5 的規則在邊界情況（未提交時段、作廢、機率 0 或 1）有規格沒寫的分歧 → 停下回報，不自行決定。
- [ ] **11. 切片：公開資料與獨立 verifier**（被擋於：D10、步驟 10）
  - 範圍：完成 `docs/verification.md`（匯出格式、`canonicalize` 規則、Merkle 建法、承諾 metadata 格式、計分公式與邊界規則、golden vectors），讓第三方不讀程式碼也能實作 verifier；依規格以與產品不同的語言另寫 `verifier-ref/`（不 import 產品程式碼），兩個 verifier 都要通過 golden vectors；依 D10 的公開範圍提供匯出檔。`make verify-clean` 的定義：以只含 `verifier-ref/` 與其相依套件的容器映像執行，輸入是掛載到 `/data` 的匯出檔，鏈資料在 CI 取自同一 job 啟動的 Yaci DevKit、在步驟 13 取自 Koios public tier；容器內沒有資料庫、沒有產品原始碼。滿足 R9、R22。
  - 消費端：`rg -n "exportRound|canonicalize|merkleRoot|verifyRound|ANCHOR_FORMAT_VERSION" apps packages scripts docs verifier-ref`
  - 不能動：已承諾資料的格式語意（I8）；`scoreForecasts` 的結果。
  - 驗收：`make check` 與 `make verify-clean` 通過，`verifier-ref/` 與 `verifyRound` 對 golden vectors 與 devnet 演練資料的輸出相同；mutation：(1) 竄改匯出檔的四種方式——調換兩筆事件的時間順序、刪掉一筆預測、改一筆機率、改一題規則文字——各自都要讓兩個 verifier 以非零結束；(2) 把產品 `scoreForecasts` 的公式改成 `abs(p - o)`，`verifier-ref/` 與排行榜的比對要失敗（證明重算不依賴產品程式碼）；F2：在本機以 500 位參與者 × 20 題的合成資料跑 `verifier-ref/` ≤ 60 秒（`time` 的輸出與機器規格記入進度表）。
  - 停止條件：D10 的公開範圍讓第三方無法重算某類成績 → 停下回報（這表示 D10 與 I2 衝突）。
- [ ] **12. 硬化：金鑰、重試、監看與對抗測試**（被擋於：D2、步驟 11）
  - 範圍：營運者簽署金鑰只從環境變數或本機金鑰檔讀（I9），CI 加 secret scan；`anchorJob` 冪等（同一輪重跑只會有一筆有效承諾）、交易未被收進區塊時重送；錨定與判定失敗的結構化 log 與 `make ops-check`（F9）；依 D2 的防刷措施（R26）；在 Preprod 量測 F1。對抗測試清單與擋住它的機制：截止後送件（`submitForecast`、I1）、竄改歷史（`forecast_events` 只增、verifier）、重放或盜用 Agent token（token 綁定 Agent 與撤銷）、同一人多帳號（依 D2 的帳號限制；D2 選的方式擋不住時列為「本階段不防」）。本階段不防、只在文案與匯出資料揭露的：營運者在承諾前遺漏某筆預測（D3-A 的已知限制）、冒用 AI 標籤（I6，自我申報）。滿足 R25–R27。
  - 消費端：`rg -n "buildAnchorTx|submitAnchor|anchorJob|OPERATOR_SIGNING_KEY|rateLimit" apps packages scripts .github`
  - 不能動：承諾格式語意；`forecast_events` 只增不改。
  - 驗收：`make check` 與 `make ops-check` 通過；mutation：(1) 在測試 fixture 放一把假的私鑰字串，secret scan 要失敗；(2) 測試模擬 `anchorJob` 在送出後、記錄前中斷再重跑，期望同一輪只有一筆承諾；拿掉 `anchorJob` 送交易前查詢鏈上既有承諾的檢查後，該測試要失敗；(3) 對抗清單中「有機制」的每一項各有一個測試，移除對應機制後該測試要失敗；「本階段不防」的兩項，頁面與 `docs/verification.md` 的揭露文案有快照測試，刪掉文案後測試要失敗；F1 的量測（5 次中位數）記入進度表。
  - 停止條件：F1 在 Preprod 量測超過 60 分鐘 → 停下回報，F1 門檻交擁有者重訂。
  - 需要人做的事：確認 F1、F6、F9 的提案門檻；Preprod 測試 ADA。
- [ ] **13. 內部演練一輪**（被擋於：D9、步驟 12）
  - 範圍：在 D9 選定的網路上，以內部 fixture 參與者（不對外公開）跑完一輪：發題、承諾規則、人類與 AI 各 ≥ 3 位提交與修改、截止承諾、判定（含一題作廢）、計分、匯出，最後在乾淨環境跑 `verifyRound`。產出 `docs/plans/2026-10-01-forecast-club-mvp/dry-run.md`：交易 id、費用、延遲、verifier 輸出。
  - 消費端：`rg -n "NETWORK|networkId|BLOCKFROST|KOIOS" apps packages scripts .github`
  - 不能動：不對外發布、不聯絡使用者；D9 選 A 時不在主網送交易。
  - 驗收：`make verify-clean ROUND=<演練輪次>`（以 `verifier-ref/`、Koios public tier）以 0 結束，輸出的成績與網站排行榜逐列相同（以腳本 diff，diff 為空）；mutation：把匯出檔的一筆機率改掉後重跑，必須以非零結束；`dry-run.md` 記錄測試網手續費，實際花費（法幣或主網 ADA）符合 F3。
  - 停止條件：verifier 結果與排行榜不一致 → 停下，回到對應步驟修正，不改 verifier 去遷就。
  - 需要人做的事：測試 ADA（Preprod）或購買 ADA（D9 選主網時）；Blockfrost key（若改用 Blockfrost）。
- [ ] **14. 收尾**（被擋於：步驟 13，或步驟 3 結論為不繼續）：完成定義逐項核對；獨立設計審查（design-review skill）；長期檢查接進 CI（`make check` 已在 CI；`verify-clean`、golden vectors 與 secret scan 確認在 `ci.yml`；本附件的 `check_plan.py` 是一次性檢查，不進 CI）；「延後」各項附觸發條件搬回主清單；`README.md` 的 Status 段改為實況（R29），不寫成已上線或已驗證需求；刪除或歸檔 `spikes/`；需要人做的事列給擁有者。驗收：`python3 docs/plans/2026-10-01-forecast-club-mvp/check_plan.py` 通過；design-review 的每個發現有「改、記、提、駁回」之一；取最新 run id（`gh run list --workflow ci.yml --limit 1 --json databaseId --jq ".[0].databaseId"`）後，`gh run view <run-id> --json jobs --jq '.jobs[]|select(.name=="check")|.conclusion'` 輸出 `success`；擁有者確認主清單有本計畫延後項的對應行。

## 決定

- **D1 是否啟動，以及是否先手動試辦驗證需求**（狀態：已決，2026-10-01，Will；擋住步驟：0–14；需要的事實：無）
  - A：先手動試辦 3–4 週，再決定是否建置——成本最低，直接回答 K1–K3、K5；需要公開發布與聯絡使用者（來源寫明尚未授權）；試辦的可驗證性弱（只有 repo 的雜湊與 commit 時間）。業界稱 concierge／Wizard-of-Oz MVP。（建議）建議的繼續建置門檻：第 1 輪 ≥ 15 位人類參與者、第 3 輪仍有 ≥ 40% 回來、至少 1 個外部 AI Agent 參加；門檻與發布管道由擁有者確認。
  - B：跳過試辦，直接做 spike 與 MVP——較早有可展示、可驗證的系統；建置規模是步驟 4–13 共 10 個步驟，每步至少一個 session，比試辦（步驟 1–3）大一個量級；在沒有需求證據下投入建置，與來源「先找使用者再決定產品化」的條件不一致。
  - C：不啟動，維持構想——零成本；本計畫凍結。
  - 結論：B：跳過手動試辦，直接做 spike 與 MVP；ADR：待前置完成後補記

- **D2 參與者身分**（狀態：未決；擋住步驟：6、8、9、12；需要的事實：步驟 3 的問卷（K5）、步驟 4 的 CIP-8 結果）
  - A：GitHub OAuth 或 email magic link，由營運者代為承諾——門檻最低，GitHub 帳號貼近科技社群、帳齡可用於防刷；營運者理論上能偽造某帳號的預測，第三方只能信任營運者的帳號紀錄。（建議，若問卷沒有顯示可驗證性是參加理由）
  - B：Cardano 錢包（CIP-30）以 CIP-8 簽署每筆預測，營運者承諾已簽章的紀錄——第三方能驗證預測確由該金鑰提交、營運者無法偽造；使用者要有錢包，有硬體錢包不支援的回報（E7），對非加密社群門檻高。
  - C：A 為預設，B 為可選的「已簽章」層級——兼顧兩種族群；資料模型與 verifier 要支援兩種身分，複雜度最高。（建議，若試辦問卷有 ≥ 1/3 受訪者把「可獨立驗證」列為參加理由）
  - 結論：未決；ADR：無

- **D3 鏈上承諾模型**（狀態：未決；擋住步驟：6–14；需要的事實：步驟 4、步驟 5）
  - A：營運者批次承諾——每天與每次截止時把該期間所有事件的 Merkle root 寫進交易 metadata，明文放公開資料——費用極低（約 0.17 ADA／筆，E2），使用者不需錢包；順序只精確到承諾間隔，營運者可在承諾前竄改或遺漏尚未承諾的事件（搭配 D2-B 可擋偽造，擋不了遺漏）。（建議）
  - B：每筆預測由參與者自付一筆交易——存在與順序都由鏈證明，營運者無法遺漏；每筆約 0.17 ADA 由參與者負擔且需持有 ADA，與「加密貨幣不是核心」的定位有張力，每個 AI Agent 都要有錢包。
  - C：Aiken validator 管理題目狀態，以 validity interval 強制截止——規則由合約強制，營運者無法在截止後收件；開發與稽核成本最高，每題要鎖 min-UTxO，合約上主網後不可改（不可逆）。
  - D：不上鏈，改用公開透明紀錄（簽章 commit 或時間戳服務）——最便宜；與來源以 Cardano 留下紀錄的產品定位衝突，選它要先改 `README.md` 與範圍。
  - 結論：未決；ADR：無

- **D4 截止前預測的可見性（commit-reveal）**（狀態：未決；擋住步驟：3、6、8、9；需要的事實：D3 的結論（試辦只用 A 或 B 的手動版，可先拍試辦用的可見性））
  - A：即時公開——最透明、最簡單；人類與 AI 可以互抄（AI 可直接讀群眾平均），「人類 vs AI」的比較失去意義。
  - B：截止前不公開、截止後揭露，承諾只放雜湊（營運者代為 commit-reveal）——參與者互相看不到；營運者自己看得到全部，需信任營運者不洩漏。（建議）
  - C：參與者端 commit-reveal：提交時只送加 salt 的雜湊，截止後由參與者揭露——營運者也看不到；未揭露的預測怎麼算成為新的規則問題，網頁與 Agent 都多一步，Foresight Arena 採此設計但只有模擬結果（`precedents-and-risks.md`）。
  - 結論：未決；ADR：無

- **D5 計分規則**（狀態：已決，2026-10-01，Will；擋住步驟：3、6、10；需要的事實：無）
  - A：Brier score，每題取截止時最後一筆預測——直觀（0 最好，0.25 等於喊 50%）、有界；不獎勵早而準，鼓勵最後一刻才交。
  - B：Brier score，在題目開放期間做時間加權平均（每段時間以當時有效的預測計分；尚未提交的時段不計分，排名以參與題的平均並顯示參與題數）——獎勵早而準，Good Judgment 類平台的做法；verifier 要重現時間軸，未提交時段的規則要寫進 `docs/verification.md`。（建議，機率限制在 [0.01, 0.99]）
  - C：Log score 或 Metaculus 式 Baseline／Peer score——對自信的錯誤懲罰重，Peer score 可直接比較人類與 AI；log 對 0 或 1 無界需截斷，一般使用者較難理解。
  - 結論：A：Brier score，每題只計截止前最後一筆有效預測；ADR：待前置完成後補記

- **D6 題型、題目範圍與判定來源**（狀態：已決，2026-10-01，Will；擋住步驟：3、7、10；需要的事實：步驟 1）
  - A：只出二元題，且只出能由公開 API 自動判定的題（GitHub release、套件 registry）——判定可自動化、爭議少、第三方可重跑判定；題目多樣性低，可能不夠吸引人。
  - B：二元題，來源可以是任何事先指定的公開網頁，由營運者人工判定並附證據快照——題目吸引力高；需要爭議流程（D7），第三方只能核對證據而無法重跑。
  - C：再加上多選與數值題——表達力最高；計分、資料模型與 verifier 都更複雜。
  - 建議組合：A 為主，B 每輪至多 1–2 題（比例依步驟 1 的模糊率調整）；題目期限 ≤ 4 週（「短週期」的推論）。（建議）
  - 結論：A：只出二元題，且只採公開 API 可自動判定的題目；ADR：待補記

- **D7 爭議、模糊結果與作廢**（狀態：已決，2026-10-01，Will；擋住步驟：3、10；需要的事實：步驟 1 的模糊率）
  - A：營運者依規則判定並公開證據，設 7 天爭議期；規則無法判定時作廢（不計分），作廢理由公開並承諾上鏈——簡單；最終仍要信任營運者。（建議）
  - B：多位判定者（例如 3 人中 2 人同意）——降低單一營運者偏誤；初期難以招募判定者。
  - C：只允許可自動判定的題（與 D6-A 綁定），不設爭議流程——人工最少；題型受限，自動來源本身出錯時沒有救濟。
  - 結論：A：營運者依預定規則判定並公開證據，設 7 天爭議期；無法判定時作廢且不計分，作廢理由公開並承諾上鏈；ADR：待補記

- **D8 AI 參賽者的來源與費用**（狀態：未決；擋住步驟：3、9；需要的事實：步驟 2）
  - A：只開放外部 Agent 經 API 參加——營運者沒有模型費用；初期可能沒有任何 AI 參加，「人類 vs AI」不成立。
  - B：營運者自跑 1–3 個模型 baseline——每題都有 AI 預測；有持續的付費 API 費用，營運者自己參賽有利益衝突的觀感。
  - C：A＋B，baseline 標示「營運者執行」——兼顧冷啟動與開放；費用同 B，需要每月上限。（建議，上限由擁有者在步驟 2 後訂）
  - 結論：未決；ADR：無

- **D9 本階段的目標網路**（狀態：未決；擋住步驟：13；需要的事實：步驟 4）
  - A：Preprod 測試網——免費；測試網紀錄不是正式紀錄，公信力弱，但足夠內部演練。（建議）
  - B：主網——正式且不可撤回；要購買 ADA（付費），承諾格式上主網後語意不能改（I8）。
  - 結論：未決；ADR：無

- **D10 預測資料的公開範圍與個資**（狀態：已決，2026-10-01，Will；擋住步驟：3、6、8、11；需要的事實：無）
  - A：所有已登記預測（含修改歷史）以公開暱稱永久公開，參加前明示同意；刪除請求只刪暱稱與帳號的對應，不刪預測紀錄——完整戰績可驗證（I3）；有人會因此不參加（K3）。（建議）
  - B：允許私人參與，私人預測不進排行榜也不公開——門檻低；選擇性公開讓「完整戰績」失去意義，也讓人只公開好成績，與 I3 衝突。
  - C：預測一律在截止後公開，但個人可選擇不列入排行榜——折衷；要定義「不列名」與可重算之間的關係。
  - 結論：A：截止後以公開暱稱永久公開所有預測與修改歷史；參加前明示同意，刪除請求只解除暱稱與帳號的對應；ADR：待前置完成後補記

- **D11 收款等項目是「不在範圍」還是「不作為核心」**（狀態：已決，2026-10-01，Will；擋住步驟：無（本階段兩種解讀都不做收款），影響「延後」與 `README.md` 用詞；需要的事實：無）
  - A：依 `README.md`：收款、分潤、預約完全不在產品範圍——最清楚，與現有公開文件一致。（建議，至少到需求驗證完成）
  - B：依產品構想筆記：不作為核心，非核心收入（例如贊助、付費進階功能）之後可評估——保留產品化彈性；`README.md` 要改寫。
  - 結論：A：收款、分潤、預約完全排除於產品範圍；ADR：待前置完成後補記

- **D12 產品技術棧**（狀態：未決；擋住步驟：6–13；需要的事實：步驟 4、5（spike 用 TypeScript ＋ Mesh 的實測結果））
  - A：TypeScript 全端（Node.js LTS、pnpm workspace、Mesh SDK、Postgres、Vitest），`verifier-ref/` 用 Python——前後端與交易建構同一語言，Mesh 附 CIP-30 錢包元件（E9）；參考 verifier 換語言可順便證明規格自足。（建議）
  - B：TypeScript ＋ Lucid Evolution，其餘同 A——交易建構 API 較精簡；錢包 UI 要自己接。
  - C：後端用 Go 或 Python（例如 PyCardano），前端 TypeScript——後端語言可依熟悉度選；兩種語言、兩套交易建構工具，walking skeleton 成本較高。
  - 結論：未決；ADR：無

拍板順序：

1. 已決：**D1-B**、**D11-A**（2026-10-01，Will）。
2. 已決：**D10-A**、**D5-A**（2026-10-01，Will）。步驟 0–2 已完成；其餘決定依 spike 證據拍板。
3. D6-A、D7-A 已決（2026-10-01，Will）；步驟 2 已完成，下一題為 D8。D1 選 A 時，試辦用的 D4（只在 A、B 之間選）連同 D5–D8、D10 全部拍完才開始步驟 3。
4. 步驟 4、5 完成後：D3、D12；接著 D4（產品版）、D9 同一批；D2 等步驟 3 的問卷（D1 選 B 時與 D4 同批）。步驟 6 開工前 D2、D3、D4、D5、D10、D12 都要已決。

## 進度

狀態值：未開始／進行中／程式完成待驗收／完成／不執行（附決定）。

| 步驟 | 狀態 | 已跑的驗收 | 未跑的驗收與原因 | commit |
|---|---|---|---|---|
| 0 前置 | 完成 | 初始 commit `82112c6`；計畫檢查通過；缺少驗收欄位的 mutation 被拒；raw 與本機金鑰 ignore 生效；主清單指向已建立 | 無 | `82112c6`；計畫提交見 git log |
| 1 題目與判定來源 spike | 完成 | 40 題欄位檢查；32/40 自動、0/40 模糊、1 request/自動題重算；時間邊界與 draft/prerelease fixture 通過；摘要已複製到附件 | 無（窄樣本的限制見摘要） | 見 git log -- spikes/ |
| 2 AI 參賽者成本 spike | 完成 | 三模型官方價格、查詢日期與公式齊全；離線重算 JSON 與提示詞；摘要複本一致 | 未呼叫模型；token 用量、品質與帳號權限未實測（本步驟不要求） | 見 git log -- spikes/ai-participants.md |
| 3 手動試辦 | 不執行（D1-B） | 不適用 | 不適用 | |
| 4 鏈上承諾 spike | 未開始 | | | |
| 5 validator spike | 未開始 | | | |
| 6 Walking skeleton | 未開始 | | | |
| 7 題目發布 | 未開始 | | | |
| 8 人類提交 | 未開始 | | | |
| 9 AI 參賽者 | 未開始 | | | |
| 10 判定與計分 | 未開始 | | | |
| 11 公開資料與 verifier | 未開始 | | | |
| 12 硬化 | 未開始 | | | |
| 13 內部演練 | 未開始 | | | |
| 14 收尾 | 未開始 | | | |

## 壓力測試紀錄

2026-10-01，一個沒參與撰寫的唯讀審查者，以 phase-plan 的固定審查提示詞檢查草稿，共 16 個發現（高 3、中 8、低 5）。處理如下；檢查腳本 `check_plan.py` 修改後重跑通過，10 種 mutation 都會讓它失敗，另有一種「spike 摘要不在檢查範圍」的情境預期通過，結果也是通過。

| # | 發現（嚴重度） | 處理 |
|---|---|---|
| 1 | 步驟 12 的對抗清單裡，有幾項計畫本身沒有防護，「移除防護要失敗」做不出來（高） | 改：每項標出擋住它的機制。「營運者遺漏」「冒用 AI 標籤」標為本階段不防，改驗收揭露文案的快照測試 |
| 2 | I2 的 server 與 verifier 共用 `scoreForecasts`，步驟 13 的 diff 必然為空，「獨立」說不通（高） | 改：新增 `verifier-ref/`，依規格以另一種語言撰寫，不 import 產品程式碼；`docs/verification.md` 附 golden vectors；步驟 11 加入「改產品公式，比對要失敗」的 mutation；步驟 13 改用 `verifier-ref/` |
| 3 | 沒有步驟把計畫搬進 repo；初始 commit 晚於試辦需要 push 的時點（高） | 改：新增步驟 0（初始 commit、計畫進 `docs/plans/`、`.gitignore`、主清單指向）。步驟 1–6 都被步驟 0 擋住；步驟 3 加上每輪 push 的授權 |
| 4 | `gh run list` 看不到 job 的結論（中） | 改：步驟 14 改用 `gh run view <id> --json jobs` 取 `check` job 的 conclusion |
| 5 | 主清單指向的本機個人脈絡檔不存在，步驟 14 找不到核對對象（中） | 改：步驟 0 建立指向並在主清單加一行；步驟 14 改為擁有者確認。計畫內仍不寫 repo 外的路徑（公開 repo） |
| 6 | 技術棧在來源是待決，計畫卻寫成預設（中） | 改：新增 D12，擋住步驟 6–13；只有拋棄式 spike 的工具維持預設 |
| 7 | 來源裡擁有者個人規劃的條件沒有收錄（中） | 部分駁回：這些是擁有者的個人規劃脈絡，不屬於產品需求，依公開文件規則不寫進本計畫，由擁有者拍 D1 時自行納入。已在 D1-B 補上產品面的建置規模（步驟 4–13 共 10 步） |
| 8 | 試辦的原始個資可能進公開 repo；D4 沒有擋住步驟 3（中） | 改：步驟 3 的「不能動」規定原始資料只放 `pilot/raw/`（ignore），加上對應的 mutation；D4 改為也擋步驟 3，拍板順序註明試辦用的可見性要先拍 |
| 9 | 步驟 3、12 各有一個 mutation 不是針對程式碼（中） | 改：步驟 3 改為拿掉截止過濾要失敗；步驟 12 改為拿掉送出前查詢既有承諾的檢查要失敗 |
| 10 | 不變量沒有標出會改寫它的決定；缺少截止前可見性的不變量（中） | 改：不變量表加「會改寫它的決定」欄；新增 I10 |
| 11 | 步驟 6 定下格式，卻沒有被 D2、D10 擋住（中） | 改：步驟 6 加擋 D2、D10、D12；I8 與步驟 7 改為「已承諾到 D9 網路的格式才凍結，本機 devnet 階段可升版」 |
| 12 | Goal 寫「D1 選 C 停在步驟 3」，與 C 不試辦矛盾（低） | 改：選 C 時計畫凍結；未達門檻時停在步驟 3 |
| 13 | F3 的門檻 0 與測試網手續費矛盾（低） | 改：F3 只限制實際花費（法幣或主網 ADA），tADA 只記錄 |
| 14 | `make verify-clean` 的定義有兩種讀法；F2 沒寫在哪台機器量測（低） | 改：寫明容器內容、`/data` 掛載、CI 與步驟 13 各自的鏈資料來源；F2 在本機量測並記錄機器規格 |
| 15 | 本機環境沒有核對（Node `v25.9.0`、未安裝 Aiken、已有 Docker）（低） | 改：前提段補上核對結果；步驟 6 加版本鎖定；步驟 4 的 Docker 停止條件改寫 |
| 16 | `check_plan.py` 會掃描複製進附件目錄的 spike 摘要，造成誤報（低） | 改：腳本只檢查固定的四份附件；spike 摘要放 `spikes/` 子目錄；新增對應的 mutation |
