"""DashScope API key resolution for the SOP search backend.

The DashScope credential used to be a literal in this package
(``api.py`` and ``build_parallel.py``). It was committed to git and pushed
to origin, so the literal has been removed from the working tree; the
value must now be supplied through the environment.

Set ``DASHSCOPE_API_KEY`` to the key from the DashScope console
(API-KEY management) before starting the backend or running the embedding
builders:

    export DASHSCOPE_API_KEY=<your-key>

The key is never stored in this repository. A literal that already reached
``origin`` has to be rotated in the DashScope console; removing it from the
working tree does not remove it from git history.
"""

import os

#: Name of the environment variable that carries the DashScope API key.
DASHSCOPE_API_KEY_ENV = "DASHSCOPE_API_KEY"

_HOW_TO_FIX = (
    "Set the {env} environment variable to your DashScope API key "
    "(DashScope console -> API-KEY management), for example:\n"
    "  export {env}=<your-key>\n"
    "The key is not stored in this repository.".format(env=DASHSCOPE_API_KEY_ENV)
)


def require_dashscope_api_key(env=None):
    """Return the DashScope API key from the environment.

    Args:
        env: optional mapping used instead of ``os.environ``. Injecting a
            mapping keeps the resolution logic testable without mutating
            the process environment.

    Returns:
        The trimmed API key.

    Raises:
        RuntimeError: when the variable is unset, empty or blank. The
            message names the variable and how to supply it, so the failure
            is actionable instead of surfacing as an opaque 401 later.
    """
    source = os.environ if env is None else env
    value = source.get(DASHSCOPE_API_KEY_ENV)
    if value is None or not value.strip():
        raise RuntimeError(
            "{env} is not set. {how}".format(
                env=DASHSCOPE_API_KEY_ENV, how=_HOW_TO_FIX
            )
        )
    return value.strip()


def configure_dashscope(dashscope_module, env=None):
    """Apply the environment-provided key to a ``dashscope`` module.

    Returns the key that was applied, so a caller can log the fact that a
    credential was resolved without logging the credential itself.
    """
    key = require_dashscope_api_key(env)
    dashscope_module.api_key = key
    return key
