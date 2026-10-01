# 題目與判定來源 spike

核對日期：2026-10-01。來源 commit：`b0b3983`。本次是回溯可行性分析，沒有真實參與者或前瞻預測。

## 樣本與結果

固定選定 10 個科技專案，每個使用 4 個連續、互不重疊的 14 天窗口，覆蓋 2026-08-06（含）至 2026-10-01（不含），合計 40 題。窗口不依結果挑選；專案為便利樣本，不代表所有科技事件。

- 自動判定：32/40＝80%。8 個專案使用 GitHub Releases API。
- 人工判定：8/40＝20%。Go、CPython 使用官方發布歷史頁面。
- 規則明確後仍無法判定：0/40＝0%。這只適用於發布日期類題，不能外推成其他事件沒有爭議。
- 結果：24 題 Yes、16 題 No。
- 每題獨立自動判定需要的 API 請求：平均 1、最大 1（本次各 repo 的第一頁已涵蓋窗口起點）；以 CSV notes.pages 重算。正式運行必須處理 pagination 與較高發布頻率。
- 本次 GitHub 實際查詢共 12 次：初始 Node 查詢 1、10 個候選 repo 查詢 10、替換 git/git 的 FastAPI 查詢 1。腳本 evidence.requests=11 不含初始探索的額外 Node 查詢。未使用 token。另人工查閱兩個官方網站，不計入 GitHub API 額度。
- 推估每週 20 題、每題截止後只查一次需約 20 次 API 請求；不能解讀為每小時輪詢也足夠，且 60 次額度按 IP 共用。

## 判定邊界與實際觀察

1. Go、CPython 的 GitHub Releases 清單為空，但官方網站存在發布紀錄；git/git 也回空清單，本次不把它當作負例題，改採 FastAPI。GitHub Releases、git tags、registry 與官方發布各有不同語意。每題只指定一個權威來源，不能用空清單推論專案沒有發布。
2. 自動題排除 draft/prerelease，以 published_at、UTC 半開窗口判定；官方網頁題依來源顯示的日曆日期，沒有擅自假定 UTC 小時。正式題須在開放前寫明時間語意。
3. API 分頁與資料空缺不能直接當 No；本次保存必要 metadata，檢查頁數足以覆蓋期間。GitHub 公開資料會被修改或刪除，這份快照只證明抓取時可見的紀錄；尚未測試上游刪除或回填資料的爭議流程。
4. 樣本全部是「發布」事件；沒有量測「模型能力達標」「公司宣布功能」等主觀事件，也沒有驗證題目吸引力。人工題比例由樣本設計決定，不是自動化覆蓋率的無偏估計。
5. 0% 模糊率不支持省略爭議流程；API 故障、來源更正與取證時點仍需 D7 決定。

## 可重跑驗收

在 repo 根目錄執行（路徑相對 repo）：

```sh
python3 spikes/question_resolution.py
python3 -c 'import csv,json; r=list(csv.DictReader(open("spikes/question-resolution.csv"))); a=[x for x in r if x["method"]=="auto"]; assert len(r)>=30; assert all(all(v.strip() for k,v in x.items() if k!="notes") for x in r); assert {x["method"] for x in r}<={"auto","manual"}; assert {x["ambiguous"] for x in r}<={"yes","no"}; print("n",len(r),"auto",len(a)/len(r),"ambiguous",sum(x["ambiguous"]=="yes" for x in r)/len(r),"requests/auto-question",sum(json.loads(x["notes"])["pages"] for x in a)/len(a))'
```

第一條使用保存的公開 metadata 與人工摘錄重建 CSV，不呼叫 API。`--fetch` 才重抓；會消耗共用額度且來源可能已變動。邊界驗收：起點算入、截止點排除、draft/prerelease 排除，fixture 已跑過。

## 拍板建議

- D6：二元題，API 判定為主，每輪最多 1–2 題來自事先指定的官方公開網頁；期限 ≤4 週。這讓 Go、Python 等專案也能納入；題目吸引力仍待公開試辦。
- D7：保留營運者依規則與證據判定、7 天爭議期及無法判定時作廢的方案；這份窄樣本不能支持取消救濟。

## 來源與重取方式

- 自動題 URL 逐題列於 CSV；`question_resolution.py --fetch` 以無 Authorization header 的 GitHub API 重取。
- [Go Release History](https://go.dev/doc/devel/release)：查閱發布版本與日期，相關事實摘錄於 question-resolution-manual.json。
- [Python Downloads](https://www.python.org/downloads/)：同上；只記錄窗口內穩定版本與日期。
- question-resolution-evidence.json：只保存 id、tag、發布時間、draft/prerelease 與 URL；不保存 release note 本文。
