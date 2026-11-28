#!/usr/bin/env python3
"""Genera supabase/seed/qa_synthetic_go_ia_3.sql (datos SINTÉTICOS de GO-IA-3) y su rollback.

Uso: python3 -I apps/heyfoxy-web/scripts/synthetic-media/build-seed.py
Todo es ficticio: marcas de prueba, campañas, métricas y aprendizajes. Ninguna fila toca MedPlus.
Las fechas son relativas al momento de carga (now()), como el seed de Gate B.
"""
import json
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
APP = HERE.parent.parent
SEED = APP / "supabase/seed/qa_synthetic_go_ia_3.sql"
ROLLBACK = APP / "supabase/seed/qa_synthetic_go_ia_3_rollback.sql"
pieces = json.loads((HERE / "pieces.json").read_text())

ORG = {"aurora": "9a000000-0000-4000-a000-0000000000a1", "horizonte": "9b000000-0000-4000-a000-0000000000b1"}
SRC = {"aurora": "9a000000-0000-4000-c000-000000000001", "horizonte": "9b000000-0000-4000-c000-000000000001"}
ACC = {
    ("aurora", "instagram"): "9a000000-0000-4000-d000-000000000001",
    ("aurora", "facebook"): "9a000000-0000-4000-d000-000000000002",
    ("horizonte", "facebook"): "9b000000-0000-4000-d000-000000000002",
    ("horizonte", "instagram"): "9b000000-0000-4000-d000-000000000003",
}
HANDLE = {
    ("aurora", "instagram"): "@clinicaaurora.qa",
    ("aurora", "facebook"): "Clínica Aurora QA",
    ("horizonte", "facebook"): "Banco Horizonte QA",
    ("horizonte", "instagram"): "@bancohorizonte.qa",
}

