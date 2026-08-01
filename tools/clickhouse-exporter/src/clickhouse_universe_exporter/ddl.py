from __future__ import annotations

from .models import QualifiedName


def parse_distributed_engine(engine_full: str) -> tuple[str, QualifiedName] | None:
    prefix = "Distributed("
    if not engine_full.startswith(prefix) or not engine_full.endswith(")"):
        return None
    body = engine_full[len(prefix) : -1]
    args: list[str] = []
    current: list[str] = []
    quote: str | None = None
    depth = 0
    index = 0
    while index < len(body):
        char = body[index]
        if quote:
            current.append(char)
            if char == quote:
                if index + 1 < len(body) and body[index + 1] == quote:
                    current.append(body[index + 1])
                    index += 1
                else:
                    quote = None
        elif char in ("'", "`", '"'):
            quote = char
            current.append(char)
        elif char == "(":
            depth += 1
            current.append(char)
        elif char == ")":
            depth -= 1
            current.append(char)
        elif char == "," and depth == 0:
            args.append("".join(current).strip())
            current = []
        else:
            current.append(char)
        index += 1
    args.append("".join(current).strip())
    if len(args) < 3:
        return None
    static = [_static_arg(value) for value in args[:3]]
    if any(value is None for value in static):
        return None
    cluster, database, table = static
    assert cluster is not None and database is not None and table is not None
    return cluster, QualifiedName(database, table)


def _static_arg(value: str) -> str | None:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", "`", '"'):
        quote = value[0]
        return value[1:-1].replace(quote * 2, quote)
    if value and all(char.isalnum() or char in "_-$" for char in value):
        return value
    return None
