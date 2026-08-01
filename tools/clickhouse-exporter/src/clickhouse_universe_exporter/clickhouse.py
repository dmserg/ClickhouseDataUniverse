from __future__ import annotations

import uuid
from collections.abc import Mapping
from typing import Any, Protocol

from .config import ConnectionConfig


class ClickHouseError(RuntimeError):
    pass


class QueryClient(Protocol):
    def query_rows(
        self, sql: str, parameters: Mapping[str, Any] | None = None
    ) -> list[dict[str, Any]]: ...

    def close(self) -> None: ...


class ClickHouseClient:
    def __init__(self, driver_client: Any):
        self._client = driver_client
        # The transport timeout is set on the client. The exporter issues only hard-coded
        # SELECTs and expects a server-side read-only account; such accounts usually cannot
        # change even the `readonly` setting per query.
        self._settings: dict[str, Any] = {}

    def query_rows(
        self, sql: str, parameters: Mapping[str, Any] | None = None
    ) -> list[dict[str, Any]]:
        try:
            result = self._client.query(
                sql,
                parameters=dict(parameters or {}),
                settings=self._settings,
                transport_settings={
                    "query_id": f"clickhouse-universe-exporter-{uuid.uuid4().hex}"
                },
            )
            names = tuple(result.column_names)
            return [dict(zip(names, row, strict=True)) for row in result.result_rows]
        except Exception as error:
            # Driver errors can include a DSN. Do not include their text in exporter output.
            raise ClickHouseError(
                f"ClickHouse query failed ({type(error).__name__}); verify TLS, credentials, "
                "timeouts, and required system-table grants"
            ) from error

    def close(self) -> None:
        close = getattr(self._client, "close", None)
        if close is not None:
            close()


def connect(config: ConnectionConfig) -> ClickHouseClient:
    # Deliberately import only after the fixed home properties file has been validated.
    import clickhouse_connect

    options: dict[str, Any] = {
        "host": config.host,
        "port": config.port,
        "username": config.username,
        "password": config.password,
        "secure": config.secure,
        "verify": config.verify,
        "connect_timeout": config.connect_timeout_seconds,
        "send_receive_timeout": config.query_timeout_seconds,
    }
    if config.ca_cert is not None:
        options["ca_cert"] = str(config.ca_cert)
    try:
        return ClickHouseClient(clickhouse_connect.get_client(**options))
    except Exception as error:
        raise ClickHouseError(
            f"Could not connect to ClickHouse ({type(error).__name__}); verify the protected "
            "home properties file and network access"
        ) from error