# Publicaciones: archivo de imagen → red, tipo, días desde la publicación, copy y métricas de la
# última medición (alcance/impresiones únicas, impresiones, me gusta o reacciones, comentarios,
# compartidos, guardados, reproducciones). Patrones ficticios deliberados para evaluar a Foxy:
#  · Aurora IG: los carruseles educativos ganan guardados; la pregunta gana comentarios; la pieza
#    de CTA tiene menor engagement. Reels: más alcance, menos engagement; «detrás de cámaras» lidera.
#  · Aurora FB: la jornada de chequeo gana compartidos.
#  · Horizonte: seguridad (antifraude) gana compartidos; carruseles ganan guardados; el video
#    antifraude lidera reproducciones.
POSTS = {
    "a-ig-01": ("instagram", "image", 4, "[SINTÉTICO] ¿Cuándo fue tu último chequeo? Un control preventivo a tiempo detecta lo que no se siente. Agenda tu chequeo en la app. #ChequeoATiempo #Prevención", (5200, 6900, 310, 64, 22, 58, None)),
    "a-ig-02": ("instagram", "carousel", 9, "[SINTÉTICO] 5 hábitos para cuidar tu corazón: muévete 30 minutos, come más fibra, duerme 7 horas, controla la presión y no fumes. Guarda esta guía de educación en salud. #TuSaludEnCasa", (6100, 8300, 420, 28, 51, 260, None)),
    "a-ig-03": ("instagram", "image", 13, "[SINTÉTICO] Nuestro equipo de enfermería te acompaña las 24 horas. Atención cercana, información clara y servicio en el que puedes confiar. #AuroraTeEscucha", (3900, 5100, 260, 19, 8, 21, None)),
    "a-ig-04": ("instagram", "carousel", 18, "[SINTÉTICO] Mitos y verdades de la vacunación, explicados por especialistas. Desliza, aprende y comparte con tu familia. Educación en salud basada en evidencia. #Vacunación", (5700, 7600, 380, 35, 66, 214, None)),
    "a-ig-05": ("instagram", "image", 22, "[SINTÉTICO] Tu chequeo preventivo en 3 toques: abre la app, elige especialidad y horario, confirma. Agenda hoy. #ChequeoATiempo", (4300, 5600, 150, 9, 6, 17, None)),
    "a-reel-01": ("instagram", "reel", 6, "[SINTÉTICO] Tu salud en 60 segundos · Episodio 1: ¿cuánta agua necesitas al día? Hábitos simples de bienestar. #TuSaludEn60", (11800, 14900, 520, 31, 74, 96, 15200)),
    "a-reel-02": ("instagram", "reel", 12, "[SINTÉTICO] Tu salud en 60 segundos · Episodio 2: dormir bien también es prevenir. Rutina de sueño en 3 pasos. #TuSaludEn60", (10400, 13100, 470, 22, 58, 88, 13600)),
    "a-reel-03": ("instagram", "reel", 16, "[SINTÉTICO] Un día en urgencias, contado por el equipo. Detrás de cámaras de la atención que nos importa. #AuroraTeEscucha", (14900, 18700, 890, 76, 112, 70, 21400)),
    "a-reel-04": ("instagram", "reel", 25, "[SINTÉTICO] Tu chequeo preventivo, paso a paso: qué exámenes incluye y cómo prepararte. #ChequeoATiempo", (9800, 12200, 360, 18, 40, 77, 11900)),
    "a-fb-01": ("facebook", "image", 5, "[SINTÉTICO] Jornada de chequeo preventivo este sábado en la sede norte. Cupos limitados, inscripción en la app. Comparte con quien lo necesite. #ChequeoATiempo", (7400, 9800, 280, 41, 96, None, None)),
    "a-fb-02": ("facebook", "image", 11, "[SINTÉTICO] ¿Urgencias o consulta prioritaria? Descarga nuestra guía de educación en salud para decidir mejor y cuidar tu tiempo.", (5200, 6600, 170, 23, 44, None, None)),
    "a-fb-03": ("facebook", "image", 17, "[SINTÉTICO] Nuevos horarios extendidos: lunes a sábado de 6:00 a 22:00. Más tiempo para tu atención.", (4800, 6100, 130, 37, 12, None, None)),
    "a-fb-04": ("facebook", "image", 24, "[SINTÉTICO] ¿Cómo fue tu última visita? Responde la encuesta en 2 minutos y ayúdanos a mejorar el servicio. #AuroraTeEscucha", (3600, 4500, 90, 52, 5, None, None)),
    "h-ig-01": ("instagram", "carousel", 3, "[SINTÉTICO] Mi primer presupuesto en 3 pasos: anota ingresos, separa lo fijo y define una meta de ahorro. Guárdalo para fin de mes. #MiPrimerPresupuesto #EducaciónFinanciera", (4800, 6400, 290, 26, 38, 198, None)),
    "h-ig-02": ("instagram", "image", 8, "[SINTÉTICO] La regla 50/30/20, explicada: 50 % necesidades, 30 % gustos, 20 % ahorro. Educación financiera para empezar hoy. #EducaciónFinanciera", (4200, 5500, 240, 18, 21, 96, None)),
    "h-ig-03": ("instagram", "image", 14, "[SINTÉTICO] ¿Te pidieron tu clave por mensaje? Banco Horizonte nunca la solicita. Si dudas, llama a la línea oficial. #SeguroEnLínea", (6900, 8800, 330, 44, 170, 61, None)),
    "h-ig-04": ("instagram", "image", 19, "[SINTÉTICO] Ahorro programado desde la app: elige monto y fecha, nosotros lo apartamos por ti. Soluciones financieras simples.", (3500, 4600, 120, 11, 6, 19, None)),
    "h-ig-05": ("instagram", "carousel", 26, "[SINTÉTICO] Mitos del crédito que te cuestan dinero: el pago mínimo, los avances y las cuotas largas. Desliza y aprende. #EducaciónFinanciera", (5300, 7000, 310, 39, 45, 176, None)),
    "h-fb-01": ("facebook", "image", 4, "[SINTÉTICO] Simula tu crédito de vivienda en minutos, sin compromiso. Hogar Horizonte te acompaña en tu primera casa.", (5600, 7200, 160, 28, 22, None, None)),
    "h-fb-02": ("facebook", "image", 10, "[SINTÉTICO] Así intentan estafarte (y cómo evitarlo): enlaces falsos, llamadas urgentes y premios inesperados. Comparte esta alerta. #SeguroEnLínea", (8900, 11600, 260, 47, 210, None, None)),
    "h-fb-03": ("facebook", "image", 15, "[SINTÉTICO] Taller gratuito de finanzas personales este jueves a las 7:00 p. m. Inscríbete y aprende a armar tu presupuesto. #MiPrimerPresupuesto", (4100, 5300, 140, 33, 18, None, None)),
    "h-fb-04": ("facebook", "image", 23, "[SINTÉTICO] Transferencias seguras desde la nueva app, con doble verificación. Soluciones financieras con seguridad.", (3700, 4800, 95, 21, 9, None, None)),
    "h-fbv-01": ("facebook", "video", 6, "[SINTÉTICO] Finanzas en 1 minuto · Episodio 1: tu fondo de emergencia, explicado. #EducaciónFinanciera", (9100, 12300, 210, 24, 48, None, 8700)),
    "h-fbv-02": ("facebook", "video", 12, "[SINTÉTICO] Finanzas en 1 minuto · Episodio 2: tarjeta de crédito sin sustos. #EducaciónFinanciera", (8200, 10900, 170, 19, 31, None, 7400)),
    "h-fbv-03": ("facebook", "video", 18, "[SINTÉTICO] Cómo reconocer un mensaje falso en 40 segundos. Mira, aprende y comparte. #SeguroEnLínea", (13800, 17900, 340, 58, 260, None, 14100)),
    "h-fbv-04": ("facebook", "video", 27, "[SINTÉTICO] Historia ficticia: la primera casa de Ana, con Hogar Horizonte. Serie Hogar.", (7600, 9900, 150, 17, 14, None, 6100)),
}

