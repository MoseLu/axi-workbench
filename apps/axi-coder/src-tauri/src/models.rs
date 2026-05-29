use serde::{Deserialize, Serialize};

pub const CLI_CLAUDE: &str = "claude";
pub const CLI_CODEX: &str = "codex";
pub const CLI_GEMINI: &str = "gemini";

pub fn default_terminal_command(cli: &str) -> Option<&'static str> {
    match cli {
        CLI_CLAUDE => Some("claude --dangerously-skip-permissions"),
        CLI_CODEX => Some("codex"),
        CLI_GEMINI => Some("gemini"),
        _ => None,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ProviderKind {
    OpenAiChat,
    OpenAiResponses,
    Anthropic,
    GeminiNative,
    Ollama,
    Unknown,
}

impl ProviderKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::OpenAiChat => "openai_chat",
            Self::OpenAiResponses => "openai_responses",
            Self::Anthropic => "anthropic",
            Self::GeminiNative => "gemini_native",
            Self::Ollama => "ollama",
            Self::Unknown => "unknown",
        }
    }

    pub fn from_db(value: &str) -> Self {
        match value {
            "openai_chat" => Self::OpenAiChat,
            "openai_responses" => Self::OpenAiResponses,
            "anthropic" => Self::Anthropic,
            "gemini_native" => Self::GeminiNative,
            "ollama" => Self::Ollama,
            _ => Self::Unknown,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderInput {
    pub id: Option<String>,
    pub name: String,
    pub base_url: String,
    pub api_key: Option<String>,
    pub default_model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Provider {
    pub id: String,
    pub name: String,
    pub base_url: String,
    pub provider_type: ProviderKind,
    pub default_model: Option<String>,
    pub secret_ref: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderModel {
    pub id: String,
    pub provider_id: String,
    pub model_id: String,
    pub context_window: Option<i64>,
    pub max_output_tokens: Option<i64>,
    pub supports_thinking: bool,
    pub supports_tools: bool,
    pub supports_json: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CliRoute {
    pub cli: String,
    pub provider_id: Option<String>,
    pub model: Option<String>,
    pub enabled: bool,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetCliRouteInput {
    pub cli: String,
    pub provider_id: Option<String>,
    pub model: Option<String>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalCommandConfig {
    pub cli: String,
    pub command: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetTerminalCommandInput {
    pub cli: String,
    pub command: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartTerminalInput {
    pub cli: String,
    pub session_id: String,
    pub rows: Option<u16>,
    pub cols: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSessionResult {
    pub cli: String,
    pub session_id: String,
    pub command: String,
    pub started: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalTranscriptResult {
    pub cli: String,
    pub session_id: Option<String>,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestLog {
    pub id: String,
    pub cli: String,
    pub provider_id: Option<String>,
    pub provider_name: Option<String>,
    pub model: Option<String>,
    pub status: String,
    pub http_status: Option<i64>,
    pub error_category: Option<String>,
    pub error_reason: Option<String>,
    pub latency_ms: i64,
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub created_at: String,
    pub data_source: String,
}

#[derive(Debug, Clone)]
pub struct NewRequestLog {
    pub cli: String,
    pub provider_id: Option<String>,
    pub provider_name: Option<String>,
    pub model: Option<String>,
    pub status: String,
    pub http_status: Option<i64>,
    pub error_category: Option<String>,
    pub error_reason: Option<String>,
    pub latency_ms: i64,
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub data_source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticDoc {
    pub id: String,
    pub provider: String,
    pub title: String,
    pub url: String,
    pub fetched_at: String,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticRule {
    pub id: String,
    pub provider: String,
    pub status_code: Option<i64>,
    pub category: String,
    pub reason: String,
    pub suggestion: String,
    pub source_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthCheckResult {
    pub ok: bool,
    pub provider_id: String,
    pub provider_name: String,
    pub provider_type: ProviderKind,
    pub tested_model: Option<String>,
    pub latency_ms: i64,
    pub http_status: Option<u16>,
    pub category: String,
    pub reason: String,
    pub suggestion: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaScanResult {
    pub ok: bool,
    pub provider: Option<Provider>,
    pub models: Vec<ProviderModel>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoParameterInput {
    pub prompt: String,
    pub temperature: Option<f32>,
    pub max_context_tokens: Option<i64>,
    pub reasoning_effort: Option<String>,
    pub thinking: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AutoParameterResult {
    pub temperature: f32,
    pub max_context_tokens: i64,
    pub reasoning_effort: String,
    pub thinking: bool,
    pub profile: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AxiSuiteSnapshot {
    pub product_name: String,
    pub desktop: AxiDesktopStatus,
    pub mobile: AxiMobileStatus,
    pub notify: AxiNotifyContract,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AxiDesktopStatus {
    pub shell: String,
    pub status: String,
    pub capabilities: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AxiMobileStatus {
    pub owner: String,
    pub package_name: String,
    pub project_path: String,
    pub latest_goal70_artifact: Option<String>,
    pub deep_links: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AxiNotifyContract {
    pub owner: String,
    pub endpoints: Vec<String>,
    pub auth_header: String,
}
