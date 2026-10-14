# OCR embarqué (v37.53)

Lecture des captures bancaires **dans le navigateur**, sans aucun appel IA ni service externe.

| Fichier | Origine | Licence |
|---|---|---|
| `tesseract.min.js`, `worker.min.js` | npm `tesseract.js@5.1.1` (`dist/`) | Apache-2.0 (`LICENSE-tesseract.js.md`) |
| `tesseract-core-simd-lstm.wasm.js` | npm `tesseract.js-core@5.1.1` | Apache-2.0 (`LICENSE-tesseract.js-core`) |
| `lang/fra.traineddata.gz` | npm `@tesseract.js-data/fra@1.0.0`, `4.0.0_best_int` (données Tesseract « tessdata_best » entières) | Apache-2.0 (tessdata) |

Servis par le VPS sous `/finance/vendor/ocr/` (même origine, même `basic_auth`).
Si un fichier manque ou si le navigateur n'a pas WebAssembly SIMD, l'appli retombe
sur le CDN jsDelivr par défaut de tesseract.js.
