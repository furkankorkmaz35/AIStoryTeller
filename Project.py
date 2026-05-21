from __future__ import annotations

import argparse
import os
import re
import sqlite3
import textwrap
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "outputs"
ASSET_DIR = OUTPUT_DIR / "assets"
DB_PATH = BASE_DIR / "ai_storyteller.db"


@dataclass
class StoryProject:
    title: str
    theme: str
    content: str
    image_paths: list[Path]
    audio_path: Path | None
    video_path: Path | None


def slugify(text: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9_-]+", "-", text.strip().lower())
    value = re.sub(r"-+", "-", value).strip("-")
    return value or "hikaye"


def ensure_dirs() -> None:
    OUTPUT_DIR.mkdir(exist_ok=True)
    ASSET_DIR.mkdir(parents=True, exist_ok=True)


def load_env_file() -> None:
    env_path = BASE_DIR / ".env"
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        clean = line.strip()
        if not clean or clean.startswith("#") or "=" not in clean:
            continue
        key, value = clean.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def init_database() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS stories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            theme TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS story_assets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            story_id INTEGER NOT NULL,
            asset_type TEXT NOT NULL CHECK (asset_type IN ('image', 'audio', 'video')),
            file_path TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
        );
        """
    )
    return connection


def save_story(connection: sqlite3.Connection, project: StoryProject) -> int:
    cursor = connection.execute(
        "INSERT INTO stories (title, theme, content) VALUES (?, ?, ?)",
        (project.title, project.theme, project.content),
    )
    story_id = int(cursor.lastrowid)

    for path in project.image_paths:
        connection.execute(
            "INSERT INTO story_assets (story_id, asset_type, file_path) VALUES (?, ?, ?)",
            (story_id, "image", str(path)),
        )
    if project.audio_path:
        connection.execute(
            "INSERT INTO story_assets (story_id, asset_type, file_path) VALUES (?, ?, ?)",
            (story_id, "audio", str(project.audio_path)),
        )
    if project.video_path:
        connection.execute(
            "INSERT INTO story_assets (story_id, asset_type, file_path) VALUES (?, ?, ?)",
            (story_id, "video", str(project.video_path)),
        )

    connection.commit()
    return story_id


def generate_story(theme: str, paragraph_count: int = 3) -> str:
    if os.getenv("AISTORYTELLER_OFFLINE") == "1":
        return local_story(theme)

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    prompt = (
        f"{theme} temali, cocuklara uygun, sicak ve yaratici bir hikaye yaz. "
        f"Hikaye tam olarak {paragraph_count} kisa paragraftan olussun. "
        "Her paragraf en fazla iki cumle olsun ve video anlatimina uygun sahneler icersin."
    )

    if api_key:
        try:
            import google.generativeai as genai  # type: ignore

            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(os.getenv("GEMINI_MODEL", "gemini-1.5-flash"))
            response = model.generate_content(prompt)
            text = (response.text or "").strip()
            if text:
                return normalize_paragraphs(text, paragraph_count)
        except Exception as exc:
            print(f"Gemini kullanilamadi, yerel hikaye taslagi uretilecek: {exc}")

    return local_story(theme)


def normalize_paragraphs(text: str, paragraph_count: int) -> str:
    paragraphs = [line.strip() for line in re.split(r"\n+", text) if line.strip()]
    if len(paragraphs) >= paragraph_count:
        return "\n\n".join(paragraphs[:paragraph_count])

    sentences = re.split(r"(?<=[.!?])\s+", text)
    chunks = []
    for index in range(paragraph_count):
        piece = " ".join(sentences[index * 2 : index * 2 + 2]).strip()
        if piece:
            chunks.append(piece)
    return "\n\n".join(chunks or paragraphs or [text.strip()])


def local_story(theme: str) -> str:
    clean_theme = theme.strip() or "cesur bir robot"
    return (
        f"{clean_theme.title()} bir sabah gokyuzunde parlayan tuhaf bir isik gordu. "
        "Bu isigin, kaybolan hayalleri yeniden bulmaya yardim eden eski bir haritadan geldigini anladi.\n\n"
        "Yol boyunca kucuk ipuclari topladi ve her ipucu ona paylasmanin yeni bir yolunu ogretti. "
        "En zor anda korkmak yerine derin bir nefes aldi ve arkadaslarindan yardim istedi.\n\n"
        "Haritanin sonunda buldugu hazine altin degil, herkesin kendi hikayesini anlatabildigi buyulu bir defterdi. "
        f"{clean_theme.title()} o gunden sonra her gece yeni bir macerayi nazik bir sesle anlatmaya basladi."
    )


def split_story_scenes(content: str, scene_count: int = 3) -> list[str]:
    paragraphs = [p.strip() for p in re.split(r"\n+", content) if p.strip()]
    if len(paragraphs) >= scene_count:
        return paragraphs[:scene_count]

    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", content) if s.strip()]
    while len(sentences) < scene_count:
        sentences.append(sentences[-1] if sentences else content)
    return sentences[:scene_count]


def generate_images(title: str, scenes: list[str]) -> list[Path]:
    paths: list[Path] = []
    for index, scene in enumerate(scenes, start=1):
        path = ASSET_DIR / f"{slugify(title)}-scene-{index}.jpg"
        prompt = (
            "storybook illustration, warm cinematic lighting, child friendly, "
            f"high detail, Turkish children's story scene: {scene}"
        )
        if download_pollinations_image(prompt, path):
            paths.append(path)
        else:
            create_placeholder_image(scene, path, index)
            paths.append(path)
    return paths


def download_pollinations_image(prompt: str, path: Path) -> bool:
    if os.getenv("AISTORYTELLER_OFFLINE") == "1":
        return False

    encoded = urllib.parse.quote(prompt[:900])
    url = f"https://image.pollinations.ai/prompt/{encoded}?width=1280&height=720&nologo=true&enhance=true"
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "AIStoryTeller/1.0"})
        with urllib.request.urlopen(request, timeout=20) as response:
            data = response.read()
        if len(data) < 1000:
            return False
        path.write_bytes(data)
        time.sleep(1)
        return True
    except Exception as exc:
        print(f"Gorsel indirilemedi, yerel sahne karti uretilecek: {exc}")
        return False


def create_placeholder_image(scene: str, path: Path, index: int) -> None:
    from PIL import Image, ImageDraw, ImageFont

    colors = [("#0f766e", "#f8fafc"), ("#7c2d12", "#fff7ed"), ("#1d4ed8", "#eff6ff")]
    background, foreground = colors[(index - 1) % len(colors)]
    image = Image.new("RGB", (1280, 720), background)
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=36)
    title_font = ImageFont.load_default(size=58)

    draw.rectangle((70, 70, 1210, 650), outline=foreground, width=6)
    draw.text((100, 110), f"Sahne {index}", fill=foreground, font=title_font)
    wrapped = textwrap.fill(scene, width=54)
    draw.multiline_text((100, 230), wrapped, fill=foreground, font=font, spacing=14)
    image.save(path, quality=92)


def create_audio(title: str, content: str) -> Path | None:
    path = OUTPUT_DIR / f"{slugify(title)}-narration.mp3"
    try:
        from gtts import gTTS  # type: ignore

        tts = gTTS(text=content, lang="tr")
        tts.save(str(path))
        return path
    except Exception as exc:
        print(f"Ses dosyasi olusturulamadi. 'gTTS' ve internet baglantisini kontrol edin: {exc}")
        return None


def create_video(title: str, image_paths: list[Path], audio_path: Path | None, subtitles: str) -> Path | None:
    if not audio_path:
        print("Ses dosyasi olmadigi icin video olusturma adimi atlandi.")
        return None

    video_path = OUTPUT_DIR / f"{slugify(title)}-video.mp4"
    try:
        try:
            from moviepy.editor import (  # type: ignore
                AudioFileClip,
                CompositeVideoClip,
                ImageClip,
                TextClip,
                concatenate_videoclips,
            )

            moviepy_v2 = False
            vfx = None
        except ModuleNotFoundError:
            from moviepy import (  # type: ignore
                AudioFileClip,
                CompositeVideoClip,
                ImageClip,
                TextClip,
                concatenate_videoclips,
                vfx,
            )

            moviepy_v2 = True

        audio = AudioFileClip(str(audio_path))
        scene_duration = max(audio.duration / max(len(image_paths), 1), 3)
        clips = []
        for path in image_paths:
            if moviepy_v2:
                clip = (
                    ImageClip(str(path))
                    .resized(height=720)
                    .with_duration(scene_duration)
                    .with_effects([vfx.FadeIn(0.6), vfx.FadeOut(0.6)])
                )
            else:
                clip = (
                    ImageClip(str(path))
                    .resize(height=720)
                    .set_duration(scene_duration)
                    .fadein(0.6)
                    .fadeout(0.6)
                )
            clips.append(clip)

        video = concatenate_videoclips(clips, method="compose")
        if moviepy_v2:
            video = video.with_audio(audio)
            subtitle = TextClip(
                text=subtitles,
                font_size=32,
                color="white",
                bg_color="black",
                size=(int(video.w * 0.9), None),
                method="caption",
            ).with_duration(audio.duration).with_position(("center", "bottom"))
        else:
            video = video.set_audio(audio)
            subtitle = (
                TextClip(
                    subtitles,
                    fontsize=32,
                    color="white",
                    bg_color="black",
                    size=(int(video.w * 0.9), None),
                    method="caption",
                )
                .set_duration(audio.duration)
                .set_position(("center", "bottom"))
            )

        final = CompositeVideoClip([video, subtitle])
        final.write_videofile(str(video_path), fps=24, codec="libx264", audio_codec="aac")
        audio.close()
        final.close()
        return video_path
    except Exception as exc:
        print(f"Video olusturulamadi. MoviePy/ImageMagick/ffmpeg kurulumunu kontrol edin: {exc}")
        return None


def build_project(theme: str, title: str | None = None) -> StoryProject:
    ensure_dirs()
    story_title = title or f"{theme.strip().title()} Hikayesi"
    content = generate_story(theme)
    scenes = split_story_scenes(content, 3)
    image_paths = generate_images(story_title, scenes)
    audio_path = create_audio(story_title, content)
    video_path = create_video(story_title, image_paths, audio_path, content)
    project = StoryProject(story_title, theme, content, image_paths, audio_path, video_path)

    with init_database() as connection:
        story_id = save_story(connection, project)
    print(f"\nHikaye veritabanina kaydedildi. Story ID: {story_id}")
    return project


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="AIStoryTeller - LLM destekli hikaye, gorsel, ses ve video uretimi")
    parser.add_argument("--theme", "-t", help="Hikayenin temasi")
    parser.add_argument("--title", help="Hikaye basligi")
    parser.add_argument("--offline", action="store_true", help="Internet/API kullanmadan yerel demo ciktilari uretir")
    return parser.parse_args()


def main() -> None:
    load_env_file()
    args = parse_args()
    if args.offline:
        os.environ["AISTORYTELLER_OFFLINE"] = "1"

    theme = args.theme or input("Hikaye temasi nedir? Ornek: Cesur robot\n> ").strip()
    if not theme:
        raise SystemExit("Tema bos olamaz.")

    project = build_project(theme, args.title)
    print("\nOlusan hikaye:\n")
    print(project.content)
    print("\nCiktilar:")
    for image in project.image_paths:
        print(f"- Gorsel: {image}")
    if project.audio_path:
        print(f"- Ses: {project.audio_path}")
    if project.video_path:
        print(f"- Video: {project.video_path}")
    print(f"- Veritabani: {DB_PATH}")


if __name__ == "__main__":
    main()
