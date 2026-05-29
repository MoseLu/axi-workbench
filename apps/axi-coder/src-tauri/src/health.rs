use crate::app_state::AppState;
use crate::database::now;
use crate::diagnostics;
use crate::models::{
    HealthCheckResult, NewRequestLog, Provider, ProviderKind, ProviderModel, CLI_CODEX,
};
use crate::url_probe::{fetch_openai_models, join_url};
use anyhow::{anyhow, Result};
use reqwest::{Client, StatusCode};
use serde_json::{json, Value};
use std::time::Instant;
use uuid::Uuid;

pub async fn test_provider(state: &AppState, provider_id: &str) -> Result<HealthCheckResult> {
    let provider = state
        .db
        .get_provider(provider_id)?
        .ok_or_else(|| anyhow!("未找到提供方：{provider_id}"))?;
    let key = state.secrets.get(&provider.secret_ref).unwrap_or_default();
    let models = discover_models(&state.client, &provider, key.as_str())
        .await
        .unwrap_or_default();
    if !models.is_empty() {
        state.db.replace_provider_models(&provider.id, &models)?;
    }

    let model = provider
        .default_model
        .clone()
        .or_else(|| models.first().map(|item| item.model_id.clone()))
        .unwrap_or_else(|| default_model_for(&provider.provider_type).to_string());

    let start = Instant::now();
    let response = send_minimal_request(&state.client, &provider, key.as_str(), &model).await;
    let latency_ms = start.elapsed().as_millis() as i64;

    match response {
        Ok((status, body)) if status.is_success() => {
            let usage = extract_usage(&body);
            state.db.insert_request_log(NewRequestLog {
                cli: "health".to_string(),
                provider_id: Some(provider.id.clone()),
                provider_name: Some(provider.name.clone()),
                model: Some(model.clone()),
                status: "success".to_string(),
                http_status: Some(status.as_u16() as i64),
                error_category: None,
                error_reason: None,
                latency_ms,
                input_tokens: usage.0,
                output_tokens: usage.1,
                data_source: "health_check".to_string(),
            })?;
            Ok(HealthCheckResult {
                ok: true,
                provider_id: provider.id,
                provider_name: provider.name,
                provider_type: provider.provider_type,
                tested_model: Some(model),
                latency_ms,
                http_status: Some(status.as_u16()),
                category: "ok".to_string(),
                reason: "提供方已接受最小模型请求。".to_string(),
                suggestion: "当前提供方已可用于 CLI 路由。".to_string(),
            })
        }
        Ok((status, _)) => {
            let (category, reason, suggestion) =
                diagnostics::diagnose_http(&state.db, &provider.provider_type, Some(status), None);
            state.db.insert_request_log(NewRequestLog {
                cli: "health".to_string(),
                provider_id: Some(provider.id.clone()),
                provider_name: Some(provider.name.clone()),
                model: Some(model.clone()),
                status: "failure".to_string(),
                http_status: Some(status.as_u16() as i64),
                error_category: Some(category.clone()),
                error_reason: Some(reason.clone()),
                latency_ms,
                input_tokens: None,
                output_tokens: None,
                data_source: "health_check".to_string(),
            })?;
            Ok(HealthCheckResult {
                ok: false,
                provider_id: provider.id,
                provider_name: provider.name,
                provider_type: provider.provider_type,
                tested_model: Some(model),
                latency_ms,
                http_status: Some(status.as_u16()),
                category,
                reason,
                suggestion,
            })
        }
        Err(error) => {
            let message = error.to_string();
            let (category, reason, suggestion) = diagnostics::diagnose_http(
                &state.db,
                &provider.provider_type,
                None,
                Some(&message),
            );
            state.db.insert_request_log(NewRequestLog {
                cli: "health".to_string(),
                provider_id: Some(provider.id.clone()),
                provider_name: Some(provider.name.clone()),
                model: Some(model.clone()),
                status: "failure".to_string(),
                http_status: None,
                error_category: Some(category.clone()),
                error_reason: Some(reason.clone()),
                latency_ms,
                input_tokens: None,
                output_tokens: None,
                data_source: "health_check".to_string(),
            })?;
            Ok(HealthCheckResult {
                ok: false,
                provider_id: provider.id,
                provider_name: provider.name,
                provider_type: provider.provider_type,
                tested_model: Some(model),
                latency_ms,
                http_status: None,
                category,
                reason,
                suggestion,
            })
        }
    }
}

pub async fn discover_models(
    client: &Client,
    provider: &Provider,
    key: &str,
) -> Result<Vec<ProviderModel>> {
    let ids = match provider.provider_type {
        ProviderKind::OpenAiChat | ProviderKind::OpenAiResponses | ProviderKind::Ollama => {
            fetch_openai_models(client, &provider.base_url, Some(key)).await?
        }
        ProviderKind::GeminiNative | ProviderKind::Anthropic | ProviderKind::Unknown => Vec::new(),
    };

    Ok(ids
        .into_iter()
        .map(|model_id| provider_model(&provider.id, &model_id))
        .collect())
}

