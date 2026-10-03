---
title: 截止後永久公開已登記預測與修改歷史
date: 2026-10-01
status: active
tags: [cardano-forecast-club, decision, privacy, verification]
---

# 截止後永久公開已登記預測與修改歷史

## Context

2026-10-01 Will 選 D10-A。本 ADR 補記公開範圍與保留政策；不延伸成資料授權、商業再利用或匿名保證。

- `inherited` 第三方須用公開資料重算戰績：仍成立，因這是產品目的；不是只有 A 才能做到。
- `inherited` 完整已登記版本留存：D10/I3 的政策選擇仍成立，但不把它當排除其他選項的外部限制。
- `inherited` 截止前隱藏他人機率是 agent 可推翻實作預設；三個公開政策都可兼容，並非新增拍板。
- `external` 尚未正式部署、需求未驗證：README Status；不能用使用者或遷移成本迫使 A。

## Options Considered

- **基準／B：資料最小化＋私人參與**。私人預測不進公開排行榜，公開參與另有完整 cohort。[W3C Privacy Principles §2.2](https://www.w3.org/TR/2025/STMT-privacy-principles-20250515/#data-minimization) 是隱私設計基準，並非預測平台普遍採 B 的證據。優點是降低曝光，代價是公開資料不涵蓋私人戰績。
- **A（選用）：全部已登記版本在截止後以公開暱稱永久公開**。政策單一、可核對修改過程；代價是參與者不能撤回公開歷史。
- **C：全部歷史公開，官方排行榜可退出**。同樣可重算，降低官方競賽曝光；不提供預測隱私，第三方仍可重建排行榜，需要退出政策。

## Decision

**D10-A**：截止後以公開暱稱永久公開所有已登記預測及修改歷史；參加前明示同意。刪除請求只解除暱稱與登入帳號的對應，不刪預測或既有暱稱快照。

## Rationale

依原計畫的取捨分析，A 選擇「加入即留下完整已登記戰績」，而非額外區分私人／公開模式；代價是參加門檻及永久曝光。這是政策取捨，不能說 B 技術上無法重算公開排行榜。

B 若事前固定 cohort、禁止挑好成績轉入，也能維持公開排行榜可信度；其涵蓋範圍仍小於所有已登記預測。C 同樣可保留完整公開資料，增加的是官方排名退出政策，不是 verifier 的技術障礙。

Will 已選 A，但沒有另述「為何不採 C」的個人理由；保留這個來源缺口，不以 agent 的單純化偏好代替本人理由。兩份獨立草稿提出的 B/C 反對理由已保留於本段與選項，未改變既有決定。

公開暱稱不等於匿名，解除帳號對應無法撤回已匯出／轉載資料；鏈上只存 root 也不決定鏈外明文必須永久保留。永久公開是本次選擇，不是鏈的要求。

## Expected Outcome

公開匯出包含全部已登記版本，帳號解除對應後仍可重算正式成績；不宣稱涵蓋私人未登記預測或所有帳號，也不宣稱使用者已接受此政策。

## Followup

- 公開試辦驗證永久公開告知後的提交轉換與退出原因，核對使用者能否理解解除帳號不等於刪除歷史。
- 需正式重評排行榜退出時，補核對 D10-A 相較 C 的本人理由；目前不據此更動政策。

## Revocation Triggers

- 公開曝光成為主要參加障礙，或產品轉為私人練習工具 → 重評事前固定的 B／官方退出的 C。
- 需求改為可刪除預測內容 → 同時重評公開資料契約與 verifier 範圍，不能只改頁面展示。

## Related

- 原始選擇：2026-10-01 與 Will 的 agent discussion，D10-A；沒有新增資料所有權／再利用授權。
- 在產品 repo 取回 `git show a50c5dc:docs/plans/2026-10-01-forecast-club-mvp.md`；完整 SHA `a50c5dc9f3b5f7b00a58445761cfcb5e13d936b9`。
- 同 commit `README.md` Boundaries 與 `docs/verification.md`；`7ecdc8a` 的 consent／identity unlink 回歸及[CI](https://github.com/Will413028/cardano-forecast-club/actions/runs/36868168859)。
- [其他六項 MVP 拍板](2026-10-01-mvp-product-choices.md)。
- 無 Lessons Rules；產品資料政策不抽通用規則。兩份 fresh independent 草稿已比較，原計畫保留。
