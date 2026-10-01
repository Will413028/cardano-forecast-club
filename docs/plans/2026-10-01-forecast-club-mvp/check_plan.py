#!/usr/bin/env python3
"""本計畫的一次性檢查：步驟與決定欄位齊全、需求每項有去向、引用存在、沒有私人路徑。

用法：python3 check_plan.py [計畫檔]
預設檢查與本目錄同名的計畫檔（本目錄名稱 + .md），附件只取固定的四份（ATTACHMENTS），spikes/ 子目錄不在範圍。
通過時印出摘要並以 0 結束；任何問題印出後以 1 結束。
"""
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
STEP_FIELDS = ["範圍", "消費端", "不能動", "驗收", "停止條件"]
DECISION_FIELDS = ["狀態：", "擋住步驟：", "需要的事實："]
ATTACHMENTS = ["requirements.md", "nfr.md", "external-interfaces.md", "precedents-and-risks.md"]
DEST_RE = re.compile(r"^(步驟 \d+|不做|延後|前提)$")
# 以拼接建立，避免本檔自己命中
FORBIDDEN = ["second" + "-brain", "/Us" + "ers/", "/private" + "/tmp", ".pro" + "jects", "da" + "ily/", "wi" + "ki/"]


def step_numbers(text):
    nums = set()
    for m in re.finditer(r"步驟[：:]?\s*((?:\d+(?:[–-]\d+)?[、，, ]*)+)", text):
        for part in re.split(r"[、，, ]+", m.group(1)):
            if "–" in part or "-" in part:
                a, b = re.split(r"[–-]", part)
                nums.update(range(int(a), int(b) + 1))
            elif part.isdigit():
                nums.add(int(part))
    return nums


def blocks(lines, start_re):
    out, cur = [], None
    for line in lines:
        m = start_re.match(line)
        if m:
            cur = [m, [line]]
            out.append(cur)
        elif cur is not None:
            if line.startswith("## ") or (line.startswith("- ") and not line.startswith("  ")):
                cur = None
            else:
                cur[1].append(line)
    return [(m, "\n".join(ls)) for m, ls in out]


def main():
    plan = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parent / (HERE.name + ".md")
    att_dir = plan.parent / plan.stem
    errors = []
    text = plan.read_text(encoding="utf-8")
    lines = text.splitlines()

    if "<!--" in text:
        errors.append("計畫仍有 HTML 註解（模板檔頭未刪）")

    # 步驟
    steps = blocks(lines, re.compile(r"^- \[[ x]\] \*\*(\d+)\. (.+?)\*\*"))
    nums = [int(m.group(1)) for m, _ in steps]
    if nums != list(range(nums[0] if nums else 0, (nums[0] if nums else 0) + len(nums))) or (nums and nums[0] not in (0, 1)):
        errors.append(f"步驟編號不連續：{nums}")
    step_set = set(nums)
    for i, (m, body) in enumerate(steps):
        n = int(m.group(1))
        if "被擋於：" not in body.splitlines()[0]:
            errors.append(f"步驟 {n} 缺「被擋於」")
        if i == len(steps) - 1:
            if "收尾" not in m.group(2) or "驗收：" not in body:
                errors.append("最後一步不是收尾，或缺驗收")
            continue
        for f in STEP_FIELDS:
            if not re.search(rf"^  - {f}：\S", body, re.M):
                errors.append(f"步驟 {n} 缺欄位「{f}」")
        if "確認正常" in body:
            errors.append(f"步驟 {n} 驗收含無法判定的「確認正常」")

    # 決定
    decisions = blocks(lines, re.compile(r"^- \*\*D(\d+) "))
    dset = {int(m.group(1)) for m, _ in decisions}
    for m, body in decisions:
        d = int(m.group(1))
        head = body.splitlines()[0]
        for f in DECISION_FIELDS:
            if f not in head:
                errors.append(f"D{d} 缺「{f}」")
        opts = re.findall(r"^  - [A-Z]：", body, re.M)
        if len(opts) < 2:
            errors.append(f"D{d} 選項少於 2 個")
        if "（建議" not in body:
            errors.append(f"D{d} 沒有建議")
        concl = re.search(r"^  - 結論：(.*)$", body, re.M)
        if not concl:
            errors.append(f"D{d} 缺結論行")
        elif "狀態：未決" in head and not concl.group(1).startswith("未決"):
            errors.append(f"D{d} 狀態未決卻已寫結論（不得替擁有者拍板）")
        blocked = re.search(r"擋住步驟：([^；）]*)", head)
        if blocked:
            for s in step_numbers("步驟 " + blocked.group(1)):
                if s not in step_set:
                    errors.append(f"D{d} 擋住不存在的步驟 {s}")
    if not re.search(r"^拍板順序：", text, re.M):
        errors.append("缺「拍板順序」")

    # 引用存在
    att_texts = {}
    for name in ATTACHMENTS:
        f = att_dir / name
        if f.exists():
            att_texts[name] = f.read_text(encoding="utf-8")
        else:
            errors.append(f"缺附件 {name}")
    for name, t in [(plan.name, text)] + list(att_texts.items()):
        for d in {int(x) for x in re.findall(r"\bD(\d+)\b", t)}:
            if d not in dset:
                errors.append(f"{name} 引用不存在的 D{d}")
        for s in step_numbers(t):
            if s not in step_set:
                errors.append(f"{name} 引用不存在的步驟 {s}")
        for bad in FORBIDDEN:
            if bad in t:
                errors.append(f"{name} 含私人路徑片段「{bad}」")

    # 需求去向
    req = att_texts.get("requirements.md", "")
    rows = re.findall(r"^\| (R\d+) \|(.*)$", req, re.M)
    if not rows:
        errors.append("requirements.md 沒有 R 列")
    for rid, rest in rows:
        cols = [c.strip() for c in rest.strip().strip("|").split("|")]
        dest = cols[3] if len(cols) > 3 else ""
        if not DEST_RE.match(dest):
            errors.append(f"{rid} 去向不合法：「{dest}」")

    # 進度表
    for n in step_set:
        if not re.search(rf"^\| {n} \S", text, re.M):
            errors.append(f"進度表缺步驟 {n}")

    if errors:
        print("\n".join("FAIL " + e for e in errors))
        return 1
    print(f"OK steps={len(steps)} decisions={len(dset)} requirements={len(rows)} attachments={len(att_texts)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
