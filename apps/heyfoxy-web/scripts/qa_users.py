#!/usr/bin/env python3
"""Hey Foxy — usuarios QA y credenciales privadas (WO-MFOX-HEYFOXY-001, Gate 2).

Las contraseñas se generan en este Mac y se guardan SOLO en el llavero (Keychain) de macOS.
Nunca se imprimen, ni van a Git, logs, chat o Supabase: a Supabase solo viaja su hash bcrypt.

Uso (python3 -I scripts/qa_users.py <comando>):
  create-sql <salida.sql>        Genera 6 contraseñas, las guarda en el llavero y escribe el SQL
                                 de alta (solo hashes) en <salida.sql>, fuera del repositorio.
  rotate <email> <salida.sql>    Nueva contraseña para un usuario (llavero + SQL de UPDATE).
  status                         Lista qué usuarios tienen contraseña en el llavero (sin mostrarla).
  verify                         Inicia sesión contra Supabase QA con cada usuario y muestra solo
                                 OK/FALLO. Requiere HF_SUPABASE_URL y HF_SUPABASE_PUBLISHABLE_KEY.

Variables: HF_KEYCHAIN (ruta de llavero alternativo, para pruebas), HF_PGBIN (binarios de Postgres).
Aplicar el SQL generado en heyfoxy-qa requiere GO explícito.
"""
import json
import os
import pathlib
import secrets
import shutil
import string
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request

PROJECT_REF = "admbpgqtgmaaofcgajzh"
SERVICE = f"Hey Foxy QA ({PROJECT_REF})"
REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]
USERS = [
    # id fijo, correo (.test es un TLD reservado: no puede pertenecer a terceros), nombre, org, rol
    ("9f000000-0000-4000-8000-000000000001", "qa-owner@heyfoxy.test", "Laura Ríos (QA owner)", "Clínica Aurora", "owner"),
    ("9f000000-0000-4000-8000-000000000002", "qa-admin@heyfoxy.test", "Diego Mora (QA admin)", "Clínica Aurora", "admin"),
    ("9f000000-0000-4000-8000-000000000003", "qa-analyst@heyfoxy.test", "Andrea Gil (QA analyst)", "Clínica Aurora", "analyst"),
    ("9f000000-0000-4000-8000-000000000004", "qa-responder@heyfoxy.test", "Camilo Paz (QA responder)", "Clínica Aurora", "responder"),
    ("9f000000-0000-4000-8000-000000000005", "qa-viewer@heyfoxy.test", "Mateo Silva (QA viewer)", "Clínica Aurora", "viewer"),
    ("9f000000-0000-4000-8000-000000000006", "qa-owner-b@heyfoxy.test", "Sofía Lara (QA owner banco)", "Banco Horizonte", "owner"),
]
# Sin comillas, barras, espacios ni caracteres ambiguos: se puede copiar y pegar sin errores.
ALPHABET = "".join(c for c in string.ascii_letters + string.digits + "-_.:+=@#%" if c not in "0O1lI")


def die(msg: str) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def new_password() -> str:
    while True:
        pw = "".join(secrets.choice(ALPHABET) for _ in range(24))
        if (any(c.isupper() for c in pw) and any(c.islower() for c in pw)
                and any(c.isdigit() for c in pw) and any(not c.isalnum() for c in pw)):
            return pw


def keychain_args() -> list:
    kc = os.environ.get("HF_KEYCHAIN")
    return [kc] if kc else []


def keychain_store(email: str, name: str, org: str, role: str, pw: str) -> None:
    # `security -i` lee el comando por stdin: la contraseña no aparece en la lista de procesos.
    kc = " ".join(f'"{k}"' for k in keychain_args())
    label = f"Hey Foxy QA - {email}"
    comment = f"{name} | {org} | rol {role} | Supabase heyfoxy-qa ({PROJECT_REF})"
    cmd = (f'add-generic-password -U -s "{SERVICE}" -a "{email}" -l "{label}" '
           f'-j "{comment}" -w "{pw}" {kc}\n')
    res = subprocess.run(["security", "-i"], input=cmd, text=True, capture_output=True)
    if res.returncode != 0 or "error" in (res.stdout + res.stderr).lower():
        die(f"no se pudo guardar la contraseña de {email} en el llavero")


def keychain_read(email: str):
    res = subprocess.run(["security", "find-generic-password", "-s", SERVICE, "-a", email, "-w", *keychain_args()],
                         capture_output=True, text=True)
    return res.stdout.rstrip("\n") if res.returncode == 0 else None


def bcrypt_hashes(passwords: list) -> list:
    """bcrypt (pgcrypto, cost 10) en un Postgres local efímero. La contraseña entra por stdin."""
    pgbin = os.environ.get("HF_PGBIN") or os.path.dirname(shutil.which("pg_ctl") or "")
    if not pgbin:
        die("no se encontró pg_ctl (definir HF_PGBIN)")
    tmp = tempfile.mkdtemp(prefix="hfqa-")
    data, port = os.path.join(tmp, "data"), "55799"
    try:
        subprocess.run([f"{pgbin}/initdb", "-D", data, "-U", "postgres", "-A", "trust"], check=True, capture_output=True)
        subprocess.run([f"{pgbin}/pg_ctl", "-D", data, "-o", f"-p {port} -k {tmp} -c listen_addresses='' -c log_statement=none",
                        "-l", os.path.join(tmp, "log"), "-w", "start"], check=True, capture_output=True)
        sql = "create extension if not exists pgcrypto;\n" + "".join(
            f"select crypt('{pw}', gen_salt('bf', 10));\n" for pw in passwords)
        res = subprocess.run([f"{pgbin}/psql", "-h", tmp, "-p", port, "-U", "postgres", "-d", "postgres",
                              "-X", "-A", "-t", "-q", "-v", "ON_ERROR_STOP=1", "-f", "-"],
                             input=sql, text=True, capture_output=True)
        if res.returncode != 0:
            die("falló el cálculo de hashes")
        hashes = [h for h in res.stdout.split("\n") if h.startswith("$2")]
        if len(hashes) != len(passwords):
            die("número de hashes inesperado")
        return hashes
    finally:
        subprocess.run([f"{pgbin}/pg_ctl", "-D", data, "-m", "immediate", "stop"], capture_output=True)
        shutil.rmtree(tmp, ignore_errors=True)


