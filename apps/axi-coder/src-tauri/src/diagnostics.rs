use crate::database::{now, Database};
use crate::models::{DiagnosticDoc, DiagnosticRule, ProviderKind};
use anyhow::Result;
use reqwest::StatusCode;

pub fn seed(db: &Database) -> Result<Vec<DiagnosticDoc>> {
    let docs = default_docs();
    let rules = default_rules();
    db.replace_diagnostics(&docs, &rules)?;
    Ok(docs)
}

pub fn diagnose_http(
    db: &Database,
    provider_type: &ProviderKind,
    status: Option<StatusCode>,
    transport_error: Option<&str>,
) -> (String, String, String) {
    if let Some(error) = transport_error {
        let lower = error.to_ascii_lowercase();
        if lower.contains("timed out") || lower.contains("timeout") {
            return fallback("network_timeout");
        }
        if lower.contains("dns") || lower.contains("resolve") {
            return fallback("dns");
        }
        if lower.contains("tls") || lower.contains("certificate") {
            return fallback("tls");
        }
        return (
            "network".to_string(),
            "请求没有到达可用的模型端点。".to_string(),
            "请检查基础地址、本地代理、VPN 和提供方可用性。".to_string(),
        );
    }

    let code = status.map(|value| value.as_u16() as i64);
    let provider = provider_type.as_str();
    if let Ok(Some(rule)) = db.find_diagnostic_rule(provider, code) {
        return (rule.category, rule.reason, rule.suggestion);
    }
    if let Ok(Some(rule)) = db.find_diagnostic_rule("generic", code) {
        return (rule.category, rule.reason, rule.suggestion);
    }

    match status {
        Some(status) if status.is_success() => (
            "ok".to_string(),
            "提供方已接受请求。".to_string(),
            "无需额外操作。".to_string(),
        ),
        Some(status) => (
            "http_error".to_string(),
            format!("提供方返回了 HTTP {}。", status.as_u16()),
            "请打开提供方控制台，确认基础地址、模型和额度配置。".to_string(),
        ),
        None => fallback("network"),
    }
}

pub fn fallback(category: &str) -> (String, String, String) {
    match category {
        "network_timeout" => (
            "network_timeout".to_string(),
            "请求在提供方响应前超时。".to_string(),
            "请重试，然后检查代理/VPN 路由和提供方状态公告。".to_string(),
        ),
        "dns" => (
            "dns".to_string(),
            "无法解析提供方主机名。".to_string(),
            "请检查基础地址拼写、DNS 以及网络连通性。".to_string(),
        ),
        "tls" => (
            "tls".to_string(),
            "在收到 API 响应前 TLS 握手失败。".to_string(),
            "请检查证书劫持、公司代理设置或过期的提供方地址。".to_string(),
        ),
        _ => (
            "network".to_string(),
            "未收到提供方返回的 HTTP 响应。".to_string(),
            "请检查基础地址和当前网络路径。".to_string(),
        ),
    }
}

fn default_docs() -> Vec<DiagnosticDoc> {
    let fetched_at = now();
    vec![
        doc(
            "cc-switch",
            "ccswitch",
            "CC Switch 代理与 CLI 接管参考",
            "https://github.com/farion1231/cc-switch",
            "用于本地代理路由和目标 CLI 配置接管的参考实现。",
            &fetched_at,
        ),
        doc(
            "claude-env",
            "anthropic",
            "Claude Code 环境变量",
            "https://code.claude.com/docs/en/env-vars",
            "Claude Code 通过环境变量配置 API 基础地址和认证信息。",
            &fetched_at,
        ),
        doc(
            "codex-config",
            "openai_chat",
            "Codex 高级配置",
            "https://developers.openai.com/codex/config-advanced",
            "Codex 读取本地 TOML 配置和提供方元数据。",
            &fetched_at,
        ),
        doc(
            "gemini-config",
            "gemini_native",
            "Gemini CLI 配置",
            "https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/configuration.md",
            "Gemini CLI 支持项目级和用户级环境配置。",
            &fetched_at,
        ),
        doc(
            "gemini-troubleshooting",
            "gemini_native",
            "Gemini API 故障排查",
            "https://ai.google.dev/gemini-api/docs/troubleshooting",
            "Gemini 文档涵盖常见的认证、额度和模型请求失败场景。",
            &fetched_at,
        ),
        doc(
            "deepseek-api",
            "openai_chat",
            "DeepSeek API 文档",
            "https://api-docs.deepseek.com/",
            "DeepSeek 提供 OpenAI 兼容的 API 接口。",
            &fetched_at,
        ),
        doc(
            "ollama-openai",
            "ollama",
            "Ollama OpenAI 兼容性",
            "https://docs.ollama.com/api/openai-compatibility",
            "Ollama 可以通过 OpenAI 兼容端点暴露本地模型。",
            &fetched_at,
        ),
    ]
}

