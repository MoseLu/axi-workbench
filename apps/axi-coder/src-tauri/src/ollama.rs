use crate::app_state::AppState;
use crate::database::now;
use crate::health::provider_model;
use crate::models::{OllamaScanResult, Provider, ProviderKind};
use serde::Deserialize;

const OLLAMA_TAGS_URL: &str = "http://127.0.0.1:11434/api/tags";
const OLLAMA_OPENAI_URL: &str = "http://127.0.0.1:11434/v1";

#[derive(Debug, Deserialize)]
struct TagsResponse {
    models: Vec<TagModel>,
}

#[derive(Debug, Deserialize)]
struct TagModel {
    name: String,
}

pub async fn scan(state: &AppState) -> OllamaScanResult {
    let response = match state.client.get(OLLAMA_TAGS_URL).send().await {
        Ok(response) => response,
        Err(error) => {
            return OllamaScanResult {
                ok: false,
                provider: None,
                models: Vec::new(),
                message: format!("Ollama 无法访问 {OLLAMA_TAGS_URL}：{error}"),
            };
        }
    };

    if !response.status().is_success() {
        return OllamaScanResult {
            ok: false,
            provider: None,
            models: Vec::new(),
            message: format!("Ollama 返回了 HTTP {}", response.status().as_u16()),
        };
    }

    let tags = match response.json::<TagsResponse>().await {
        Ok(tags) => tags,
        Err(error) => {
            return OllamaScanResult {
                ok: false,
                provider: None,
                models: Vec::new(),
                message: format!("无法解析 Ollama 响应：{error}"),
            };
        }
    };

    let now = now();
    let provider = Provider {
        id: "local-ollama".to_string(),
        name: "本地 Ollama".to_string(),
        base_url: OLLAMA_OPENAI_URL.to_string(),
        provider_type: ProviderKind::Ollama,
        default_model: tags.models.first().map(|model| model.name.clone()),
        secret_ref: "provider:local-ollama".to_string(),
        created_at: now.clone(),
        updated_at: now,
    };
    let models = tags
        .models
        .iter()
        .map(|model| provider_model(&provider.id, &model.name))
        .collect::<Vec<_>>();

    if let Err(error) = state.db.upsert_provider(&provider) {
        return OllamaScanResult {
            ok: false,
            provider: None,
            models: Vec::new(),
            message: format!("保存 Ollama 提供方失败：{error}"),
        };
    }
    if let Err(error) = state.db.replace_provider_models(&provider.id, &models) {
        return OllamaScanResult {
            ok: false,
            provider: Some(provider),
            models: Vec::new(),
            message: format!("保存 Ollama 模型失败：{error}"),
        };
    }

    OllamaScanResult {
        ok: true,
        provider: Some(provider),
        models,
        message: "已注册本地 Ollama 提供方。".to_string(),
    }
}
