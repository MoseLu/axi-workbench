"""Regression tests for the DashScope credential resolution.

The DashScope key used to be a literal in ``api.py`` and
``build_parallel.py``. It was committed and pushed to origin, so it is
removed from the working tree and must come from the environment instead.

These tests cover the contract that replaced it: the key is read from
``DASHSCOPE_API_KEY``, and a missing (or blank) variable fails loudly with
a message that names the variable, instead of passing a literal or an empty
string to the API.

Run with:
    python3 -m unittest discover -s apps/app-search-system/backend -p 'test_*.py'
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dashscope_key import (  # noqa: E402  (path bootstrap must run first)
    DASHSCOPE_API_KEY_ENV,
    configure_dashscope,
    require_dashscope_api_key,
)


class RequireDashScopeApiKeyTest(unittest.TestCase):
    def test_unset_variable_raises_a_named_error(self):
        with self.assertRaises(RuntimeError) as ctx:
            require_dashscope_api_key(env={})

        message = str(ctx.exception)
        self.assertIn(DASHSCOPE_API_KEY_ENV, message)
        self.assertIn("not set", message)

    def test_blank_variable_raises_the_same_error(self):
        for blank in ("", "   ", "\t\n"):
            with self.subTest(value=repr(blank)):
                with self.assertRaises(RuntimeError) as ctx:
                    require_dashscope_api_key(env={DASHSCOPE_API_KEY_ENV: blank})
                self.assertIn(DASHSCOPE_API_KEY_ENV, str(ctx.exception))

    def test_present_variable_is_returned_trimmed(self):
        key = require_dashscope_api_key(env={DASHSCOPE_API_KEY_ENV: "  secret-value  "})
        self.assertEqual(key, "secret-value")

    def test_missing_variable_does_not_leak_a_previous_value(self):
        """A key resolved for one call must not satisfy the next one."""
        require_dashscope_api_key(env={DASHSCOPE_API_KEY_ENV: "secret-value"})
        with self.assertRaises(RuntimeError):
            require_dashscope_api_key(env={})


class ConfigureDashscopeTest(unittest.TestCase):
    def test_key_is_assigned_to_the_module(self):
        class FakeDashscope:
            api_key = None

        module = FakeDashscope()
        applied = configure_dashscope(module, env={DASHSCOPE_API_KEY_ENV: "secret-value"})

        self.assertEqual(module.api_key, "secret-value")
        self.assertEqual(applied, "secret-value")

    def test_unset_variable_leaves_the_module_untouched(self):
        class FakeDashscope:
            api_key = "previous"

        module = FakeDashscope()
        with self.assertRaises(RuntimeError):
            configure_dashscope(module, env={})

        self.assertEqual(module.api_key, "previous")


class SourceHasNoLiteralKeyTest(unittest.TestCase):
    """The credential must not reappear as a literal in the sources."""

    BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
    SOURCES = ("api.py", "build_parallel.py", "dashscope_key.py")

    def test_no_dashscope_key_literal_in_source(self):
        for name in self.SOURCES:
            path = os.path.join(self.BACKEND_DIR, name)
            with self.subTest(source=name):
                with open(path, "r", encoding="utf-8") as handle:
                    for lineno, line in enumerate(handle, start=1):
                        self.assertNotIn(
                            "dashscope.api_key = \"",
                            line,
                            "{0}:{1} assigns a literal DashScope key".format(name, lineno),
                        )


if __name__ == "__main__":
    unittest.main()
