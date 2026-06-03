# AIStoryTeller

AIStoryTeller, kullanıcıdan aldığı kısa bir promptu 3 sahnelik dikey sosyal medya videosuna dönüştüren bir video üretim stüdyosudur. Proje; hikaye yazımı, görsel üretimi, Türkçe seslendirme, altyazı, video render ve MongoDB kayıtlarını tek akışta birleştirir.

Bu sürümde amaç karmaşık bir otomasyon paneli değil, ders sunumunda net gösterilebilen sade ve çalışan bir üretim hattıdır: prompt girilir, sistem hikaye/sahne üretir, görselleri ve sesi oluşturur, Remotion ile MP4 render eder ve tüm çıktıları MongoDB ile dosya sisteminde izlenebilir şekilde saklar.

## Güncel Mimari Kararı

Proje sadeleştirilmiş monorepo mimarisiyle ilerler:

- Frontend, Vue 3 + Vite ile hazırlanmıştır.
- Backend, Express + TypeScript ile API katmanını sağlar.
- MongoDB, proje, sahne, medya dosyası ve pipeline log kayıtlarını tutar.
- Redis + BullMQ, video üretim adımlarını kuyruk halinde çalıştırır.
- Worker, uzun süren üretim işlerini API'den ayırır.
- Remotion, görsel, ses ve altyazıları final MP4 videoya dönüştürür.
- Local AI modeli çalıştırılmaz; cihazı yormamak için cloud/free-tier providerlar ve fallback mekanizmaları kullanılır.

Ana karar: sistemin demo sırasında bozulmaması için her kritik adımda fallback vardır. Görsel provider çalışmazsa tasarımsal fallback sahne, ses provider çalışmazsa sessiz fallback devreye girebilir. Böylece pipeline tamamen yarıda kalmaz.

## Klasör Yapısı

```text
apps/
  api/
    src/
      controllers/        HTTP isteklerini servis katmanına taşır
      models/             MongoDB/Mongoose modelleri
      queues/             BullMQ video kuyruğu
      routes/             Express route tanımları
      services/           Hikaye, görsel, ses, video ve pipeline iş mantığı
      remotion/           Final MP4 composition dosyaları
      validators/         API request doğrulama şemaları
      worker.ts           BullMQ job listener
  web/
    src/
      components/         Vue arayüz parçaları
      composables/        Frontend state ve API akışı
      constants/          Pipeline status sırası ve etiketleri
      lib/                API helper fonksiyonları
outputs/                  Üretilen görsel, ses, altyazı ve MP4 dosyaları
docker-compose.yml        MongoDB, Redis, API, Worker ve Web servisleri
```

## Kullanılan Teknolojiler

### Frontend

- Vue 3
- Vite
- JavaScript
- CSS
- lucide-vue-next ikonları

Frontend bilinçli olarak sade tutulmuştur. Ana ekran; prompt formu, galeri, üretim önizlemesi, MongoDB kayıt kanıtı, görsel/ses/video çıktıları ve pipeline loglarını gösterir.

### Backend

- Node.js
- Express
- TypeScript
- Mongoose
- BullMQ
- Redis
- Remotion
- FFmpeg / FFprobe

Backend controller-service-model ayrımıyla düzenlenmiştir. API sadece proje oluşturma/listeleme/detay ve sistem durumu verir. Ağır üretim işlemleri worker tarafında çalışır.

### Veritabanı ve Kuyruk

- MongoDB: proje, sahne, asset ve job event kayıtları
- Redis: BullMQ job kuyruğu

MongoDB koleksiyonları:

- `projects`: Ana video üretim kaydı
- `scenes`: Hikaye sahneleri, görsel promptlar ve seçilen görseller
- `assets`: Üretilen image/audio/subtitle/video dosya yolları
- `jobevents`: Pipeline adım logları

## Kullanılan API ve Providerlar

### Metin / Hikaye

- Groq
- Gemini
- Deterministik fallback hikaye servisi

Varsayılan metin akışı `.env` içindeki `AI_PROVIDER` değerine göre çalışır. Groq veya Gemini key yoksa sistem fallback hikaye üretimiyle demo akışını sürdürebilir.

### Görsel

Öncelikli görsel üretim/destek kaynakları:

- Cloudflare Workers AI
- Pollinations
- Hugging Face Inference
- Pexels
- Pixabay
- Yerel tasarımsal SVG fallback

Görsel üretimden önce sahne metni İngilizce ve daha somut bir görsel prompta çevrilir. Prompt güçlendirme katmanı; ana karakter, aksiyon ve mekanı kilitlemeye çalışır. Örneğin kullanıcı kedi yazdıysa görsel promptta kedinin görünmesi açıkça istenir.

### Ses

- ElevenLabs
- Sessiz WAV fallback

Bu sürümde ana ses provider ElevenLabs'tir. Seslendirme sahne sahne üretilir. Bunun sebebi:

