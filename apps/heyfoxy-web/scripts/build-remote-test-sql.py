#!/usr/bin/env python3
"""Genera la batería de aislamiento para ejecutarla en Supabase QA de Hey Foxy SIN dejar residuos.

Uso:  python3 -I scripts/build-remote-test-sql.py > /ruta/temporal/remote_isolation.sql
      python3 -I scripts/build-remote-test-sql.py 0006 > /ruta/temporal/remote_0006.sql
      (la segunda variante ejecuta tests/sql/40_migration_0006.test.sql: medios, Storage,
       guardas de datos reales, interruptor global; esperado 'HF_TESTS_PASSED 46')

Transformaciones sobre tests/sql/10_isolation.test.sql:
  - Elimina metacomandos de psql (líneas que empiezan por '\\').
  - Todo corre en UNA transacción. Las funciones auxiliares se crean en pg_temp y cada
    aserción superada se registra en una tabla temporal.
  - La última sentencia lanza SIEMPRE una excepción 'HF_TESTS_PASSED <n>'. Esa excepción
    aborta la transacción, así que la base vuelve a su estado anterior aunque el cliente
    use autocommit. Una aserción fallida aborta igual con 'ASSERT FAILED: ...'.

Resultado esperado en QA: error con el texto 'HF_TESTS_PASSED 126' (122 antes de 0006) y cero filas nuevas.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SUITES = {
    "isolation": (ROOT / "tests" / "sql" / "10_isolation.test.sql", 126),  # 122 con 0001–0005
    "0006": (ROOT / "tests" / "sql" / "40_migration_0006.test.sql", 46),
}
SRC, EXPECTED = SUITES[sys.argv[1] if len(sys.argv) > 1 else "isolation"]

sql = SRC.read_text(encoding="utf-8")
sql = "\n".join(line for line in sql.splitlines() if not line.lstrip().startswith("\\"))

# Helpers en pg_temp: no crean objetos persistentes en public.
sql = sql.replace("create or replace function public.t_", "create or replace function pg_temp.t_")
sql = re.sub(r"\bpublic\.t_(assert|expect_error|affected)\(", r"pg_temp.t_\1(", sql)
# Llamadas sin esquema (40_migration_0006): las funciones de pg_temp no se buscan implícitamente.
sql = re.sub(r"(?<![\w.])t_(assert|expect_error|affected)\(", r"pg_temp.t_\1(", sql)
# Registrar cada aserción superada.
sql = sql.replace(
    "raise notice 'ok - %', msg;",
    "insert into pg_temp.t_results values (msg); raise notice 'ok - %', msg;",
)
sql = sql.replace(
    "raise notice 'ok - % (rechazado: %)', msg, sqlerrm;",
    "insert into pg_temp.t_results values (msg); raise notice 'ok - % (rechazado: %)', msg, sqlerrm;",
)
sql = sql.replace("select 'ALL ISOLATION TESTS PASSED' as result;", "")

header = (
    "-- GENERADO por scripts/build-remote-test-sql.py. No editar ni versionar.\n"
    "begin;\n"
    "create temp table t_results (msg text) on commit drop;\n"
    "grant all on t_results to public;\n"
)
footer = f"""
do $hf$
declare n integer;
begin
  select count(*) into n from pg_temp.t_results;
  if n <> {EXPECTED} then
    raise exception 'HF_TESTS_INCOMPLETE % de {EXPECTED}', n;
  end if;
  raise exception 'HF_TESTS_PASSED %', n;  -- aborta y revierte TODO a propósito
end
$hf$;
rollback;
"""
sys.stdout.write(header + sql + footer)
