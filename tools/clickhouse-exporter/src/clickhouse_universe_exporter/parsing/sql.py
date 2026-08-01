from __future__ import annotations

import re
from dataclasses import dataclass

from antlr4 import CommonTokenStream, InputStream
from antlr4.error.ErrorListener import ErrorListener

from ..models import QualifiedName
from .generated_ch_parser.ClickHouseLexer import ClickHouseLexer
from .generated_ch_parser.ClickHouseParser import ClickHouseParser


class SqlParseError(ValueError):
    pass


class _RaisingErrorListener(ErrorListener):
    def syntaxError(self, _recognizer, _offending_symbol, line, column, msg, _error):
        raise SqlParseError(f"SQL syntax error at {line}:{column}: {msg}")


@dataclass(frozen=True)
class InsertSelect:
    destination: QualifiedName
    sources: frozenset[QualifiedName]


def _unquote(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ('`', '"'):
        quote = value[0]
        return value[1:-1].replace(quote * 2, quote)
    return value


def _lex_and_validate(sql: str) -> list[str]:
    lexer = ClickHouseLexer(InputStream(sql))
    lexer.removeErrorListeners()
    lexer.addErrorListener(_RaisingErrorListener())
    stream = CommonTokenStream(lexer)
    stream.fill()

    parser = ClickHouseParser(stream)
    parser.removeErrorListeners()
    parser.addErrorListener(_RaisingErrorListener())
    root = None
    for entry_name in ("queryStmt", "statement", "sqlStatement", "sqlStatements", "query"):
        entry = getattr(parser, entry_name, None)
        if entry is not None:
            root = entry()
            break
    if root is None:
        raise SqlParseError("Pinned ClickHouse grammar exposes no supported entry rule")
    return [token.text for token in stream.tokens if token.type > 0]


def _qualified(tokens: list[str], index: int, default_database: str) -> tuple[QualifiedName, int]:
    if index >= len(tokens):
        raise SqlParseError("Expected a table identifier")
    first = _unquote(tokens[index])
    if not first or first in ("(", ")"):
        raise SqlParseError("Expected a static table identifier")
    if index + 2 < len(tokens) and tokens[index + 1] == ".":
        second = _unquote(tokens[index + 2])
        if not second:
            raise SqlParseError("Expected a table name after '.'")
        return QualifiedName(first, second), index + 3
    return QualifiedName(default_database, first), index + 1


def _cte_names(tokens: list[str]) -> set[str]:
    names: set[str] = set()
    depth = 0
    for index, token in enumerate(tokens[:-1]):
        upper = token.upper()
        depth += token == "("
        depth -= token == ")"
        if upper == "AS" and tokens[index + 1] == "(" and index:
            candidate = _unquote(tokens[index - 1])
            if re.fullmatch(r"[\w$-]+", candidate, re.UNICODE):
                names.add(candidate)
        if depth == 0 and upper == "SELECT":
            break
    return names


def _select_sources(tokens: list[str], default_database: str) -> frozenset[QualifiedName]:
    sources: set[QualifiedName] = set()
    ctes = _cte_names(tokens)
    index = 0
    while index < len(tokens):
        upper = tokens[index].upper()
        if upper not in ("FROM", "JOIN"):
            index += 1
            continue
        index += 1
        while index < len(tokens) and tokens[index].upper() in (
            "GLOBAL",
            "LOCAL",
            "ANY",
            "ALL",
            "ASOF",
            "ANTI",
            "SEMI",
        ):
            index += 1
        if index >= len(tokens) or tokens[index] == "(":
            continue
        if index + 1 < len(tokens) and tokens[index + 1] == "(":
            # A table function, not an exported physical object.
            index += 1
            continue
        name, index = _qualified(tokens, index, default_database)
        if name.database != default_database or name.table not in ctes:
            sources.add(name)
    return frozenset(sources)


def find_view_sources(sql: str, default_database: str) -> frozenset[QualifiedName]:
    tokens = _lex_and_validate(sql)
    if not any(token.upper() == "SELECT" for token in tokens):
        raise SqlParseError("View definition contains no SELECT")
    return _select_sources(tokens, default_database)


def parse_insert_select(sql: str, default_database: str) -> InsertSelect | None:
    tokens = _lex_and_validate(sql)
    upper = [token.upper() for token in tokens]
    try:
        insert_index = upper.index("INSERT")
    except ValueError:
        return None
    index = insert_index + 1
    if index < len(tokens) and upper[index] == "INTO":
        index += 1
    if index < len(tokens) and upper[index] in ("TABLE",):
        index += 1
    if index < len(tokens) and upper[index] == "FUNCTION":
        raise SqlParseError("INSERT INTO FUNCTION has no static destination")
    destination, _ = _qualified(tokens, index, default_database)
    try:
        select_index = upper.index("SELECT", index)
    except ValueError:
        return None
    sources = _select_sources(tokens[select_index:], default_database)
    if not sources:
        raise SqlParseError("INSERT SELECT contains no static table source")
    return InsertSelect(destination, sources)
