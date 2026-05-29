use crate::database::Database;
use crate::diagnostics;
use crate::models::{NewRequestLog, Provider, ProviderKind, CLI_CLAUDE, CLI_CODEX, CLI_GEMINI};
use crate::secrets::SecretStore;
use crate::url_probe::join_url;
use anyhow::Result;
use axum::body::{to_bytes, Body};
use axum::extract::State;
use axum::http::{header::CONTENT_TYPE, Request, Response, StatusCode};
use axum::response::IntoResponse;
use axum::Router;
use reqwest::Client;
use serde_json::{json, Value};
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use std::time::Instant;

pub const PROXY_PORT: u16 = 15_721;
pub const PROXY_ORIGIN: &str = "http://127.0.0.1:15721";

#[derive(Clone)]
pub struct ProxyRuntime {
    inner: Arc<Mutex<ProxyInner>>,
    db: Database,
    secrets: SecretStore,
    client: Client,
}

#[derive(Default)]
struct ProxyInner {
    running: bool,
}

#[derive(Clone)]
struct ProxyContext {
    db: Database,
    secrets: SecretStore,
    client: Client,
}

impl ProxyRuntime {
    pub fn new(db: Database, secrets: SecretStore, client: Client) -> Self {
        Self {
            inner: Arc::new(Mutex::new(ProxyInner::default())),
            db,
            secrets,
            client,
        }
    }

    pub async fn ensure_running(&self) -> Result<()> {
        if self.is_running() {
            return Ok(());
        }

        let context = ProxyContext {
            db: self.db.clone(),
            secrets: self.secrets.clone(),
            client: self.client.clone(),
        };
        let addr = SocketAddr::from(([127, 0, 0, 1], PROXY_PORT));
        let listener = tokio::net::TcpListener::bind(addr).await?;
        let app = Router::new().fallback(proxy_handler).with_state(context);

        {
            let mut inner = self.inner.lock().expect("proxy mutex poisoned");
            inner.running = true;
        }

        tauri::async_runtime::spawn(async move {
            if let Err(error) = axum::serve(listener, app).await {
                eprintln!("axi-coder 代理已停止：{error}");
            }
        });

        Ok(())
    }

    pub fn is_running(&self) -> bool {
        self.inner.lock().expect("proxy mutex poisoned").running
    }
}

