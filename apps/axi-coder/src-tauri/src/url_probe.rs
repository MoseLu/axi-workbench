use crate::models::ProviderKind;
use reqwest::Client;
use serde_json::Value;
use url::Url;

pub fn normalize_base_url(input: &str) -> String {
    let trimmed = input.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return String::new();
    }
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        trimmed.to_string()
    } else {
        format!("https://{trimmed}")
    }
}

pub fn infer_provider_kind(base_url: &str) -> ProviderKind {
    let lower = base_url.to_ascii_lowercase();
    if lower.contains("localhost:11434") || lower.contains("127.0.0.1:11434") {
        return ProviderKind::Ollama;
    }
    if lower.contains("generativelanguage.googleapis.com")
        || lower.contains("googleapis.com")
        || lower.contains("v1beta")
    {
        return ProviderKind::GeminiNative;
    }
    if lower.contains("anthropic") || lower.ends_with("/anthropic") {
        return ProviderKind::Anthropic;
    }
    if lower.contains("responses") {
        return ProviderKind::OpenAiResponses;
    }
    ProviderKind::OpenAiChat
}

pub async fn probe_provider_kind(
    client: &Client,
    base_url: &str,
    api_key: Option<&str>,
) -> ProviderKind {
    let normalized = normalize_base_url(base_url);
    let inferred = infer_provider_kind(&normalized);

    if matches!(
        inferred,
        ProviderKind::Ollama | ProviderKind::GeminiNative | ProviderKind::Anthropic
    ) {
        return inferred;
    }

    for path in ["models", "v1/models"] {
        let url = join_url(&normalized, path);
        let mut request = client.get(url);
        if let Some(key) = api_key.filter(|key| !key.trim().is_empty()) {
            request = request.bearer_auth(key.trim());
        }
        if let Ok(response) = request.send().await {
            if response.status().is_success() {
                return ProviderKind::OpenAiChat;
            }
        }
    }

    inferred
}

pub async fn fetch_openai_models(
    client: &Client,
    base_url: &str,
    api_key: Option<&str>,
) -> anyhow::Result<Vec<String>> {
    let normalized = normalize_base_url(base_url);
    let mut last_error: Option<anyhow::Error> = None;

    for path in ["models", "v1/models"] {
        let url = join_url(&normalized, path);
        let mut request = client.get(url);
        if let Some(key) = api_key.filter(|key| !key.trim().is_empty()) {
            request = request.bearer_auth(key.trim());
        }

        match request.send().await {
            Ok(response) if response.status().is_success() => {
                let value: Value = response.json().await?;
                let models = value
                    .get("data")
                    .and_then(Value::as_array)
                    .map(|items| {
                        items
                            .iter()
                            .filter_map(|item| item.get("id").and_then(Value::as_str))
                            .map(str::to_string)
                            .collect::<Vec<_>>()
                    })
                    .unwrap_or_default();
                return Ok(models);
            }
            Ok(response) => {
                last_error = Some(anyhow::anyhow!("模型列表返回了 {}", response.status()));
            }
            Err(error) => last_error = Some(error.into()),
        }
    }

    Err(last_error.unwrap_or_else(|| anyhow::anyhow!("模型列表请求失败。")))
}

pub fn join_url(base_url: &str, endpoint: &str) -> String {
    let endpoint = endpoint.trim_start_matches('/');
    if let Ok(mut parsed) = Url::parse(base_url) {
        let mut path = parsed.path().trim_end_matches('/').to_string();
        if !path.ends_with(endpoint) {
            path.push('/');
            path.push_str(endpoint);
        }
        parsed.set_path(&path);
        parsed.to_string().trim_end_matches('/').to_string()
    } else {
        format!("{}/{}", base_url.trim_end_matches('/'), endpoint)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_missing_scheme() {
        assert_eq!(
            normalize_base_url("api.deepseek.com/"),
            "https://api.deepseek.com"
        );
    }

    #[test]
    fn detects_ollama_and_gemini() {
        assert_eq!(
            infer_provider_kind("http://127.0.0.1:11434/v1"),
            ProviderKind::Ollama
        );
        assert_eq!(
            infer_provider_kind("https://generativelanguage.googleapis.com/v1beta"),
            ProviderKind::GeminiNative
        );
    }

    #[test]
    fn joins_base_and_endpoint_across_slash_boundaries() {
        for (base_url, endpoint) in [
            ("https://api.example.com", "models"),
            ("https://api.example.com/", "models"),
            ("https://api.example.com", "/models"),
            ("https://api.example.com/", "/models"),
        ] {
            assert_eq!(
                join_url(base_url, endpoint),
                "https://api.example.com/models"
            );
        }
    }

    #[test]
    fn joins_nested_endpoint_without_duplicating_existing_path() {
        for (base_url, endpoint, expected) in [
            (
                "https://api.example.com/v1/",
                "/models",
                "https://api.example.com/v1/models",
            ),
            (
                "https://api.example.com/models",
                "models",
                "https://api.example.com/models",
            ),
        ] {
            assert_eq!(join_url(base_url, endpoint), expected);
        }
    }

    #[test]
    fn join_empty_endpoint_keeps_base_without_trailing_slash() {
        assert_eq!(
            join_url("https://api.example.com/", ""),
            "https://api.example.com"
        );
    }

    #[test]
    fn normalizes_whitespace_and_trailing_slashes() {
        for (input, expected) in [
            ("http://example.com/", "http://example.com"),
            ("https://example.com//", "https://example.com"),
            (" https://example.com ", "https://example.com"),
            ("   ", ""),
            ("", ""),
        ] {
            assert_eq!(normalize_base_url(input), expected);
        }
    }
}
