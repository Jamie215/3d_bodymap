# Tutorial video assets

These short tutorial clips are **self-hosted** and served same-origin
(`/assets/video/…`) so the participant's browser never contacts a third party
(YouTube/Google) to view them. The player (`js/components/videoEmbed.js`) sets
`preload="none"`, so nothing is fetched until the participant clicks play.

## Files expected here

Drop one MP4 per clip, named exactly as below.

| File | Where it appears |
|---|---|
| `intro.mp4` | Summary screen tutorial + help "How do I use the form?" |
| `help_draw.mp4` | Help — "How do I mark where I feel my pain or symptom?" |
| `help_erase.mp4` | Help — "Can I change or erase what I drew?" |
| `help_bodyView.mp4` | Help — "The body part is not where I want to draw…" |
| `help_zoom.mp4` | Help — "The body area is not zoomed in/out enough…" |
| `help_rotateBody.mp4` | Help — "How do I turn the body part to see the side or back?" |

To change these filenames, update the `src` paths in
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

If you add a WebVTT caption file per clip (e.g. `intro.vtt`), a
`<track kind="captions">` can be wired into the player.
