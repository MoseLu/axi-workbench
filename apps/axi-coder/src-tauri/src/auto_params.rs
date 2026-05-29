use crate::models::{AutoParameterInput, AutoParameterResult};

pub fn derive(input: AutoParameterInput) -> AutoParameterResult {
    let prompt = input.prompt.to_ascii_lowercase();
    let word_count = input.prompt.split_whitespace().count() as i64;
    let char_count = input.prompt.chars().count() as i64;

    let is_code_or_math = contains_any(
        &prompt,
        &[
            "code",
            "debug",
            "refactor",
            "typescript",
            "rust",
            "python",
            "sql",
            "prove",
            "math",
            "equation",
            "algorithm",
        ],
    );
    let is_creative = contains_any(
        &prompt,
        &[
            "story",
            "poem",
            "creative",
            "brainstorm",
            "tagline",
            "copywriting",
            "novel",
            "roleplay",
        ],
    );
    let long_context = word_count > 1_500 || char_count > 8_000;
    let short_prompt = word_count <= 24 && char_count <= 180;

    let (profile, temperature, max_context_tokens, reasoning_effort, thinking) = if is_code_or_math
    {
        ("coding_math", 0.2, 128_000, "high", true)
    } else if is_creative {
        ("creative", 0.9, 64_000, "medium", false)
    } else if long_context {
        ("long_context", 0.3, 192_000, "medium", true)
    } else if short_prompt {
        ("short_prompt", 0.4, 32_000, "low", false)
    } else {
        ("balanced", 0.5, 64_000, "medium", false)
    };

    AutoParameterResult {
        temperature: input.temperature.unwrap_or(temperature),
        max_context_tokens: input.max_context_tokens.unwrap_or(max_context_tokens),
        reasoning_effort: input
            .reasoning_effort
            .unwrap_or_else(|| reasoning_effort.to_string()),
        thinking: input.thinking.unwrap_or(thinking),
        profile: profile.to_string(),
    }
}

fn contains_any(haystack: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| haystack.contains(needle))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input(prompt: &str) -> AutoParameterInput {
        AutoParameterInput {
            prompt: prompt.to_string(),
            temperature: None,
            max_context_tokens: None,
            reasoning_effort: None,
            thinking: None,
        }
    }

    #[test]
    fn maps_coding_and_math_to_lower_temperature_and_thinking() {
        let result = derive(input("debug this Rust algorithm and prove the edge cases"));
        assert_eq!(result.profile, "coding_math");
        assert!(result.temperature < 0.4);
        assert_eq!(result.reasoning_effort, "high");
        assert!(result.thinking);
    }

    #[test]
    fn maps_creative_prompts_to_higher_temperature() {
        let result = derive(input("write a creative story tagline"));
        assert_eq!(result.profile, "creative");
        assert!(result.temperature > 0.7);
        assert!(!result.thinking);
    }

    #[test]
    fn keeps_explicit_parameters() {
        let mut request = input("short");
        request.temperature = Some(0.12);
        request.reasoning_effort = Some("xhigh".to_string());
        let result = derive(request);
        assert_eq!(result.temperature, 0.12);
        assert_eq!(result.reasoning_effort, "xhigh");
    }
}
