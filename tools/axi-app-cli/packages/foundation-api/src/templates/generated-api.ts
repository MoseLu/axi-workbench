import type { ScaffoldConfig } from '@axi/scaffold-kit';

export function createFlaskReadme(config: ScaffoldConfig): string {
  return `# API

The API starts with a single health feature and an app factory in \`src/${config.pythonModuleName}/app.py\`.
Use new feature directories under \`src/${config.pythonModuleName}/features\` as the API grows.
`;
}

export function createPyProject(config: ScaffoldConfig): string {
  return `[build-system]
requires = ["setuptools>=68", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "${config.packageSlug}-api"
version = "0.1.0"
description = "Flask API scaffold for ${config.projectName}"
readme = "README.md"
requires-python = ">=3.10"
dependencies = [
  "Flask>=3.1,<4",
]

[project.optional-dependencies]
dev = [
  "pytest>=9,<10",
  "pytest-cov>=7,<8",
]

[tool.setuptools.packages.find]
where = ["src"]

[tool.pytest.ini_options]
addopts = "--cov=${config.pythonModuleName} --cov-report=term-missing --cov-fail-under=80"
pythonpath = ["src"]
testpaths = ["tests"]
`;
}

export function createApiInit(): string {
  return `from .app import create_app

__all__ = ["create_app"]
`;
}

export function createApiConfig(): string {
  return `class Config:
    TESTING = False
`;
}

export function createApiApp(): string {
  return `from flask import Flask

from .config import Config
from .features import register_feature_blueprints


def create_app(config_object: type[Config] = Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_object)
    register_feature_blueprints(app)
    return app
`;
}

export function createApiFeatureInit(): string {
  return `from importlib import import_module
from pathlib import Path

from flask import Flask


def register_feature_blueprints(app: Flask) -> None:
    features_root = Path(__file__).parent

    for feature_path in sorted(features_root.iterdir()):
        if not feature_path.is_dir() or feature_path.name.startswith("_"):
            continue

        routes_module = import_module(f"{__name__}.{feature_path.name}.routes")
        blueprint = getattr(routes_module, "blueprint", None)
        fallback_blueprint = getattr(routes_module, f"{feature_path.name}_blueprint", None)

        if blueprint is not None:
            app.register_blueprint(blueprint)
        elif fallback_blueprint is not None:
            app.register_blueprint(fallback_blueprint)
`;
}

export function createHealthInit(): string {
  return `from .routes import health_blueprint

__all__ = ["health_blueprint"]
`;
}

export function createHealthRoutes(): string {
  return `from flask import Blueprint, jsonify

from .service import get_health_status

health_blueprint = Blueprint("health", __name__)


@health_blueprint.get("/health")
def health() -> tuple:
    return jsonify(get_health_status()), 200
`;
}

export function createHealthService(): string {
  return `def get_health_status() -> dict[str, str]:
    return {"feature": "health", "status": "ok"}
`;
}

export function createApiTest(config: ScaffoldConfig): string {
  return `from ${config.pythonModuleName}.app import create_app


def test_health_blueprint_returns_ok() -> None:
    client = create_app().test_client()
    response = client.get("/health")

    assert response.status_code == 200
    assert response.get_json() == {"feature": "health", "status": "ok"}
`;
}