fn default_rules() -> Vec<DiagnosticRule> {
    vec![
        rule(
            401,
            "auth",
            "API 密钥被拒绝或缺失。",
            "请重新输入 API 密钥，并确认它属于当前提供方。",
        ),
        rule(
            402,
            "billing",
            "提供方账户没有可用的计费余额。",
            "请在提供方控制台检查额度、账单状态或预付余额。",
        ),
        rule(
            403,
            "forbidden",
            "密钥有效，但无权访问该模型或端点。",
            "请检查项目权限、模型访问、区域限制和组织设置。",
        ),
        rule(
            404,
            "not_found",
            "未找到目标端点或模型。",
            "请确认基础地址、API 版本路径和所选模型名称。",
        ),
        rule(
            422,
            "invalid_request",
            "请求体被路由接受，但被提供方校验拒绝。",
            "请尝试自动参数档位，或选择与请求形状兼容的模型。",
        ),
        rule(
            429,
            "rate_limit",
            "已超过提供方速率限制或额度。",
            "请稍后重试，降低并发，或将该 CLI 路由切换到其他提供方/模型。",
        ),
        rule(
            500,
            "provider_error",
            "提供方返回了内部错误。",
            "请先重试一次；若问题持续，请检查提供方状态或切换到其他模型。",
        ),
        rule(
            503,
            "provider_unavailable",
            "提供方或模型当前暂不可用。",
            "请稍后重试，或把该 CLI 路由到健康的提供方。",
        ),
        rule(
            504,
            "provider_timeout",
            "上游提供方超时。",
            "请缩小上下文后重试，或切换到更快的模型/提供方。",
        ),
    ]
}

fn doc(
    id: &str,
    provider: &str,
    title: &str,
    url: &str,
    summary: &str,
    fetched_at: &str,
) -> DiagnosticDoc {
    DiagnosticDoc {
        id: id.to_string(),
        provider: provider.to_string(),
        title: title.to_string(),
        url: url.to_string(),
        fetched_at: fetched_at.to_string(),
        summary: summary.to_string(),
    }
}

fn rule(status_code: i64, category: &str, reason: &str, suggestion: &str) -> DiagnosticRule {
    DiagnosticRule {
        id: format!("generic-{status_code}"),
        provider: "generic".to_string(),
        status_code: Some(status_code),
        category: category.to_string(),
        reason: reason.to_string(),
        suggestion: suggestion.to_string(),
        source_url: "https://api-docs.deepseek.com/".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_common_http_errors() {
        let temp = tempfile::tempdir().unwrap();
        let db = Database::open(&temp.path().join("axi.db")).unwrap();
        seed(&db).unwrap();

        let (category, reason, suggestion) = diagnose_http(
            &db,
            &ProviderKind::OpenAiChat,
            Some(StatusCode::UNAUTHORIZED),
            None,
        );
        assert_eq!(category, "auth");
        assert!(reason.contains("API 密钥"));
        assert!(suggestion.contains("重新输入"));

        let (category, _, _) = diagnose_http(
            &db,
            &ProviderKind::OpenAiChat,
            Some(StatusCode::TOO_MANY_REQUESTS),
            None,
        );
        assert_eq!(category, "rate_limit");
    }
}
