"""Regression tests for MiniMax api_key resolution.

The key used to be hardcoded in `mini_agent/config/config.yaml`. It is now a
`${MINIMAX_API_KEY}` placeholder resolved from the environment, so these tests
pin the behaviour that matters: a missing variable must fail loudly instead of
sending a literal `${...}` placeholder or an empty string to the API.
"""

import pytest
import yaml

from mini_agent.config import Config, resolve_env_placeholder

MINIMAL_CONFIG = {
    "api_key": "${MINIMAX_API_KEY}",
    "api_base": "https://api.minimaxi.com",
    "model": "MiniMax-M2.5",
    "provider": "anthropic",
}


def write_config(tmp_path, **overrides):
    data = dict(MINIMAL_CONFIG)
    data.update(overrides)
    path = tmp_path / "config.yaml"
    path.write_text(yaml.safe_dump(data), encoding="utf-8")
    return path


class TestResolveEnvPlaceholder:
    def test_placeholder_expands_from_environment(self, monkeypatch):
        monkeypatch.setenv("MINIMAX_API_KEY", "test-key-value")
        assert (
            resolve_env_placeholder("${MINIMAX_API_KEY}", "api_key", "config.yaml")
            == "test-key-value"
        )

    def test_missing_env_var_raises_with_actionable_message(self, monkeypatch):
        monkeypatch.delenv("MINIMAX_API_KEY", raising=False)
        with pytest.raises(ValueError) as exc:
            resolve_env_placeholder("${MINIMAX_API_KEY}", "api_key", "config.yaml")

        message = str(exc.value)
        assert "MINIMAX_API_KEY" in message
        # The message must tell the operator what to do, not just that it failed.
        assert "export MINIMAX_API_KEY=" in message
        assert "credentials/api-keys.env" in message

    def test_empty_env_var_raises_rather_than_returning_empty(self, monkeypatch):
        monkeypatch.setenv("MINIMAX_API_KEY", "")
        with pytest.raises(ValueError):
            resolve_env_placeholder("${MINIMAX_API_KEY}", "api_key", "config.yaml")

    def test_non_placeholder_value_passes_through_untouched(self, monkeypatch):
        monkeypatch.delenv("MINIMAX_API_KEY", raising=False)
        assert resolve_env_placeholder("plain-literal", "api_key", "config.yaml") == "plain-literal"


class TestConfigFromYaml:
    def test_missing_env_var_fails_loudly(self, tmp_path, monkeypatch):
        monkeypatch.delenv("MINIMAX_API_KEY", raising=False)
        path = write_config(tmp_path)

        with pytest.raises(ValueError) as exc:
            Config.from_yaml(path)
        assert "MINIMAX_API_KEY" in str(exc.value)

    def test_never_returns_placeholder_or_empty_api_key(self, tmp_path, monkeypatch):
        """The resolved key must never be a `${...}` placeholder or empty."""
        monkeypatch.setenv("MINIMAX_API_KEY", "test-key-value")
        config = Config.from_yaml(write_config(tmp_path))

        assert config.llm.api_key == "test-key-value"
        assert "${" not in config.llm.api_key
        assert config.llm.api_key.strip() != ""


class TestShippedConfigFile:
    def test_shipped_config_uses_placeholder_not_hardcoded_key(self):
        from pathlib import Path

        path = Path(__file__).resolve().parent.parent / "mini_agent" / "config" / "config.yaml"
        data = yaml.safe_load(path.read_text(encoding="utf-8"))

        assert data["api_key"] == "${MINIMAX_API_KEY}"