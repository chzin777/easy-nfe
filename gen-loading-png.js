const sharp = require("sharp");
const bolt =
  "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#4f46e5"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </linearGradient>
  </defs>
  <path d="${bolt}" fill="#e2e8f0" opacity="0.55"/>
  <path d="${bolt}" fill="url(#g)"/>
  <path d="${bolt}" fill="none" stroke="#4f46e5" stroke-width="1.2" stroke-linejoin="round" opacity="0.9"/>
</svg>`;
const out = process.argv[2] || "loading-lightning.png";
const px = parseInt(process.argv[3] || "512", 10);
sharp(Buffer.from(svg))
  .resize(px, px)
  .png()
  .toFile(out)
  .then(() => console.log("wrote", out, px + "px"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