SIZE = {"square": (1080, 1080), "portrait": (1080, 1350), "landscape": (1200, 630), "story": (720, 1280)}


def q(s):
    return "null" if s is None else "'" + str(s).replace("'", "''") + "'"


def num(v):
    return "null" if v is None else str(v)


def piece(org, file):
    return next(p for p in pieces[org]["pieces"] if p["file"] == file)


post_rows, snap_rows, media_rows = [], [], []
for file, (platform, ctype, days, body, metrics) in POSTS.items():
    org = "aurora" if file.startswith("a-") else "horizonte"
    p = piece(org, file)
    ext = f"goia3-{file}"
    pid = f"md5('{ext}')::uuid"
    w, h = SIZE[p["format"]]
    post_rows.append(
        f"  ({pid}, '{ORG[org]}', '{ACC[(org, platform)]}', '{SRC[org]}', '{platform}', '{ext}', {q(p['title'])}, {q(body)}, "
        f"now() - interval '{days} days', '{ctype}', {q(HANDLE[(org, platform)])}, {p.get('carousel') or 1})"
    )
    reach, impressions, likes, comments, shares, saves, views = metrics
    for factor, offset in ((0.55, f"{days} days' + interval '1 day"), (0.85, f"{days} days' + interval '3 days"), (1.0, "2 hours")):
        if offset != "2 hours" and days <= (1 if factor == 0.55 else 3):
            continue
        r = round(reach * factor)
        f = lambda v: None if v is None else round(v * factor)  # noqa: E731
        li, co, sh, sa, vv = f(likes), f(comments), f(shares), f(saves), f(views)
        inter = li + co + sh + (sa or 0)
        eng = round(inter / r * 100, 4)
        ig = platform == "instagram"
        when = "now() - interval '2 hours'" if offset == "2 hours" else f"now() - interval '{offset}'"
        snap_rows.append(
            f"  ('{ORG[org]}', {pid}, {when}, {li}, {co}, {sh}, {num(vv)}, {r if ig else 'null'}, {round(impressions * factor)}, "
            f"{'null' if ig else r}, {inter}, {num(sa)}, {num(vv)}, {eng})"
        )
    url = f"https://synthetic-media.heyfoxy.invalid/{org}/{file}.jpg"
    kind = "video" if ctype in ("reel", "video") else "image"
    dur = p.get("duration")
    dur_sec = None
    if dur:
        mm, ss = dur.split(":")
        dur_sec = int(mm) * 60 + int(ss)
    alt = f"Pieza sintética de prueba: {p['title']}"
    media_rows.append(
        f"  ('{ORG[org]}', {pid}, 0, '{kind}', '{url}', {q(url) if kind == 'video' else 'null'}, {w}, {h}, {q(dur_sec)}, {q(alt)}, 'ok')"
    )

