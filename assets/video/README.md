# Tutorial video assets

These short tutorial clips are **self-hosted** and served same-origin
(`/assets/video/…`) so the participant's browser never contacts a third party
(YouTube/Google) to view them. The player (`js/components/videoEmbed.js`) sets
`preload="none"`, so nothing is fetched until the participant clicks play.

## Files expected here

Drop one MP4 per clip, named exactly as below. The stem of each filename is the
original YouTube video ID, kept so each self-hosted file maps 1:1 to the clip it
replaced.

| File | Where it appears |
|---|---|
| `2LGwMr0mNc4.mp4` | Summary screen tutorial + help "How do I use the form?" |
| `FGc40Py935Q.mp4` | Help — "How do I mark where I feel my pain or symptom?" |
| `oScNkq656Jw.mp4` | Help — "Can I change or erase what I drew?" |
| `pqxVb4QX4PQ.mp4` | Help — "The body part is not where I want to draw…" |
| `mcJio_POOyA.mp4` | Help — "The body area is not zoomed in/out enough…" |
| `gKJy760HXyo.mp4` | Help — "How do I turn the body part to see the side or back?" |

To rename to friendlier filenames, update the `src` paths in
`js/data/helpContent.js` and the defaults in `js/components/videoEmbed.js`
to match.

## Encoding

Encode each clip as **MP4 (H.264 video + AAC audio)** for universal browser
support, e.g.:

    ffmpeg -i input.mov -c:v libx264 -profile:v high -pix_fmt yuv420p \
           -movflags +faststart -c:a aac -b:a 128k output.mp4

`-movflags +faststart` puts the metadata at the front so playback can begin
before the whole file downloads. Keep each clip small (these are ~2–3 MB).

## Captions (optional, recommended for accessibility)

If you add a WebVTT caption file per clip (e.g. `2LGwMr0mNc4.vtt`), a
`<track kind="captions">` can be wired into the player.