async fn proxy_handler(State(ctx): State<ProxyContext>, req: Request<Body>) -> Response<Body> {
    let start = Instant::now();
    let path = req.uri().path().to_string();
    let cli = cli_for_path(&path);
    let body = match to_bytes(req.into_body(), 20 * 1024 * 1024).await {
        Ok(body) => body,
        Err(error) => {
            return json_response(
                StatusCode::BAD_REQUEST,
                json!({"error": format!("读取请求体失败：{error}")}),
            );
        }
    };
    let request_json = serde_json::from_slice::<Value>(&body).unwrap_or_else(|_| json!({}));

    let route = match ctx.db.get_route(cli) {
        Ok(Some(route)) if route.enabled => route,
        Ok(_) => {
            return json_response(
                StatusCode::SERVICE_UNAVAILABLE,
                json!({"error": format!("Axi Coder 的 {} 路由已关闭。", cli_display_name(cli))}),
            );
        }
        Err(error) => {
            return json_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                json!({"error": format!("读取路由失败：{error}")}),
            );
        }
    };

    let provider_id = match route.provider_id.clone() {
        Some(provider_id) => provider_id,
        None => {
            return json_response(
                StatusCode::SERVICE_UNAVAILABLE,
                json!({"error": format!("Axi Coder 的 {} 路由未绑定提供方。", cli_display_name(cli))}),
            );
        }
    };
    let provider = match ctx.db.get_provider(&provider_id) {
        Ok(Some(provider)) => provider,
        Ok(None) => {
            return json_response(
                StatusCode::SERVICE_UNAVAILABLE,
                json!({"error": "未找到 Axi Coder 提供方。"}),
            );
        }
        Err(error) => {
            return json_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                json!({"error": format!("读取提供方失败：{error}")}),
            );
        }
    };

    let secret = ctx.secrets.get(&provider.secret_ref).unwrap_or_default();
    let model = route
        .model
        .clone()
        .or_else(|| body_model(&request_json))
        .or_else(|| provider.default_model.clone());

    let outbound = build_outbound(&provider, cli, &path, &request_json, model.as_deref());
    let mut request = ctx.client.post(outbound.url);
    for (key, value) in outbound.headers {
        request = request.header(key, value);
    }
    request = apply_auth(request, &provider.provider_type, &secret);

    let response = request.json(&outbound.body).send().await;
    let latency_ms = start.elapsed().as_millis() as i64;
    match response {
        Ok(response) => {
            let status = response.status();
            let content_type = response
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|value| value.to_str().ok())
                .map(str::to_string);
            let bytes = response.bytes().await.unwrap_or_default();
            let _ = log_proxy_http(&ctx, cli, &provider, model, status, latency_ms, &bytes);
            bytes_response(status, content_type, bytes.to_vec())
        }
        Err(error) => {
            let message = error.to_string();
            let (category, reason, _) =
                diagnostics::diagnose_http(&ctx.db, &provider.provider_type, None, Some(&message));
            let _ = ctx.db.insert_request_log(NewRequestLog {
                cli: cli.to_string(),
                provider_id: Some(provider.id.clone()),
                provider_name: Some(provider.name.clone()),
                model,
                status: "failure".to_string(),
                http_status: None,
                error_category: Some(category),
                error_reason: Some(reason.clone()),
                latency_ms,
                input_tokens: None,
                output_tokens: None,
                data_source: "proxy".to_string(),
            });
            json_response(StatusCode::BAD_GATEWAY, json!({"error": reason}))
        }
    }
}

struct OutboundRequest {
    url: String,
    headers: Vec<(&'static str, String)>,
    body: Value,
}

fn build_outbound(
    provider: &Provider,
    cli: &str,
    path: &str,
    body: &Value,
    model: Option<&str>,
) -> OutboundRequest {
    match provider.provider_type {
        ProviderKind::Anthropic => OutboundRequest {
            url: join_url(&provider.base_url, "v1/messages"),
            headers: vec![("anthropic-version", "2023-06-01".to_string())],
            body: to_anthropic_body(body, model),
        },
        ProviderKind::OpenAiResponses => OutboundRequest {
            url: join_url(&provider.base_url, "responses"),
            headers: Vec::new(),
            body: to_responses_body(body, model),
        },
        ProviderKind::GeminiNative => {
            let endpoint = if cli == CLI_GEMINI {
                path.trim_start_matches('/').to_string()
            } else {
                format!(
                    "models/{}:generateContent",
                    model.unwrap_or("gemini-2.5-flash")
                )
            };
            OutboundRequest {
                url: join_url(&provider.base_url, &endpoint),
                headers: Vec::new(),
                body: to_gemini_body(body),
            }
        }
        ProviderKind::OpenAiChat | ProviderKind::Ollama | ProviderKind::Unknown => {
            OutboundRequest {
                url: join_url(&provider.base_url, "chat/completions"),
                headers: Vec::new(),
                body: to_openai_chat_body(body, model),
            }
        }
    }
}

fn apply_auth(
    request: reqwest::RequestBuilder,
    kind: &ProviderKind,
    secret: &str,
) -> reqwest::RequestBuilder {
    if secret.trim().is_empty() {
        return request;
    }

    match kind {
        ProviderKind::Anthropic => request.header("x-api-key", secret),
        ProviderKind::GeminiNative => request.header("x-goog-api-key", secret),
        _ => request.bearer_auth(secret),
    }
}

fn cli_for_path(path: &str) -> &'static str {
    if path.starts_with("/v1/messages") || path.ends_with("/messages") {
        CLI_CLAUDE
    } else if path.starts_with("/v1beta") {
        CLI_GEMINI
    } else {
        CLI_CODEX
    }
}