AURORA_BRAND = {
    "identity": {
        "name": "Clínica Aurora (marca ficticia de prueba)",
        "description": "Red de clínicas ficticia de atención primaria y especializada, creada solo para pruebas de Hey Foxy. No representa a ninguna institución real.",
        "industry": "Salud (ficticia)",
        "valueProposition": "Prevención accesible: chequeos a tiempo, información clara y atención cercana, en sede y en la app.",
        "positioning": "La clínica que te ayuda a cuidarte antes de enfermarte.",
        "personality": "Cercana, experta, tranquila y confiable.",
        "tone": "Cálido y claro; frases cortas; sin alarmismo ni promesas de curación; siempre con una acción concreta.",
        "visualGuidelines": "Verde azulado y coral; iconografía lineal; tipografía grande; sin imágenes de pacientes ni procedimientos.",
        "brandManualRef": "",
    },
    "strategy": {
        "marketing": "Aumentar los chequeos preventivos agendados en la app entre familias jóvenes y adultos de 30 a 55 años.",
        "communication": "Educar en salud con contenido útil y verificable; mostrar el servicio humano detrás de la atención.",
        "organic": "Instagram: carruseles educativos y reels de 60 segundos. Facebook: jornadas, horarios y guías prácticas.",
        "businessGoals": ["Más chequeos preventivos agendados en la app", "Mejorar la satisfacción del servicio"],
        "communicationGoals": ["Educar en prevención y bienestar", "Generar confianza en el equipo de atención", "Llevar a agendar chequeos"],
        "pillars": [
            {"name": "Prevención y bienestar", "description": "Chequeos, hábitos saludables y autocuidado.", "keywords": ["prevención", "preventivo", "chequeo", "hábitos", "bienestar"]},
            {"name": "Educación en salud", "description": "Guías, mitos y verdades, información verificada.", "keywords": ["educación en salud", "guía", "mitos", "aprende", "especialistas"]},
            {"name": "Confianza y servicio", "description": "Equipo humano, horarios, experiencia de atención.", "keywords": ["equipo", "atención", "servicio", "horarios", "encuesta"]},
        ],
        "audiences": ["Familias jóvenes con hijos pequeños", "Adultos de 30 a 55 años que posponen sus chequeos"],
        "consumerInsights": ["«Voy al médico solo cuando algo duele»", "«Agendar es engorroso y no sé qué chequeo me toca»"],
        "kpis": ["Guardados", "Compartidos", "Alcance de piezas de prevención", "Chequeos agendados (fuera de Hey Foxy)"],
        "competitors": [],
    },
    "campaigns": [
        {"name": "Chequeo a tiempo", "status": "active", "concept": "Un chequeo a tiempo detecta lo que no se siente.", "goals": "Llevar a agendar chequeos preventivos en la app.", "audiences": "Adultos de 30 a 55 años", "keyMessages": "Agenda en 3 toques · Prevenir es cuidarte", "channels": ["instagram", "facebook"], "results": "", "learnings": "", "startsOn": "2026-10-01", "endsOn": ""},
        {"name": "Tu salud en 60 segundos", "status": "active", "concept": "Microeducación en video: un hábito por episodio.", "goals": "Alcance y recordación de hábitos saludables.", "audiences": "Familias jóvenes", "keyMessages": "Un hábito simple cada semana", "channels": ["instagram"], "results": "", "learnings": "", "startsOn": "2026-10-15", "endsOn": ""},
        {"name": "Aurora te escucha", "status": "past", "concept": "El equipo humano detrás de la atención.", "goals": "Confianza y satisfacción.", "audiences": "Pacientes actuales (ficticios)", "keyMessages": "Atención cercana, información clara", "channels": ["instagram", "facebook"], "results": "Más comentarios que el promedio en piezas de equipo (dato ficticio).", "learnings": "Las piezas con personas del equipo generan conversación; las de horarios, poca interacción.", "startsOn": "2026-08-01", "endsOn": "2026-09-30"},
    ],
}
HORIZONTE_BRAND = {
    "identity": {
        "name": "Banco Horizonte (marca ficticia de prueba)",
        "description": "Banco digital ficticio creado solo para pruebas de Hey Foxy. No representa a ninguna entidad real.",
        "industry": "Servicios financieros (ficticio)",
        "valueProposition": "Finanzas simples y seguras: aprende, ahorra y decide con confianza desde la app.",
        "positioning": "El banco que te enseña antes de venderte.",
        "personality": "Didáctica, confiable, directa y optimista.",
        "tone": "Claro y sin tecnicismos; cifras sencillas; nunca alarmista; siempre con un paso práctico.",
        "visualGuidelines": "Azul profundo y dorado; ilustración plana; datos destacados en grande.",
        "brandManualRef": "",
    },
    "strategy": {
        "marketing": "Crecer en usuarios jóvenes de la app con educación financiera y confianza en la seguridad digital.",
        "communication": "Educación financiera útil, alertas de seguridad y soluciones simples.",
        "organic": "Instagram: carruseles educativos. Facebook: alertas, talleres y videos de un minuto.",
        "businessGoals": ["Más usuarios activos de la app", "Más cuentas de ahorro programado"],
        "communicationGoals": ["Enseñar a presupuestar y ahorrar", "Prevenir el fraude digital", "Dar a conocer soluciones simples"],
        "pillars": [
            {"name": "Educación financiera", "description": "Presupuesto, ahorro, crédito responsable.", "keywords": ["presupuesto", "educación financiera", "ahorro", "crédito", "finanzas"]},
            {"name": "Confianza y seguridad", "description": "Antifraude y seguridad digital.", "keywords": ["seguro", "seguridad", "clave", "estafa", "falso", "alerta"]},
            {"name": "Soluciones financieras", "description": "Productos simples explicados sin letra pequeña.", "keywords": ["app", "simula", "transferencias", "programado", "soluciones"]},
        ],
        "audiences": ["Jóvenes de 22 a 35 años con su primer empleo", "Familias que planean su primera vivienda"],
        "consumerInsights": ["«No sé a dónde se va mi dinero»", "«Me da miedo caer en una estafa por mensaje»"],
        "kpis": ["Guardados", "Compartidos de alertas", "Reproducciones completas de video"],
        "competitors": [],
    },
    "campaigns": [
        {"name": "Mi primer presupuesto", "status": "active", "concept": "Presupuestar es el primer paso para ahorrar.", "goals": "Educación financiera y descarga de la plantilla.", "audiences": "Jóvenes con primer empleo", "keyMessages": "3 pasos · regla 50/30/20", "channels": ["instagram", "facebook"], "results": "", "learnings": "", "startsOn": "2026-10-05", "endsOn": ""},
        {"name": "Seguro en línea", "status": "active", "concept": "El banco nunca te pide tu clave.", "goals": "Prevenir fraude y aumentar compartidos de alertas.", "audiences": "Todos los usuarios", "keyMessages": "Nunca compartas tu clave · Llama a la línea oficial", "channels": ["instagram", "facebook"], "results": "", "learnings": "", "startsOn": "2026-10-20", "endsOn": ""},
        {"name": "Hogar Horizonte", "status": "past", "concept": "Tu primera casa, paso a paso.", "goals": "Simulaciones de crédito de vivienda.", "audiences": "Familias que planean vivienda", "keyMessages": "Simula sin compromiso", "channels": ["facebook"], "results": "Simulaciones por encima de la meta (dato ficticio).", "learnings": "Las historias en video retienen más que las piezas de producto.", "startsOn": "2026-07-01", "endsOn": "2026-09-15"},
    ],
}
LEARNINGS = {
    "aurora": [
        ("learning", "[SINTÉTICO] Los carruseles educativos concentran los guardados", "En Instagram, las guías en carrusel (hábitos, mitos y verdades) acumulan más guardados que las piezas de una imagen. Aprendizaje ficticio validado para pruebas."),
        ("decision", "[SINTÉTICO] No usar imágenes de pacientes", "Decisión de marca ficticia: las piezas muestran iconografía o al equipo, nunca pacientes ni procedimientos."),
    ],
    "horizonte": [
        ("learning", "[SINTÉTICO] Las alertas de seguridad se comparten más", "En Facebook, las piezas y videos antifraude reciben más compartidos que las de producto. Aprendizaje ficticio validado para pruebas."),
        ("decision", "[SINTÉTICO] Cifras simples y un paso práctico", "Decisión de marca ficticia: cada pieza educativa termina con una acción concreta y cifras redondas."),
    ],
}


