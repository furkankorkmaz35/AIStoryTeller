# AI Video Generator

AI Video Generator, kullanicidan aldigi tema ve stil ayarlariyla cocuklara uygun hikaye ureten, hikayeyi MongoDB'ye kaydeden, sahne gorselleri ve ses dosyasi olusturan, Remotion ile altyazili MP4 video render eden bir web uygulamasidir.

## Teknoloji Stack'i

- Vue 3 + Vite + TypeScript
- Node.js + Express + TypeScript
- MongoDB + Mongoose
- BullMQ + Redis
- Remotion
- Groq/Gemini + fallback story generation
- Image provider + fallback SVG scenes
- macOS system TTS + audio fallback WAV

## Kurulum

```bash
pnpm install
cp .env.example .env
pnpm stack:up
```

Varsayilan demo modu `AI_PROVIDER=fallback` ile calisir. Groq kullanmak icin `.env` icinde `AI_PROVIDER=groq` ve `GROQ_API_KEY` girin. Gemini kullanmak icin `AI_PROVIDER=gemini` ve `GEMINI_API_KEY` girin. `AI_PROVIDER=auto` secilirse sistem once Groq, sonra Gemini, sonra fallback dener.

Ses icin varsayilan `TTS_PROVIDER=system` ayarlidir. macOS `say` komutu varsa gercek narration dosyasi uretir; calismazsa sessiz WAV fallback uretir.

## Calistirma

Uc terminal kullanin:

```bash
pnpm dev:api
```

```bash
pnpm worker
```

```bash
pnpm dev:web
```

Web arayuzu: `http://localhost:5173`

API saglik kontrolu: `http://localhost:4000/health`

Sistem durumu: `http://localhost:4000/api/system/status`

Docker Desktop kapaliysa once Docker'i acin, sonra `pnpm stack:up` komutunu tekrar calistirin. Redis host portu proje icin `6380` olarak ayarlandi; bu sayede bilgisayarda baska Redis servisleri varsa port cakismasi azalir.

## Demo Akisi

1. Web arayuzunde tema, stil, yas grubu ve sahne sayisi secilir.
2. Express API MongoDB'de proje olusturur.
3. BullMQ worker hikaye, gorsel, ses ve video adimlarini sirayla calistirir.
4. Dashboard proje durumlarini ve pipeline loglarini gosterir.
5. Proje detayinda video player, hikaye, sahneler, assetler ve MP4 indirme linki gorunur.

## Final Demo Komut Sirasi

```bash
pnpm stack:up
pnpm dev:api
pnpm worker
pnpm dev:web
```

Sonra `http://localhost:5173` adresinden yeni proje olusturun. Sistem strip'i MongoDB, queue ve provider durumlarini gosterir.

## API Ozeti

- `POST /api/projects`: Yeni video projesi olusturur ve pipeline'i baslatir.
- `GET /api/projects`: Projeleri listeler.
- `GET /api/projects/:id`: Proje, sahne, asset ve log detaylarini getirir.
- `POST /api/projects/:id/retry`: Projeyi yeniden BullMQ pipeline'ina alir.
- `GET /api/projects/:id/events`: Pipeline loglarini getirir.
- `GET /api/system/status`: MongoDB, BullMQ queue ve aktif provider durumlarini getirir.

## Sunum Icin Hizli Kontrol

```bash
pnpm typecheck
pnpm build
curl http://localhost:4000/api/system/status
```

Demo guvenilirligi icin `.env` icinde `AI_PROVIDER=fallback` ve `IMAGE_PROVIDER=fallback` kullanilabilir. Bu modda internet veya API anahtari olmasa bile video pipeline'i tamamlanir.

## Ders Isterleri

- LLM ile prompt/hikaye olusturma: Groq, Gemini veya fallback story service
- Hikayeyi veritabanina kaydetme: MongoDB Project modeli
- En az 3 gorsel olusturma: Scene bazli image generation
- Hikayeyi sese donusturme: macOS system TTS veya audio fallback service
- Ses ve gorsellerle video olusturma: Remotion render
- Gorsel gecis efektleri: Remotion fade/smooth zoom
- Videoya altyazi ekleme: Remotion subtitle layer
- Scrum board/story point: `SCRUM_BOARD.md`
