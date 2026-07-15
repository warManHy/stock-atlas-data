# stock-atlas-data
股票图谱 APP 的公开数据更新仓库：全 A 股行业、主营、估值、盈利能力与近一年历史股性数据。

`.github/workflows/refresh-stock-data.yml` 在每个工作日上海时间 15:30（UTC 07:30）运行：从当前 `manifest.json` 下载数据、校验 SHA-256、重新打包并把新数据文件和 manifest 提交回 `main`。也可以在 GitHub Actions 页面手动运行。APP 始终读取同一个 manifest 地址，发现更高 `dataVersion` 后自动拉取。