def jq(o):
    return q(json.dumps(o, ensure_ascii=False)) + "::jsonb"


brand_sql = "\n".join(
    f"""insert into public.brand_contexts (organization_id, identity, strategy, campaigns, is_synthetic)
values ('{ORG[org]}', {jq(b['identity'])}, {jq(b['strategy'])}, {jq(b['campaigns'])}, true)
on conflict (organization_id) do update set identity = excluded.identity, strategy = excluded.strategy,
  campaigns = excluded.campaigns, is_synthetic = true;"""
    for org, b in (("aurora", AURORA_BRAND), ("horizonte", HORIZONTE_BRAND))
)
mem_rows = ",\n".join(
    f"  ('{ORG[org]}', '{kind}', {q(title)}, {q(body)}, 'validated', true)"
    for org, items in LEARNINGS.items()
    for kind, title, body in items
)

seed = f"""-- Hey Foxy — datos SINTÉTICOS para GO-IA-3 (Clínica Aurora QA y Banco Horizonte QA).
-- GENERADO por scripts/synthetic-media/build-seed.py (no editar a mano). Requiere 0001–0010.
-- Todo es ficticio: marcas de prueba, campañas, métricas, imágenes propias y aprendizajes.
-- No toca MedPlus ni ninguna organización real. Idempotente (identificadores deterministas y
-- prefijo de external_id «goia3-»). Rollback: qa_synthetic_go_ia_3_rollback.sql.
begin;

do $chk$ begin
  if (select count(*) from public.organizations
      where id in ('{ORG['aurora']}', '{ORG['horizonte']}') and is_demo) <> 2 then
    raise exception 'GO-IA-3 seed: las organizaciones de prueba no existen o no son demo';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'post_media_synthetic_guard') then
    raise exception 'GO-IA-3 seed: requiere la migración 0010';
  end if;
end $chk$;

-- 1. Brand Brain sintético (sustituye el contexto «[PRUEBA QA]» de Aurora; versión +1).
{brand_sql}

-- 2. Aprendizajes y decisiones validados de prueba.
insert into public.brand_memory (organization_id, kind, title, body, status, is_synthetic)
select v.organization_id::uuid, v.kind, v.title, v.body, v.status, v.is_synthetic from (values
{mem_rows}
) as v(organization_id, kind, title, body, status, is_synthetic)
where not exists (select 1 from public.brand_memory m where m.organization_id = v.organization_id::uuid and m.title = v.title);

-- 3. Publicaciones (13 por organización; ≥ 3 comparables por red y formato).
insert into public.social_posts (id, organization_id, social_account_id, data_source_id, platform, external_id, title, body,
  published_at, content_type, author_handle, media_count_reported, is_synthetic)
select id, organization_id::uuid, social_account_id::uuid, data_source_id::uuid, platform::public.hf_platform, external_id, title, body,
  published_at, content_type, author_handle, media_count_reported, true
from (values
{",\n".join(post_rows)}
) as v(id, organization_id, social_account_id, data_source_id, platform, external_id, title, body, published_at, content_type, author_handle, media_count_reported)
on conflict (organization_id, data_source_id, external_id) do nothing;

-- 4. Mediciones históricas (1, 3 días después y la más reciente).
insert into public.post_metric_snapshots (organization_id, post_id, captured_at, likes, comments, shares, views, reach,
  impressions, impressions_unique, interactions, saves, video_views, engagement, is_synthetic)
select v.organization_id::uuid, v.post_id, v.captured_at, v.likes::int, v.comments::int, v.shares::int, v.views::int, v.reach::int,
  v.impressions::int, v.impressions_unique::int, v.interactions::int, v.saves::int, v.video_views::int, v.engagement::numeric, true
from (values
{",\n".join(snap_rows)}
) as v(organization_id, post_id, captured_at, likes, comments, shares, views, reach, impressions, impressions_unique, interactions, saves, video_views, engagement)
where not exists (select 1 from public.post_metric_snapshots m where m.post_id = v.post_id and m.likes = v.likes::int and m.reach is not distinct from v.reach::int);

-- 5. Imágenes sintéticas propias (host reservado; solo organizaciones demo, 0010).
insert into public.post_media (organization_id, post_id, position, kind, source_url, preview_url, width, height, duration_sec, alt_text, url_status)
select v.organization_id::uuid, v.post_id, v.position, v.kind, v.source_url, v.preview_url, v.width, v.height, v.duration_sec::numeric, v.alt_text, v.url_status
from (values
{",\n".join(media_rows)}
) as v(organization_id, post_id, position, kind, source_url, preview_url, width, height, duration_sec, alt_text, url_status)
where not exists (select 1 from public.post_media m where m.post_id = v.post_id and m.position = v.position);

commit;
"""
SEED.write_text(seed)

