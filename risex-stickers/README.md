# RISEx frog sticker pack

12 Telegram stickers made on Higgsfield (gpt_image_2_5, high, 2k, transparent) from the blue-tee frog.
`manifest.json` lists each sticker's caption, emoji and source file.

## Build the files

```
python3 build_pack.py              # downloads the 12 images, writes pack/
python3 build_pack.py --src DIR    # or use images you downloaded yourself
```

`pack/` gets a 512 px PNG and WEBP for each sticker plus `emoji.txt`. Telegram needs one side at
exactly 512 px, a transparent background and under 512 KB; the script checks all three.

## Publish on Telegram

1. Open @Stickers in Telegram and send `/newpack`.
2. Name the pack, then send each PNG **as a file** (not as a photo).
3. After each file, send its emoji from `emoji.txt`.
4. Send `/publish`, skip the icon or send one, then pick the short link name (t.me/addstickers/<name>).