def out_path(arg: str) -> pathlib.Path:
    p = pathlib.Path(arg).resolve()
    if REPO_ROOT in p.parents:
        die("el SQL con hashes no puede escribirse dentro del repositorio")
    return p


def sql_literal(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def cmd_create_sql(dest: str) -> None:
    path = out_path(dest)
    pws = [new_password() for _ in USERS]
    hashes = bcrypt_hashes(pws)
    for (uid, email, name, org, role), pw in zip(USERS, pws):
        keychain_store(email, name, org, role, pw)
    del pws
    emails = ", ".join(sql_literal(u[1]) for u in USERS)
    lines = [
        "-- GENERADO por scripts/qa_users.py create-sql. Contiene SOLO hashes bcrypt. No versionar.",
        f"-- Destino exclusivo: heyfoxy-qa ({PROJECT_REF}). Requiere GO.",
        "begin;",
        "do $g$ begin",
        f"  if exists (select 1 from auth.users where email in ({emails})) then",
        "    raise exception 'Ya existen usuarios QA: usar rotate en lugar de create-sql';",
        "  end if;",
        "end $g$;",
    ]
    for (uid, email, name, _org, _role), h in zip(USERS, hashes):
        meta = json.dumps({"full_name": name}, ensure_ascii=False)
        ident = json.dumps({"sub": uid, "email": email, "email_verified": True, "phone_verified": False})
        lines.append(
            "insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,"
            " raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,"
            " email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token,"
            " reauthentication_token, is_sso_user, is_anonymous) values ("
            f"'00000000-0000-0000-0000-000000000000', '{uid}', 'authenticated', 'authenticated', {sql_literal(email)},"
            f" {sql_literal(h)}, now(), '{{\"provider\":\"email\",\"providers\":[\"email\"]}}'::jsonb,"
            f" {sql_literal(meta)}::jsonb, now(), now(), '', '', '', '', '', '', '', '', false, false);")
        lines.append(
            "insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)"
            f" values ('{uid}', '{uid}', {sql_literal(ident)}::jsonb, 'email', null, now(), now());")
    lines.append("commit;")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    os.chmod(path, 0o600)
    print(f"OK: 6 contraseñas guardadas en el llavero (servicio «{SERVICE}»).")
    print(f"OK: SQL de alta (solo hashes) en {path}")


def cmd_rotate(email: str, dest: str) -> None:
    user = next((u for u in USERS if u[1] == email), None)
    if not user:
        die("correo no reconocido")
    path = out_path(dest)
    pw = new_password()
    (h,) = bcrypt_hashes([pw])
    keychain_store(email, user[2], user[3], user[4], pw)
    del pw
    path.write_text(
        "-- GENERADO por scripts/qa_users.py rotate. Solo hash bcrypt. No versionar. Requiere GO.\n"
        f"update auth.users set encrypted_password = {sql_literal(h)}, updated_at = now()\n"
        f" where email = {sql_literal(email)} and id = '{user[0]}';\n", encoding="utf-8")
    os.chmod(path, 0o600)
    print(f"OK: nueva contraseña de {email} guardada en el llavero. SQL en {path}")


def cmd_status() -> None:
    for _uid, email, name, org, role in USERS:
        state = "en el llavero" if keychain_read(email) else "SIN contraseña"
        print(f"{email:28} {org:16} {role:10} {state}")


def cmd_verify() -> None:
    url, key = os.environ.get("HF_SUPABASE_URL"), os.environ.get("HF_SUPABASE_PUBLISHABLE_KEY")
    if not url or not key or PROJECT_REF not in url:
        die(f"HF_SUPABASE_URL debe ser el proyecto {PROJECT_REF} y HF_SUPABASE_PUBLISHABLE_KEY la clave publicable")
    failures = 0
    for _uid, email, _name, org, role in USERS:
        pw = keychain_read(email)
        if not pw:
            print(f"FALLO {email}: sin contraseña en el llavero")
            failures += 1
            continue
        req = urllib.request.Request(
            f"{url}/auth/v1/token?grant_type=password",
            data=json.dumps({"email": email, "password": pw}).encode(),
            headers={"apikey": key, "Content-Type": "application/json"}, method="POST")
        del pw
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                body = json.loads(r.read())  # contiene tokens: nunca se imprime
                ok = body.get("user", {}).get("email") == email
                print(f"{'OK   ' if ok else 'FALLO'} {email} ({org}, {role}) HTTP {r.status}")
                failures += 0 if ok else 1
        except urllib.error.HTTPError as e:
            print(f"FALLO {email} ({org}, {role}) HTTP {e.code}")
            failures += 1
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    a = sys.argv[1:]
    if a[:1] == ["create-sql"] and len(a) == 2:
        cmd_create_sql(a[1])
    elif a[:1] == ["rotate"] and len(a) == 3:
        cmd_rotate(a[1], a[2])
    elif a == ["status"]:
        cmd_status()
    elif a == ["verify"]:
        cmd_verify()
    else:
        print(__doc__)
        sys.exit(2)