- Free-tier metin kesilmesini azaltmak
- Her sahnenin ses süresini ölçmek
- Görsel geçişleri ve altyazıyı sese daha iyi senkronlamak

ElevenLabs başarısız olursa sistem render aşamasını tamamen durdurmamak için sessiz fallback kullanabilir.

### Video Render

- Remotion
- FFmpeg
- FFprobe

Remotion sahne görsellerini, altyazıları ve ses dosyasını dikey video zaman çizelgesine yerleştirir. FFmpeg son aşamada görüntü keskinliği, renk ve ses normalizasyonu için kullanılır.

## Üretim Akışı

1. Kullanıcı Vue arayüzünden prompt yazar ve altyazı seçimini belirler.
2. Express API, MongoDB'de `Project` kaydı oluşturur.
3. API, ilk BullMQ job'ını kuyruğa ekler.
4. Worker sırayla pipeline adımlarını çalıştırır:
   - `generate-story`
   - `generate-scenes-and-prompts`
   - `generate-visual-candidates`
   - `select-best-materials`
   - `generate-audio`
   - `generate-subtitles`
   - `render-video`
5. Her adım MongoDB'ye log olarak yazılır.
6. Görseller, ses, altyazı ve MP4 dosyaları `outputs/` altında saklanır.
7. Frontend seçili proje detayını yenileyerek video, ses, görseller ve pipeline loglarını gösterir.

## API Özeti

```text
GET  /health
GET  /api/system/status
POST /api/projects
GET  /api/projects
GET  /api/projects/:id
```

### `POST /api/projects`

Yeni video üretimi başlatır. Basit body örneği:

```json
{
  "theme": "Okuldan çıkan çocuk sokakta küçük bir kedi görür ve onu sever.",
  "subtitlesEnabled": true
}
```

Backend diğer demo ayarlarını güvenli varsayılanlarla tamamlar:

- `sceneCount`: 3
- `style`: cinematic
- `aspectRatio`: 9:16
- `voiceProvider`: elevenlabs
- `materialMode`: ai-image

## Docker ile Çalıştırma

Docker Desktop açıkken:

```bash
pnpm stack:up
```

Servisler:

- Web: `http://localhost:5173`
- API: `http://localhost:4000`
- MongoDB: `mongodb://localhost:27017/ai-video-generator`
- Redis: `localhost:6380`

Servisleri durdurmak için:

```bash
pnpm stack:down
```

Build alıp kontrol etmek için:

```bash
pnpm typecheck
pnpm build
```

## Lokal Geliştirme

Üç ayrı terminal:

```bash
pnpm dev:api
```

```bash
pnpm worker
```

```bash
pnpm dev:web
```

Web arayüzü:

```text
http://localhost:5173
```

Sistem durumu:

```text
http://localhost:4000/api/system/status
```

## Ortam Değişkenleri

Örnek dosya:

```bash
cp .env.example .env
```

Önemli değişkenler:

```text
MONGODB_URI
REDIS_HOST
REDIS_PORT
PUBLIC_API_BASE_URL
AI_PROVIDER
GROQ_API_KEY
GEMINI_API_KEY
IMAGE_PROVIDER
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
POLLINATIONS_API_KEY
HF_TOKEN
PEXELS_API_KEY
PIXABAY_API_KEY
ELEVENLABS_API_KEY
ELEVENLABS_VOICE_ID
ELEVENLABS_FALLBACK_VOICE_ID
```

API key yoksa proje tamamen durmak yerine fallback katmanlarına inmeye çalışır. En kaliteli demo için en azından görsel provider ve ElevenLabs key önerilir.

## Sunumda Gösterilecek Kanıtlar

Frontend çıktı panelinde:

- MongoDB `project._id`
- Proje durumu
- Pipeline yüzdesi
- Üretilen görseller
- Ses dosyası
- Final MP4
- Son job logları

MongoDB Compass ile gösterilebilecek kayıtlar:

```text
mongodb://localhost:27017/ai-video-generator
```

Koleksiyonlar:

- `projects`
- `scenes`
- `assets`
- `jobevents`

## Ders İsterleriyle Eşleşme

- Prompt ile hikaye üretimi: Groq/Gemini/fallback story service
- Veritabanına kayıt: MongoDB + Mongoose
- En az 3 görsel: Cloud provider veya fallback görsel
- Seslendirme: ElevenLabs veya sessiz fallback
- Video oluşturma: Remotion + FFmpeg
- Altyazı: Remotion subtitle layer
- Görsel geçiş ve animasyon: Remotion sahne hareketleri, fade, zoom, overlay efektleri
- Pipeline/otomasyon: BullMQ + Redis worker akışı
- Sunumda kayıt kanıtı: MongoDB project, scene, asset ve job event kayıtları

## Test Edilmiş Kontroller

```bash
pnpm --filter @ai-video/api typecheck
pnpm --filter @ai-video/web build
pnpm build
```

Son çalışan testte sistem; 3 görsel, ElevenLabs ses, altyazı ve final MP4 üretip `completed` durumuna geçmiştir.
