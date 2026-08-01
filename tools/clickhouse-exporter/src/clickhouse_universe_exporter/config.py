from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass
from pathlib import Path

PROPERTIES_FILENAME = ".clickhouse-universe-exporter.properties"
_KNOWN_KEYS = {
    "clickhouse.host",
    "clickhouse.port",
    "clickhouse.username",
    "clickhouse.password",
    "clickhouse.secure",
    "clickhouse.verify",
    "clickhouse.ca_cert",
    "clickhouse.cluster",
    "clickhouse.connect_timeout_seconds",
    "clickhouse.query_timeout_seconds",
}
_REQUIRED_KEYS = {
    "clickhouse.host",
    "clickhouse.port",
    "clickhouse.username",
    "clickhouse.password",
    "clickhouse.secure",
    "clickhouse.verify",
}


class ConfigurationError(ValueError):
    pass


@dataclass(frozen=True)
class ConnectionConfig:
    host: str
    port: int
    username: str
    password: str
    secure: bool
    verify: bool
    ca_cert: Path | None = None
    cluster: str | None = None
    connect_timeout_seconds: int = 10
    query_timeout_seconds: int = 60

    def __repr__(self) -> str:
        fields = (
            f"host={self.host!r}, port={self.port!r}, username={self.username!r}, "
            "password='<redacted>', "
            f"secure={self.secure!r}, verify={self.verify!r}, ca_cert={self.ca_cert!r}, "
            f"cluster={self.cluster!r}, connect_timeout_seconds={self.connect_timeout_seconds!r}, "
            f"query_timeout_seconds={self.query_timeout_seconds!r}"
        )
        return f"ConnectionConfig({fields})"


def properties_path(home: Path | None = None) -> Path:
    return (home if home is not None else Path.home()) / PROPERTIES_FILENAME


def _parse_bool(key: str, value: str) -> bool:
    normalized = value.casefold()
    if normalized == "true":
        return True
    if normalized == "false":
        return False
    raise ConfigurationError(f"{key} must be 'true' or 'false'")


def _parse_positive_int(key: str, value: str, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value)
    except ValueError as error:
        raise ConfigurationError(f"{key} must be an integer") from error
    if not minimum <= parsed <= maximum:
        raise ConfigurationError(f"{key} must be between {minimum} and {maximum}")
    return parsed


def _validate_permissions(path: Path) -> None:
    if os.name != "nt":
        if path.stat().st_mode & 0o077:
            raise ConfigurationError(
                f"{path} is readable by other users; run: chmod 600 {path}"
            )
        return

    completed = subprocess.run(
        ["icacls", str(path)],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if completed.returncode != 0:
        raise ConfigurationError(
            f"Could not verify the ACL for {path}; restrict it to the current Windows user"
        )
    broad_principals = ("Everyone:", "BUILTIN\\Users:", "Authenticated Users:")
    broad_rights = ("(F)", "(M)", "(RX)", "(R)")
    for line in completed.stdout.splitlines():
        if any(principal.casefold() in line.casefold() for principal in broad_principals) and any(
            right in line for right in broad_rights
        ):
            raise ConfigurationError(
                f"{path} is broadly readable; remove inherited access with icacls and grant only "
                "the current user read access"
            )


def load_properties(home: Path | None = None, *, check_permissions: bool = True) -> ConnectionConfig:
    path = properties_path(home)
    if not path.is_file():
        raise ConfigurationError(
            f"Missing {path}. Copy the repository's placeholder example there and restrict access "
            "to the current user."
        )
    if check_permissions:
        _validate_permissions(path)

    values: dict[str, str] = {}
    for line_number, raw_line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if "=" not in raw_line:
            raise ConfigurationError(f"{path}:{line_number}: expected key=value")
        key, value = (part.strip() for part in raw_line.split("=", 1))
        if key not in _KNOWN_KEYS:
            raise ConfigurationError(f"{path}:{line_number}: unknown key {key!r}")
        if key in values:
            raise ConfigurationError(f"{path}:{line_number}: duplicate key {key!r}")
        values[key] = value

    missing = sorted(_REQUIRED_KEYS - values.keys())
    if missing:
        raise ConfigurationError(f"{path}: missing required keys: {', '.join(missing)}")
    # Empty passwords are valid for public, anonymous endpoints such as play.clickhouse.com.
    for key in sorted(_REQUIRED_KEYS - {"clickhouse.password"}):
        if not values[key]:
            raise ConfigurationError(f"{path}: {key} must not be empty")

    ca_cert: Path | None = None
    if values.get("clickhouse.ca_cert"):
        ca_cert = Path(values["clickhouse.ca_cert"]).expanduser().resolve()
        if not ca_cert.is_file():
            raise ConfigurationError(f"{path}: clickhouse.ca_cert does not reference a file")

    cluster = values.get("clickhouse.cluster") or None
    return ConnectionConfig(
        host=values["clickhouse.host"],
        port=_parse_positive_int("clickhouse.port", values["clickhouse.port"], 1, 65535),
        username=values["clickhouse.username"],
        password=values["clickhouse.password"],
        secure=_parse_bool("clickhouse.secure", values["clickhouse.secure"]),
        verify=_parse_bool("clickhouse.verify", values["clickhouse.verify"]),
        ca_cert=ca_cert,
        cluster=cluster,
        connect_timeout_seconds=_parse_positive_int(
            "clickhouse.connect_timeout_seconds",
            values.get("clickhouse.connect_timeout_seconds", "10"),
            1,
            300,
        ),
        query_timeout_seconds=_parse_positive_int(
            "clickhouse.query_timeout_seconds",
            values.get("clickhouse.query_timeout_seconds", "60"),
            1,
            3600,
        ),
    )
