# 鏈上承諾 spike：執行前置

核對日期：2026-10-01；尚未產生測試金鑰、安裝套件或送出交易。此文件不是量測報告。

## 已確認

- Docker Engine 29.1.3 正常；配置約 11.7 GiB memory，磁碟剩餘約 29 GiB。
- `docker images --format '{{.Repository}}:{{.Tag}}'`：已有 bloxbean/yaci-cli:0.12.0-beta5、0.10.6；不得重用其他專案的執行中節點或錢包。
- `npm view @meshsdk/core version engines --json`：官方 registry 回覆 1.9.1。
- `npm view @bloxbean/yaci-devkit version dist-tags --json`：stable 0.10.6、beta 0.12.0-beta5。
- `curl -sS https://preprod.koios.rest/api/v1/tip`：無 key 公開查詢成功，era Conway；尚未證明交易提交 endpoint 成功。

## 等待授權的具體範圍

1. 在 `spikes/anchoring/` 安裝鎖定 @meshsdk/core 1.9.1、@bloxbean/yaci-devkit 0.12.0-beta5 及其依賴；不做 global install。下載匹配版本的官方 DevKit Docker 配置及缺少的映像，記錄版本與 digest。
2. 啟動專用 forecast-club devnet，使用 repo 專用 compose project、loopback ports、volume；不修改其他執行中容器。依官方 DevKit 預設啟動方式，不用 hosted devnet 替代本機量測。beta 對應 Cardano node 11.0.1/PV11；本機費用 profile 必須記錄，zero_fee 不能拿來推估正常手續費。
3. 建立本 spike 專用 devnet、Preprod 錢包，只放 `spikes/anchoring/keys/`，權限 directory 0700、file 0600；生成與讀取時不輸出私鑰或助記詞。地址為公開資料。沒有任何主網錢包或主網交易。
4. 執行 (a) 批次 root、(b) 單筆雜湊各至少五次本機送出與讀回；(c) CIP-8 簽章與驗章。Preprod 收到 faucet 測試 ADA 後只送 (a) 至少五次，使用 Koios 公開 endpoint；提交／讀回是否可用以實測為準。
5. 費用、bytes、出塊延遲及 indexer 可讀延遲分開記錄；CIP-8 是 off-chain 簽章，交易 fee 與鏈上出塊延遲記 N/A，不捏造三列相同量測。metadata root 一個 byte 被竄改必須讓比對失敗。

## 金鑰與工具目錄

現有 ignore 已涵蓋 `spikes/**/keys/`。下載前補上 `node_modules/`、DevKit volumes／解壓工具目錄的 ignore；版本鎖定檔、spike 程式與公開交易 id 可入庫。先驗 ignore 再建立金鑰。

Preprod faucet 可能需要人類驗證；錢包建立後提供公開地址，由 Will 領取測試 ADA。未生成地址前不要求轉帳或提供既有錢包金鑰。

## 官方來源

- [Yaci DevKit](https://github.com/bloxbean/yaci-devkit)：版本相容矩陣與 Docker 配置。
- [DevKit 0.12.0-beta5](https://github.com/bloxbean/yaci-devkit/releases/tag/v0.12.0-beta5)：PV11、node 11.0.1 與平台限制。
- [Mesh Yaci setup](https://meshjs.dev/yaci/getting-started)：本機 devnet 與 provider。
- [Mesh CIP-8 ownership](https://meshjs.dev/guides/prove-wallet-ownership)：簽章與驗章。
- [Cardano faucet](https://developers.cardano.org/docs/integrate-cardano/testnet-faucet/)：測試網領取 ADA。
- [Koios networks](https://www.koios.rest/guide/introduction.html)：Preprod 公開 base URL。
