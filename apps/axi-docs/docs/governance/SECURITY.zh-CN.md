# 安全策略

请通过本工作区的 private operator channel 报告安全敏感问题。

请勿在公开 issue 中包含凭据、API token、私钥、含敏感信息的服务器地址或客户数据。

凭据材料必须仅通过 secret ref 引用。包括 Cloudflare 凭据在内的已知本地凭据文件不得被 CI 读取，也不得打印到日志中。