fn cli_display_name(cli: &str) -> &str {
    match cli {
        CLI_CLAUDE => "Claude",
        CLI_CODEX => "Codex",
        CLI_GEMINI => "Gemini",
        _ => cli,
    }
}

fn to_openai_chat_body(body: &Value, model: Option<&str>) -> Value {
    if body.get("messages").is_some() {
        let mut next = body.clone();
        set_model(&mut next, model);
        return next;
    }

    let messages = if let Some(input) = body.get("input") {
        vec![json!({"role": "user", "content": value_to_text(input)})]
    } else if let Some(messages) = body.get("messages") {
        messages.as_array().cloned().unwrap_or_default()
    } else if let Some(contents) = body.get("contents") {
        gemini_contents_to_messages(contents)
    } else {
        vec![json!({"role": "user", "content": "ping"})]
    };

    json!({
        "model": model.unwrap_or("deepseek-chat"),
        "messages": messages,
        "temperature": body.get("temperature").and_then(Value::as_f64).unwrap_or(0.4),
        "max_tokens": body
            .get("max_tokens")
            .or_else(|| body.get("max_output_tokens"))
            .and_then(Value::as_i64)
            .unwrap_or(1024)
    })
}

fn to_responses_body(body: &Value, model: Option<&str>) -> Value {
    if body.get("input").is_some() {
        let mut next = body.clone();
        set_model(&mut next, model);
        return next;
    }

    let input = body
        .get("messages")
        .map(messages_to_text)
        .or_else(|| body.get("contents").map(value_to_text))
        .unwrap_or_else(|| "ping".to_string());

    json!({
        "model": model.unwrap_or("deepseek-chat"),
        "input": input,
        "max_output_tokens": body
            .get("max_output_tokens")
            .or_else(|| body.get("max_tokens"))
            .and_then(Value::as_i64)
            .unwrap_or(1024)
    })
}

fn to_anthropic_body(body: &Value, model: Option<&str>) -> Value {
    if body.get("messages").is_some() && body.get("max_tokens").is_some() {
        let mut next = body.clone();
        set_model(&mut next, model);
        return next;
    }

    let messages = body
        .get("messages")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_else(|| vec![json!({"role": "user", "content": "ping"})]);

    json!({
        "model": model.unwrap_or("claude-sonnet-4-5"),
        "max_tokens": body
            .get("max_tokens")
            .or_else(|| body.get("max_output_tokens"))
            .and_then(Value::as_i64)
            .unwrap_or(1024),
        "messages": messages
    })
}

fn to_gemini_body(body: &Value) -> Value {
    if body.get("contents").is_some() {
        return body.clone();
    }

    let text = body
        .get("messages")
        .map(messages_to_text)
        .or_else(|| body.get("input").map(value_to_text))
        .unwrap_or_else(|| "ping".to_string());
    json!({
        "contents": [{"parts": [{"text": text}]}],
        "generationConfig": {
            "temperature": body.get("temperature").and_then(Value::as_f64).unwrap_or(0.4),
            "maxOutputTokens": body
                .get("max_tokens")
                .or_else(|| body.get("max_output_tokens"))
                .and_then(Value::as_i64)
                .unwrap_or(1024)
        }
    })
}

fn set_model(value: &mut Value, model: Option<&str>) {
    if let (Some(model), Some(object)) = (model, value.as_object_mut()) {
        object.insert("model".to_string(), Value::String(model.to_string()));
    }
}

