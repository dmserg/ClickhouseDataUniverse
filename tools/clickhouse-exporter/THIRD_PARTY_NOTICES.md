# Third-party notices

## clickhouse_objects_analysis

- Source: <https://github.com/dmserg/clickhouse_objects_analysis>
- Pinned commit: `0e7eab950135bedfa27946c32ab89630389a9392`
- Used components: generated ClickHouse ANTLR lexer/parser.
- Local changes: copied the three generated Python modules into the exporter package and wrapped
  them behind an exporter-owned parsing interface.

The upstream author explicitly authorized copying these files into ClickHouse Universe. The
upstream repository does not contain a standalone license file.

The generated parser is based on the ClickHouse ANTLR grammar. ClickHouse is licensed under
Apache-2.0.