async fn send_minimal_request(
    client: &Client,
    provider: &Provider,
    key: &str,
    model: &str,
) -> Result<(StatusCode, Value)> {
    let request = match provider.provider_type {
        ProviderKind::Anthropic => client
            .post(join_url(&provider.base_url, "v1/messages"))
            .header("x-api-key", key)
            .header("anthropic-version", "2023-06-01")
            .json(&json!({
                "model": model,
                "max_tokens": 16,
                "messages": [{"role": "user", "content": "ping"}]
            })),
        ProviderKind::OpenAiResponses => client
            .post(join_url(&provider.base_url, "responses"))
            .bearer_auth(key)
            .json(&json!({
                "model": model,
                "input": "ping",
                "max_output_tokens": 16
            })),
        ProviderKind::GeminiNative => client
            .post(join_url(
                &provider.base_url,
                &format!("models/{model}:generateContent"),
            ))
            .header("x-goog-api-key", key)
            .json(&json!({
                "contents": [{"parts": [{"text": "ping"}]}],
                "generationConfig": {"maxOutputTokens": 16, "temperature": 0.0}
            })),
        ProviderKind::OpenAiChat | ProviderKind::Ollama | ProviderKind::Unknown => {
            let mut request = client.post(join_url(&provider.base_url, "chat/completions"));
            if provider.provider_type != ProviderKind::Ollama || !key.trim().is_empty() {
                request = request.bearer_auth(key);
            }
            request.json(&json!({
                "model": model,
                "messages": [{"role": "user", "content": "ping"}],
                "max_tokens": 16,
                "temperature": 0.0
            }))
        }
    };

    let response = request.send().await?;
    let status = response.status();
    let body = response.json::<Value>().await.unwrap_or_else(|_| json!({}));
    Ok((status, body))
}

pub fn provider_model(provider_id: &str, model_id: &str) -> ProviderModel {
    let lower = model_id.to_ascii_lowercase();
    ProviderModel {
        id: Uuid::new_v4().to_string(),
        provider_id: provider_id.to_string(),
        model_id: model_id.to_string(),
        context_window: infer_context(&lower),
        max_output_tokens: infer_output(&lower),
        supports_thinking: lower.contains("reason")
            || lower.contains("thinking")
            || lower.contains("r1")
            || lower.contains("o3")
            || lower.contains("o4"),
        supports_tools: !lower.contains("embedding"),
        supports_json: !lower.contains("embedding"),
    }
}

fn default_model_for(kind: &ProviderKind) -> &'static str {
    match kind {
        ProviderKind::Anthropic => "claude-sonnet-4-5",
        ProviderKind::GeminiNative => "gemini-2.5-flash",
        ProviderKind::Ollama => "llama3.2",
        _ => "deepseek-chat",
    }
}

fn infer_context(model: &str) -> Option<i64> {
    if model.contains("gemini") {
        Some(1_000_000)
    } else if model.contains("claude") {
        Some(200_000)
    } else if model.contains("deepseek") {
        Some(64_000)
    } else if model.contains("gpt-4.1") || model.contains("gpt-5") {
        Some(128_000)
    } else {
        None
    }
}

fn infer_output(model: &str) -> Option<i64> {
    if model.contains("gemini") {
        Some(65_536)
    } else if model.contains("claude") {
        Some(64_000)
    } else if model.contains("deepseek") {
        Some(8_192)
    } else {
        None
    }
}

fn extract_usage(body: &Value) -> (Option<i64>, Option<i64>) {
    let usage = body.get("usage");
    let input = usage
        .and_then(|value| {
            value
                .get("prompt_tokens")
                .or_else(|| value.get("input_tokens"))
        })
        .and_then(Value::as_i64);
    let output = usage
        .and_then(|value| {
            value
                .get("completion_tokens")
                .or_else(|| value.get("output_tokens"))
                .or_else(|| value.get("totalTokens"))
        })
        .and_then(Value::as_i64);
    (input, output)
}

#[allow(dead_code)]
pub fn success_log(provider: &Provider, model: Option<String>, latency_ms: i64) -> NewRequestLog {
    NewRequestLog {
        cli: CLI_CODEX.to_string(),
        provider_id: Some(provider.id.clone()),
        provider_name: Some(provider.name.clone()),
        model,
        status: "success".to_string(),
        http_status: Some(200),
        error_category: None,
        error_reason: None,
        latency_ms,
        input_tokens: None,
        output_tokens: None,
        data_source: format!("proxy:{}", now()),
    }
}
