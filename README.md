# 南港健身房人潮觀測站

[開啟即時人數與歷史統計網站](https://ngsc-gym-tracker.raymond60308.workers.dev/)

Cloudflare Worker 每 5 分鐘從南港運動中心官網公開介面蒐集健身房目前人數
與容留人數，寫入 Cloudflare D1，並提供免下載的歷史統計網站。

GitHub Pages 備援網址：
[https://ldrrray.github.io/ngsc-gym-tracker/](https://ldrrray.github.io/ngsc-gym-tracker/)

網站功能：

- 目前人數、容留率與最後更新時間
- 今日最低、平均人數與人數走勢
- 最近 7／30／90 天或全部歷史切換
- 星期 × 30 分鐘的人潮熱度圖
- 最低人數時段排行榜與樣本數
- 最近觀測紀錄

所有時間均使用 `Asia/Taipei`。統計會排除一般開館時間 06:00–22:00
以外的觀測，並要求每個時段至少 3 筆樣本，避免過早下結論。
