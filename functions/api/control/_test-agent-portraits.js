function bytes(...values) {
  return Uint8Array.from(values.flat());
}

function uint32(value) {
  return bytes(
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff
  );
}

function concatenate(parts) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function crc32(input) {
  let crc = 0xffffffff;
  for (const value of input) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(input) {
  let a = 1;
  let b = 0;
  for (const value of input) {
    a = (a + value) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function chunk(type, data = new Uint8Array()) {
  const name = new TextEncoder().encode(type);
  const body = concatenate([name, data]);
  return concatenate([uint32(data.length), body, uint32(crc32(body))]);
}

function zlibStore(input) {
  const blocks = [bytes(0x78, 0x01)];
  for (let offset = 0; offset < input.length; offset += 65535) {
    const size = Math.min(65535, input.length - offset);
    const finalBlock = offset + size >= input.length;
    blocks.push(bytes(
      finalBlock ? 0x01 : 0x00,
      size & 0xff,
      (size >>> 8) & 0xff,
      (~size) & 0xff,
      ((~size) >>> 8) & 0xff
    ));
    blocks.push(input.subarray(offset, offset + size));
  }
  blocks.push(uint32(adler32(input)));
  return concatenate(blocks);
}

function rgb(hex) {
  const value = String(hex).replace('#', '');
  return bytes(
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16)
  );
}

function insideCircle(x, y, centerX, centerY, radius) {
  const dx = x - centerX;
  const dy = y - centerY;
  return dx * dx + dy * dy <= radius * radius;
}

function insideEllipse(x, y, centerX, centerY, radiusX, radiusY) {
  const dx = (x - centerX) / radiusX;
  const dy = (y - centerY) / radiusY;
  return dx * dx + dy * dy <= 1;
}

function paletteFor(index) {
  const palettes = [
    ['#171317', '#2D1821', '#512137', '#7B2D4C', '#C39B63', '#E2D4C0', '#F4EEE8', '#090809'],
    ['#111113', '#251820', '#462537', '#6D3753', '#B58D5D', '#D7C7B6', '#F2ECE7', '#080708'],
    ['#18151A', '#30202B', '#55283E', '#853B5E', '#C8A56D', '#DDCFBE', '#F5EFEB', '#0A090A']
  ];
  return palettes[index % palettes.length];
}

export function portraitPng(agent, index = 0, size = 512) {
  const width = Math.max(256, Math.min(768, Math.round(size)));
  const height = width;
  const couple = agent?.persona?.profile_type === 'couple';
  const raw = new Uint8Array((width + 1) * height);
  const scale = width / 512;
  const primaryX = couple ? 205 : 256;
  const secondaryX = 325;

  for (let y = 0; y < height; y += 1) {
    const row = y * (width + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const px = x / scale;
      const py = y / scale;
      let color = Math.min(3, Math.floor((px + py) / 270));
      if (insideCircle(px, py, 92, 86, 116)) color = 4;
      if (insideCircle(px, py, 430, 430, 145)) color = Math.max(color, 2);
      if (insideEllipse(px, py, primaryX, 395, couple ? 118 : 150, 165)) color = 5;
      if (insideCircle(px, py, primaryX, 205, couple ? 71 : 82)) color = 6;
      if (couple && insideEllipse(px, py, secondaryX, 398, 118, 165)) color = 5;
      if (couple && insideCircle(px, py, secondaryX, 210, 71)) color = 6;
      if (py > 448) color = 7;
      raw[row + 1 + x] = color;
    }
  }

  const palette = concatenate(paletteFor(index).map(rgb));
  const ihdr = concatenate([
    uint32(width),
    uint32(height),
    bytes(8, 3, 0, 0, 0)
  ]);
  return concatenate([
    bytes(137, 80, 78, 71, 13, 10, 26, 10),
    chunk('IHDR', ihdr),
    chunk('PLTE', palette),
    chunk('IDAT', zlibStore(raw)),
    chunk('IEND')
  ]);
}
