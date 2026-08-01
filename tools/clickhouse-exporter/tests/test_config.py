from pathlib import Path

import pytest

from clickhouse_universe_exporter.config import ConfigurationError, load_properties

BASE = """\
clickhouse.host=play.clickhouse.com
clickhouse.port=443
clickhouse.username=explorer
clickhouse.password=
clickhouse.secure=true
clickhouse.verify=true
"""


def write(home: Path, content: str = BASE) -> Path:
    path = home / ".clickhouse-universe-exporter.properties"
    path.write_text(content, encoding="utf-8")
    return path


def test_loads_playground_properties_and_redacts_empty_password(tmp_path: Path) -> None:
    write(tmp_path)
    config = load_properties(tmp_path, check_permissions=False)
    assert config.host == "play.clickhouse.com"
    assert config.port == 443
    assert config.password == ""
    assert "password='<redacted>'" in repr(config)


@pytest.mark.parametrize(
    "content, expected",
    [
        (BASE + "clickhouse.host=again\n", "duplicate key"),
        (BASE + "clickhouse.unknown=x\n", "unknown key"),
        (BASE.replace("clickhouse.secure=true", "clickhouse.secure=yes"), "must be 'true'"),
        (BASE.replace("clickhouse.port=443", "clickhouse.port=99999"), "between 1 and 65535"),
    ],
)
def test_rejects_malformed_properties(tmp_path: Path, content: str, expected: str) -> None:
    write(tmp_path, content)
    with pytest.raises(ConfigurationError, match=expected):
        load_properties(tmp_path, check_permissions=False)


def test_missing_properties_does_not_read_real_home(tmp_path: Path) -> None:
    with pytest.raises(ConfigurationError, match="Missing"):
        load_properties(tmp_path, check_permissions=False)
