# 自動更新卡片資料

這個專案使用 GitHub Actions 每天自動更新 `cards.js`。

流程：

1. `.github/workflows/update-cards.yml` 每天台灣時間約 03:20 執行，也可以在 GitHub Actions 頁面手動執行。
2. workflow 會執行 `node scripts/update-cards.mjs`。
3. 腳本會從 Biligame 戀與深空 wiki 重新解析卡片清單。
4. 如果 `cards.js` 有變更，workflow 會自動 commit 並 push。
5. Netlify 若已連到這個 GitHub repo，看到新 commit 後會自動重新部署。

注意：

- 玩家自己的收集紀錄存在手機瀏覽器的 `localStorage`，不會被重新部署清掉。
- 紀錄用「角色 + 卡名」對應；如果 wiki 改了角色或卡片名稱，舊紀錄可能需要重新選一次。
- 如果 wiki HTML 結構大改，workflow 會失敗而不是產生錯誤資料。
