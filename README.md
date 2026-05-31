# AI Video Generator

AI Video Generator, kullanicidan aldigi tema ve stil ayarlariyla cocuklara uygun hikaye ureten, hikayeyi MongoDB'ye kaydeden, sahne gorselleri ve ses dosyasi olusturan, Remotion ile altyazili MP4 video render eden bir web uygulamasidir.

## Teknoloji Stack'i

- Vue 3 + Vite + TypeScript
- Node.js + Express + TypeScript
- MongoDB + Mongoose
- BullMQ + Redis
- Remotion
- Groq/Gemini + fallback story generation
- Hugging Face Inference API image generation + fallback SVG scenes
- Edge TTS / ElevenLabs text-to-speech + system/silent audio fallback

## Kurulum

```bash
pnpm install
cp .env.example .env
```

Varsayilan hikaye modu `AI_PROVIDER=fallback` ile calisir. Groq kullanmak icin `.env` icinde `AI_PROVIDER=groq` ve `GROQ_API_KEY` girin. Gemini kullanmak icin `AI_PROVIDER=gemini` ve `GEMINI_API_KEY` girin. `AI_PROVIDER=auto` secilirse sistem once Groq, sonra Gemini, sonra fallback dener.

Ses icin varsayilan `TTS_PROVIDER=edge` ayarlidir. Edge TTS API anahtari istemez ve varsayilan Turkce ses `tr-TR-EmelNeural` ile MP3 uretir. Farkli bir ses icin `.env` icindeki `EDGE_TTS_VOICE` degerini degistirebilirsiniz. ElevenLabs kullanmak isterseniz `TTS_PROVIDER=elevenlabs` ve `ELEVENLABS_API_KEY` girin. Ses servisleri calismazsa system TTS veya sessiz WAV fallback devreye girer.

Gorsel icin varsayilan `IMAGE_PROVIDER=huggingface` ayarlidir. Hugging Face Inference API kullanmak icin `.env` icine `HF_TOKEN` ekleyin. Varsayilan model `stabilityai/stable-diffusion-xl-base-1.0`; isterseniz `HF_IMAGE_MODEL` ile degistirebilirsiniz. Anahtar veya servis hatasi olursa sahne bazli SVG fallback uretilir ve video pipeline'i durmaz.

## Docker Compose ile Calistirma

Tum sistemi Docker Compose ile tek komutta baslatabilirsiniz:

```bash
pnpm stack:up
```

Bu komut su servisleri ayaga kaldirir:

- `web`: Vue arayuzu + Nginx reverse proxy (`http://localhost:5173`)
- `api`: Express API (`http://localhost:4000`)
- `worker`: BullMQ video pipeline worker
- `mongodb`: MongoDB (`localhost:27017`)
- `redis`: Redis (`localhost:6380`)

Docker icinde servisler birbirleriyle container adlari uzerinden haberlesir. API ve worker icin `MONGODB_URI=mongodb://mongodb:27017/ai-video-generator`, `REDIS_HOST=redis`, `REDIS_PORT=6379` degerleri compose tarafindan otomatik verilir.

Servisleri durdurmak icin:

```bash
pnpm stack:down
```

Docker Desktop kapaliysa once Docker'i acin, sonra `pnpm stack:up` komutunu tekrar calistirin. Redis host portu proje icin `6380` olarak ayarlandi; bu sayede bilgisayarda baska Redis servisleri varsa port cakismasi azalir.

## Lokal Gelistirme

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

## Demo Akisi

1. Web arayuzunde tema, stil, yas grubu ve sahne sayisi secilir.
2. Express API MongoDB'de proje olusturur.
3. BullMQ worker hikaye, gorsel, ses ve video adimlarini sirayla calistirir.
4. Dashboard proje durumlarini ve pipeline loglarini gosterir.
5. Proje detayinda video player, hikaye, sahneler, assetler ve MP4 indirme linki gorunur.

## Final Demo Komut Sirasi

```bash
pnpm stack:up
```

Sonra `http://localhost:5173` adresinden yeni proje olusturun. Web container'i `/api` ve `/outputs` isteklerini Express API container'ina proxy eder.

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

Demo guvenilirligi icin `.env` icinde `AI_PROVIDER=fallback`, `IMAGE_PROVIDER=fallback` ve `TTS_PROVIDER=fallback` kullanilabilir. Bu modda internet veya API anahtari olmasa bile video pipeline'i tamamlanir.

## Ders Isterleri

- LLM ile prompt/hikaye olusturma: Groq, Gemini veya fallback story service
- Hikayeyi veritabanina kaydetme: MongoDB Project modeli
- En az 3 gorsel olusturma: Hugging Face Inference API veya SVG fallback
- Hikayeyi sese donusturme: Edge TTS, ElevenLabs TTS, system TTS veya audio fallback service
- Ses ve gorsellerle video olusturma: Remotion render
- Gorsel gecis efektleri: Remotion fade/smooth zoom
- Videoya altyazi ekleme: Remotion subtitle layer
- Scrum board/story point: `SCRUM_BOARD.md`
