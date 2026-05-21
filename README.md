# AIStoryTeller

AIStoryTeller, kullanicidan aldigi tema ile cocuklara uygun hikaye ureten, hikayeyi veritabanina kaydeden, sahnelere gore en az 3 gorsel olusturan, metni sese ceviren ve ses-gorsel-altyazi iceren video cikaran bir Python projesidir.

## Kurulum

```powershell
py -m pip install -r requirements.txt
```

Python sistemde `py` komutuyla gelmiyorsa kendi Python yolunuzu kullanabilirsiniz.

## API Anahtari

Gemini ile hikaye uretmek icin ortam degiskeni tanimlayin:

```powershell
$env:GEMINI_API_KEY="anahtariniz"
```

Isterseniz `.env.example` dosyasini `.env` olarak kopyalayip anahtari oraya da yazabilirsiniz. Anahtar verilmezse uygulama yerel ornek hikaye uretir. Bu sayede proje eksik ortamda da akisi gosterebilir.

## Calistirma

```powershell
py Project.py --theme "Cesur robot"
```

Internet veya API anahtari olmadan hizli demo almak icin:

```powershell
py Project.py --theme "Cesur robot" --offline
```

Uygulama ciktilari `outputs` klasorune yazar:

- `outputs/assets`: Sahne gorselleri
- `outputs/*-narration.mp3`: Seslendirme
- `outputs/*-video.mp4`: Video
- `ai_storyteller.db`: SQLite veritabani

## Dokumanda Istenen Story'ler

Proje `SCRUM_BOARD.md` dosyasinda 100 story point olarak takip edilir. Kod icinde her story su sekilde karsilanir:

- Story 1: `generate_story`
- Story 2: `init_database` ve `save_story`
- Story 3: `generate_images`
- Story 4: `create_audio`
- Story 5: `create_video`
- Story 6: MoviePy fade efektleri
- Story 7: MoviePy `TextClip` altyazi katmani

## Notlar

Video uretimi icin MoviePy'nin kullanabildigi ffmpeg ve altyazi icin ImageMagick gerekebilir. Paket veya internet eksikse uygulama hatayi acikca yazar ve olusan ara ciktilari korur.