fn body_model(body: &Value) -> Option<String> {
    body.get("model")
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn messages_to_text(value: &Value) -> String {
    value
        .as_array()
        .map(|messages| {
            messages
                .iter()
                .map(|message| {
                    let role = message
                        .get("role")
                        .and_then(Value::as_str)
                        .unwrap_or("user");
                    let content = message
                        .get("content")
                        .map(value_to_text)
                        .unwrap_or_default();
                    format!("{role}: {content}")
                })
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_else(|| value_to_text(value))
}

fn gemini_contents_to_messages(contents: &Value) -> Vec<Value> {
    contents
        .as_array()
        .map(|items| {
            items
                .iter()
                .map(|item| {
                    let role = item
                        .get("role")
                        .and_then(Value::as_str)
                        .unwrap_or("user")
                        .replace("model", "assistant");
                    json!({"role": role, "content": value_to_text(item)})
                })
                .collect()
        })
        .unwrap_or_else(|| vec![json!({"role": "user", "content": value_to_text(contents)})])
}

fn value_to_text(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        Value::Array(items) => items
            .iter()
            .map(value_to_text)
            .collect::<Vec<_>>()
            .join("\n"),
        Value::Object(object) => {
            if let Some(text) = object.get("text").and_then(Value::as_str) {
                text.to_string()
            } else if let Some(parts) = object.get("parts") {
                value_to_text(parts)
            } else if let Some(content) = object.get("content") {
                value_to_text(content)
            } else {
                value.to_string()
            }
        }
        _ => value.to_string(),
    }
}

fn log_proxy_http(
    ctx: &ProxyContext,
    cli: &str,
    provider: &Provider,
    model: Option<String>,
    status: reqwest::StatusCode,
    latency_ms: i64,
    bytes: &[u8],
) -> Result<()> {
    let body = serde_json::from_slice::<Value>(bytes).unwrap_or_else(|_| json!({}));
    let usage = extract_usage(&body);
    let (category, reason, _) = if status.is_success() {
        (None, None, None)
    } else {
        let (category, reason, suggestion) =
            diagnostics::diagnose_http(&ctx.db, &provider.provider_type, Some(status), None);
        (Some(category), Some(reason), Some(suggestion))
    };

    ctx.db.insert_request_log(NewRequestLog {
        cli: cli.to_string(),
        provider_id: Some(provider.id.clone()),
        provider_name: Some(provider.name.clone()),
        model,
        status: if status.is_success() {
            "success".to_string()
        } else {
            "failure".to_string()
        },
        http_status: Some(status.as_u16() as i64),
        error_category: category,
        error_reason: reason,
        latency_ms,
        input_tokens: usage.0,
        output_tokens: usage.1,
        data_source: "proxy".to_string(),
    })?;
    Ok(())
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

fn json_response(status: StatusCode, value: Value) -> Response<Body> {
    let body = Body::from(value.to_string());
    Response::builder()
        .status(status)
        .header(CONTENT_TYPE, "application/json")
        .body(body)
        .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
}

fn bytes_response(
    status: reqwest::StatusCode,
    content_type: Option<String>,
    bytes: Vec<u8>,
) -> Response<Body> {
    let mut builder = Response::builder()
        .status(StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::BAD_GATEWAY));
    if let Some(content_type) = content_type {
        builder = builder.header(CONTENT_TYPE, content_type);
    }
    builder
        .body(Body::from(bytes))
        .unwrap_or_else(|_| StatusCode::BAD_GATEWAY.into_response())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chooses_cli_from_path() {
        assert_eq!(cli_for_path("/v1/messages"), CLI_CLAUDE);
        assert_eq!(
            cli_for_path("/v1beta/models/gemini:generateContent"),
            CLI_GEMINI
        );
        assert_eq!(cli_for_path("/v1/chat/completions"), CLI_CODEX);
    }

    #[test]
    fn converts_gemini_contents_to_openai_messages() {
        let body = json!({"contents": [{"parts": [{"text": "hello"}]}]});
        let converted = to_openai_chat_body(&body, Some("deepseek-chat"));
        assert_eq!(converted["model"], "deepseek-chat");
        assert_eq!(converted["messages"][0]["content"], "hello");
    }
}