AURORA_PREV = {
    "identity": {"name": "[PRUEBA QA] Clínica Aurora (ficticia)", "tone": "[PRUEBA QA] Cercano y claro.", "industry": "", "description": "", "personality": "", "positioning": "", "brandManualRef": "", "valueProposition": "[PRUEBA QA] Propuesta de valor ficticia para validar el versionado.", "visualGuidelines": ""},
    "strategy": {"kpis": ["[PRUEBA QA] Alcance", "[PRUEBA QA] Guardados"], "organic": "", "pillars": [{"name": "[PRUEBA QA] Prevención", "keywords": ["prevención", "chequeo"], "description": "Hábitos y chequeos"}, {"name": "[PRUEBA QA] Experiencia", "keywords": ["cita", "atención"], "description": "Citas y atención"}], "audiences": ["[PRUEBA QA] Familias jóvenes"], "marketing": "", "competitors": [], "businessGoals": [], "communication": "", "consumerInsights": [], "communicationGoals": ["[PRUEBA QA] Aumentar alcance de piezas de prevención"]},
    "campaigns": [{"name": "[PRUEBA QA] Campaña ficticia", "goals": "Alcance", "endsOn": "", "status": "active", "concept": "Pequeños hábitos", "results": "", "channels": [], "startsOn": "", "audiences": "", "learnings": "", "keyMessages": "Prevenir es cuidarte"}],
}
titles = ", ".join(q(t) for items in LEARNINGS.values() for _, t, _ in items)
rollback = f"""-- Rollback de qa_synthetic_go_ia_3.sql: retira SOLO lo que cargó ese seed y devuelve el Brand Brain
-- de Aurora al contenido ficticio «[PRUEBA QA]» anterior (la versión sigue subiendo: es una edición
-- más). Banco Horizonte vuelve a no tener Brand Brain. GENERADO por build-seed.py.
begin;
delete from public.social_posts
  where organization_id in ('{ORG['aurora']}', '{ORG['horizonte']}') and external_id like 'goia3-%';
delete from public.brand_memory
  where organization_id in ('{ORG['aurora']}', '{ORG['horizonte']}') and title in ({titles});
update public.brand_contexts set identity = {jq(AURORA_PREV['identity'])}, strategy = {jq(AURORA_PREV['strategy'])},
  campaigns = {jq(AURORA_PREV['campaigns'])}
  where organization_id = '{ORG['aurora']}';
delete from public.brand_contexts where organization_id = '{ORG['horizonte']}';
commit;
"""
ROLLBACK.write_text(rollback)
print(f"seed: {len(post_rows)} publicaciones, {len(snap_rows)} mediciones, {len(media_rows)} imágenes, {mem_rows.count('validated')} aprendizajes")
